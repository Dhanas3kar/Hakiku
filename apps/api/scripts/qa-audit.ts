import { db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from apps/api
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function audit() {
  console.log('--- PHASE 1: DATABASE ENVIRONMENT SAFETY AUDIT ---');
  
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUrl = process.env.DATABASE_URL || 'Not specified';
  
  // Basic masking of DB URL for safety
  const urlObj = new URL(dbUrl);
  const maskedHost = urlObj.hostname;
  const dbName = urlObj.pathname.replace('/', '');
  
  console.log(`Environment Configuration:`);
  console.log(`  NODE_ENV: ${nodeEnv}`);
  console.log(`  Database Host: ${maskedHost}:${urlObj.port}`);
  console.log(`  Database Name: ${dbName}`);
  
  if (nodeEnv === 'production' || maskedHost !== '127.0.0.1' && maskedHost !== 'localhost') {
    console.warn(`\n[WARNING] This appears to be a production or remote database. Disabling QA reset capabilities.`);
    console.log(`  Production check: FAILED\n`);
  } else {
    console.log(`  Production check: PASSED\n`);
  }

  console.log('--- PHASE 2: QA USER INVENTORY ---');

  try {
    const userCount = await db.execute(sql`SELECT COUNT(*) FROM users;`);
    const adminCount = await db.execute(sql`SELECT COUNT(*) FROM users WHERE role = 'ADMIN';`);
    const studentCount = await db.execute(sql`SELECT COUNT(*) FROM users WHERE role = 'STUDENT';`);
    
    console.log(`Users:`);
    console.log(`  Total: ${userCount[0].count}`);
    console.log(`  Student/QA: ${studentCount[0].count}`);
    console.log(`  Admin/System: ${adminCount[0].count}`);
    
    const profileCount = await db.execute(sql`SELECT COUNT(*) FROM profiles;`);
    const postCount = await db.execute(sql`SELECT COUNT(*) FROM posts;`);
    const mediaCount = await db.execute(sql`SELECT COUNT(*) FROM post_media;`);
    const commentCount = await db.execute(sql`SELECT COUNT(*) FROM comments;`);
    const likeCount = await db.execute(sql`SELECT COUNT(*) FROM post_likes;`);
    const followCount = await db.execute(sql`SELECT COUNT(*) FROM follows;`);
    const connectionCount = await db.execute(sql`SELECT COUNT(*) FROM connections;`);
    const notificationCount = await db.execute(sql`SELECT COUNT(*) FROM notifications;`);
    const conversationCount = await db.execute(sql`SELECT COUNT(*) FROM conversations;`);
    const messageCount = await db.execute(sql`SELECT COUNT(*) FROM messages;`);
    const sessionCount = await db.execute(sql`SELECT COUNT(*) FROM auth_sessions;`);
    const auditCount = await db.execute(sql`SELECT COUNT(*) FROM audit_logs;`);

    console.log(`\nDependent records:`);
    console.log(`  Profiles: ${profileCount[0].count}`);
    console.log(`  Posts: ${postCount[0].count}`);
    console.log(`  Media: ${mediaCount[0].count}`);
    console.log(`  Comments: ${commentCount[0].count}`);
    console.log(`  Likes: ${likeCount[0].count}`);
    console.log(`  Follows: ${followCount[0].count}`);
    console.log(`  Connections: ${connectionCount[0].count}`);
    console.log(`  Notifications: ${notificationCount[0].count}`);
    console.log(`  Conversations: ${conversationCount[0].count}`);
    console.log(`  Messages: ${messageCount[0].count}`);
    console.log(`  Sessions: ${sessionCount[0].count}`);
    console.log(`  Audit Logs: ${auditCount[0].count}`);
    
  } catch (err) {
    console.error('Error querying database:', err);
  }

  process.exit(0);
}

audit();
