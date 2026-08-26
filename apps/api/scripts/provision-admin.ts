import { db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';

// Load .env from apps/api
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function provisionAdmin() {
  console.log('--- PROVISION HAKIKU SYSTEM IDENTITY ---');
  
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL || '';
  const adminEmail = process.env.HAKIKU_ADMIN_EMAIL;
  const adminPassword = process.env.HAKIKU_ADMIN_PASSWORD;
  
  if (!adminEmail || !adminPassword) {
    console.error('[ERROR] HAKIKU_ADMIN_EMAIL or HAKIKU_ADMIN_PASSWORD is not defined in the environment.');
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
      where: eq(schema.users.email, adminEmail),
    });

    if (!user) {
      console.log(`User ${adminEmail} not found. Creating user...`);
      const [newUser] = await db.insert(schema.users).values({
        id: uuidv4(),
        email: adminEmail,
        isVerified: true,
        emailVerifiedAt: new Date(),
        role: 'ADMIN',
        status: 'ACTIVE',
      }).returning();
      user = newUser;
    } else {
      console.log(`User ${adminEmail} found. Updating role...`);
      const [updatedUser] = await db.update(schema.users).set({
        role: 'ADMIN',
        isVerified: true,
      }).where(eq(schema.users.id, user.id)).returning();
      user = updatedUser;
    }

    // 2. Provision admin credentials
    console.log(`Provisioning admin credentials for ${adminEmail}...`);
    const passwordHash = await argon2.hash(adminPassword);
    
    await db.insert(schema.adminCredentials).values({
      userId: user.id,
      passwordHash,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: schema.adminCredentials.userId,
      set: {
        passwordHash,
        updatedAt: new Date(),
      },
    });

    // 3. Provision profile
    let profile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.userId, user.id),
    });

    if (!profile) {
      console.log(`Profile for ${adminEmail} not found. Creating profile...`);
      await db.insert(schema.profiles).values({
        id: uuidv4(),
        userId: user.id,
        username: 'hakikuadmin',
        displayName: 'Hakiku Admin',
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
      console.log(`Profile for ${adminEmail} found. Updating verified identity...`);
      await db.update(schema.profiles).set({
        username: 'hakikuadmin',
        displayName: 'Hakiku Admin',
        isVerifiedIdentity: true,
      }).where(eq(schema.profiles.id, profile.id));
    }

    console.log(`\n[SUCCESS] Hakiku Admin identity provisioned successfully.`);
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Role: ADMIN`);
    console.log(`  Username: hakikuadmin`);
    console.log(`  Verified Identity: true\n`);
    
  } catch (err) {
    console.error('Error provisioning Hakiku Admin:', err);
    process.exit(1);
  }

  process.exit(0);
}

provisionAdmin();
