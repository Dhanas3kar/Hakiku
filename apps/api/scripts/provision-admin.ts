import { db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { eq, or } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id as 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

// Load .env from apps/api
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function provisionAdmin() {
  console.log('--- PROVISION HAKIKU OFFICIAL ADMIN IDENTITY ---');
  
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL || '';
  const adminEmail = process.env.HAKIKU_ADMIN_EMAIL || 'admin@srmconnect.edu.in';
  const adminPassword = process.env.HAKIKU_ADMIN_PASSWORD || 'AdminPass123!';

  const urlObj = new URL(dbUrl);
  const maskedHost = urlObj.hostname;
  
  if (nodeEnv === 'production' || (maskedHost !== '127.0.0.1' && maskedHost !== 'localhost')) {
    console.error(`[ERROR] This appears to be a production database. Disabling provisioning.`);
    process.exit(1);
  }

  try {
    // 1. Cleanup old legacy 'hakikuadmin' profile if present
    const oldAdminProfile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.username, 'hakikuadmin'),
    });

    if (oldAdminProfile) {
      console.log(`Cleaning up old legacy 'hakikuadmin' profile (${oldAdminProfile.userId})...`);
      // Delete old admin credentials if any
      await db.delete(schema.adminCredentials).where(eq(schema.adminCredentials.userId, oldAdminProfile.userId));
      // Delete old profile
      await db.delete(schema.profiles).where(eq(schema.profiles.id, oldAdminProfile.id));
      // Delete old user record
      await db.delete(schema.users).where(eq(schema.users.id, oldAdminProfile.userId));
      console.log(`Deleted legacy 'hakikuadmin' profile & user.`);
    }

    // 2. Check if main admin user already exists
    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, adminEmail),
    });

    if (!user) {
      console.log(`User ${adminEmail} not found. Creating official admin user...`);
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
      console.log(`User ${adminEmail} found. Updating role to ADMIN...`);
      const [updatedUser] = await db.update(schema.users).set({
        role: 'ADMIN',
        isVerified: true,
      }).where(eq(schema.users.id, user.id)).returning();
      user = updatedUser;
    }

    // 3. Provision admin credentials
    console.log(`Provisioning admin credentials for ${adminEmail}...`);
    const passwordHash = await argon2.hash(adminPassword, ARGON2_OPTIONS);
    
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

    // 4. Provision official 'hakiku_official' profile
    let profile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.userId, user.id),
    });

    if (!profile) {
      console.log(`Profile for ${adminEmail} not found. Creating @hakiku_official profile...`);
      await db.insert(schema.profiles).values({
        id: uuidv4(),
        userId: user.id,
        username: 'hakiku_official',
        displayName: 'HAKIKU Official',
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
      console.log(`Profile for ${adminEmail} found. Updating to @hakiku_official...`);
      await db.update(schema.profiles).set({
        username: 'hakiku_official',
        displayName: 'HAKIKU Official',
        isVerifiedIdentity: true,
      }).where(eq(schema.profiles.id, profile.id));
    }

    console.log(`\n[SUCCESS] Hakiku Official Admin identity provisioned successfully.`);
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Role: ADMIN`);
    console.log(`  Username: hakiku_official`);
    console.log(`  DisplayName: HAKIKU Official`);
    console.log(`  Verified Identity: true\n`);
    
  } catch (err) {
    console.error('Error provisioning Hakiku Admin:', err);
    process.exit(1);
  }

  process.exit(0);
}

provisionAdmin();
