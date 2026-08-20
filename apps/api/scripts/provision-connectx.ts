import { db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Load .env from apps/api
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function provisionConnectX() {
  console.log('--- PROVISION CONNECTX SYSTEM IDENTITY ---');
  
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL || '';
  const connectxEmail = process.env.CONNECTX_ADMIN_EMAIL;
  
  if (!connectxEmail) {
    console.error('[ERROR] CONNECTX_ADMIN_EMAIL is not defined in the environment.');
    process.exit(1);
  }

  const urlObj = new URL(dbUrl);
  const maskedHost = urlObj.hostname;
  
  if (nodeEnv === 'production' || maskedHost !== '127.0.0.1' && maskedHost !== 'localhost') {
    console.error(`[ERROR] This appears to be a production database. Disabling provisioning.`);
    process.exit(1);
  }

  try {
    // 1. Check if user already exists
    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, connectxEmail),
    });

    if (!user) {
      console.log(`User ${connectxEmail} not found. Creating user...`);
      const [newUser] = await db.insert(schema.users).values({
        id: uuidv4(),
        email: connectxEmail,
        isVerified: true,
        emailVerifiedAt: new Date(),
        role: 'ADMIN',
        status: 'ACTIVE',
      }).returning();
      user = newUser;
    } else {
      console.log(`User ${connectxEmail} found. Updating role...`);
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
      console.log(`Profile for ${connectxEmail} not found. Creating profile...`);
      await db.insert(schema.profiles).values({
        id: uuidv4(),
        userId: user.id,
        username: 'connectx',
        displayName: 'ConnectX',
        campus: 'SYSTEM',
        department: 'ADMINISTRATION',
        degreeProgram: 'SYSTEM',
        batchYear: 2024,
        graduationYear: 2028,
        isVerifiedIdentity: true,
        isProfileCompleted: true,
        completionPercentage: 100,
        visibility: 'PUBLIC',
      });
    } else {
      console.log(`Profile for ${connectxEmail} found. Updating verified identity...`);
      await db.update(schema.profiles).set({
        username: 'connectx',
        displayName: 'ConnectX',
        isVerifiedIdentity: true,
      }).where(eq(schema.profiles.id, profile.id));
    }

    console.log(`\n[SUCCESS] ConnectX identity provisioned successfully.`);
    console.log(`  Email: ${connectxEmail}`);
    console.log(`  Role: ADMIN`);
    console.log(`  Username: connectx`);
    console.log(`  Verified Identity: true\n`);
    
  } catch (err) {
    console.error('Error provisioning ConnectX:', err);
    process.exit(1);
  }

  process.exit(0);
}

provisionConnectX();
