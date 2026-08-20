import { db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { eq, ne, isNull } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from apps/api
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function resetQA() {
  console.log('--- PHASE 3: QA RESET ---');
  
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
    console.error(`[ERROR] This appears to be a production database. Disabling QA reset.`);
    process.exit(1);
  }

  try {
    const connectXUser = await db.query.users.findFirst({
      where: eq(schema.users.email, connectxEmail),
    });

    if (!connectXUser) {
      console.error(`[ERROR] ConnectX user (${connectxEmail}) not found. Please provision first.`);
      process.exit(1);
    }

    console.log(`[INFO] Found ConnectX user. Proceeding with transaction...`);

    await db.transaction(async (tx) => {
      // 1. Delete audit logs associated with other users before they are set to null
      console.log('  -> Deleting audit logs of QA users...');
      await tx.delete(schema.auditLogs).where(ne(schema.auditLogs.userId, connectXUser.id));

      // 2. Delete all other users (this cascades to profiles, posts, comments, follows, messages, sessions, etc.)
      console.log('  -> Deleting QA users and dependent records (CASCADE)...');
      await tx.delete(schema.users).where(ne(schema.users.id, connectXUser.id));

      // 3. Clean up any remaining audit logs that were set to null (if any legacy orphans existed)
      console.log('  -> Cleaning up orphaned audit logs...');
      await tx.delete(schema.auditLogs).where(isNull(schema.auditLogs.userId));

      // 4. Validate post-reset state
      console.log('  -> Validating post-reset state...');
      const remainingUsers = await tx.select().from(schema.users);
      if (remainingUsers.length !== 1 || remainingUsers[0].id !== connectXUser.id) {
        throw new Error('Validation failed: Found more than just the ConnectX user.');
      }

      const remainingProfiles = await tx.select().from(schema.profiles);
      if (remainingProfiles.length !== 1 || remainingProfiles[0].userId !== connectXUser.id) {
        throw new Error('Validation failed: Found orphaned profiles.');
      }

      console.log('  -> State validation PASSED. Committing transaction...');
    });

    console.log(`\n[SUCCESS] QA database reset complete. Ready for clean QA cycle.\n`);
    
  } catch (err) {
    console.error('\n[ERROR] Transaction aborted and rolled back:', err);
    process.exit(1);
  }

  process.exit(0);
}

resetQA();
