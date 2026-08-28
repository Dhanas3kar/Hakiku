import { db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Load .env from apps/api
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function provisionOfficial() {
  console.log('--- PROVISION HAKIKU OFFICIAL ACCOUNT ---');

  const officialEmail = 'connectxsrm@gmail.com';
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL || '';

  const urlObj = new URL(dbUrl);
  const maskedHost = urlObj.hostname;

  if (nodeEnv === 'production' || (maskedHost !== '127.0.0.1' && maskedHost !== 'localhost')) {
    console.error(`[ERROR] This appears to be a production database. Disabling provisioning.`);
    process.exit(1);
  }

  try {
    // 1. Check if user already exists
    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, officialEmail),
    });

    if (!user) {
      console.log(`User ${officialEmail} not found. Creating user...`);
      const [newUser] = await db.insert(schema.users).values({
        id: uuidv4(),
        email: officialEmail,
        isVerified: true,
        emailVerifiedAt: new Date(),
        role: 'ADMIN',
        status: 'ACTIVE',
      }).returning();
      user = newUser;
    } else {
      console.log(`User ${officialEmail} found. Updating role...`);
      const [updatedUser] = await db.update(schema.users).set({
        role: 'ADMIN',
        isVerified: true,
      }).where(eq(schema.users.id, user.id)).returning();
      user = updatedUser;
    }

    // 2. Provision profile
    let profile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.userId, user.id),
    });

    if (!profile) {
      console.log(`Profile for ${officialEmail} not found. Creating profile...`);
      await db.insert(schema.profiles).values({
        id: uuidv4(),
        userId: user.id,
        username: 'hakiku',
        displayName: 'HAKIKU Official',
        bio: 'The official broadcast account for HAKIKU. Stay tuned for updates!',
        campus: 'SYSTEM',
        department: 'ADMINISTRATION',
        degreeProgram: 'SYSTEM',
        batchYear: new Date().getFullYear(),
        graduationYear: new Date().getFullYear() + 4,
        isVerifiedIdentity: true,
        isProfileCompleted: true,
        completionPercentage: 100,
        visibility: 'PUBLIC',
      });
    } else {
      console.log(`Profile for ${officialEmail} found. Updating verified identity...`);
      await db.update(schema.profiles).set({
        username: 'hakiku',
        displayName: 'HAKIKU Official',
        isVerifiedIdentity: true,
        bio: 'The official broadcast account for HAKIKU. Stay tuned for updates!',
      }).where(eq(schema.profiles.id, profile.id));
    }

    console.log('--- PROVISIONING COMPLETE ---');
    console.log(`Official Account Identity:`);
    console.log(`- Email: ${officialEmail}`);
    console.log(`- Username: @hakiku`);
    console.log(`- Role: ADMIN`);
    console.log(`- Verified: YES`);

    process.exit(0);
  } catch (error) {
    console.error('Error provisioning Hakiku Official Account:', error);
    process.exit(1);
  }
}

provisionOfficial();
