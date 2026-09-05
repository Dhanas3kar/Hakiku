import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import * as path from 'path';

async function runMigrations() {
  console.log('[migrate] Connecting to database...');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[migrate] DATABASE_URL is not set.');
    process.exit(1);
  }

  const migrationClient = postgres(databaseUrl, { max: 1 });
  const db = drizzle(migrationClient);

  try {
    console.log('[migrate] Running drizzle migrations...');
    await migrate(db, { migrationsFolder: path.join(__dirname, '../drizzle') });
    console.log('[migrate] Drizzle migrations applied.');

    console.log('[migrate] Running custom idempotent schema extensions...');
    await db.execute(sql`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE typname = 'report_target_type' AND enumlabel = 'MESSAGE') THEN
          ALTER TYPE report_target_type ADD VALUE 'MESSAGE';
        END IF;
      END $$;
      ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS cleared_at TIMESTAMP;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by UUID;
      ALTER TABLE community_reports ADD COLUMN IF NOT EXISTS snapshot_content TEXT;
      ALTER TABLE polls ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES posts(id) ON DELETE CASCADE;
      CREATE TABLE IF NOT EXISTS hot_takes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE hot_takes ADD COLUMN IF NOT EXISTS "date" TEXT;
      ALTER TABLE hot_takes ADD COLUMN IF NOT EXISTS "place" TEXT;
      ALTER TABLE hot_takes ADD COLUMN IF NOT EXISTS "time" TEXT;
      ALTER TABLE hot_takes ADD COLUMN IF NOT EXISTS "media" TEXT;
      ALTER TABLE hot_takes ADD COLUMN IF NOT EXISTS "other_details" TEXT;
      CREATE INDEX IF NOT EXISTS idx_hot_takes_author_created ON hot_takes(author_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_hot_takes_created_at ON hot_takes(created_at);
      CREATE INDEX IF NOT EXISTS idx_polls_post_id ON polls(post_id);
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE IF NOT EXISTS comment_likes (
        comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (comment_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON comment_likes(user_id);
      CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
    `);
    console.log('[migrate] Custom schema extensions applied.');
    console.log('[migrate] Migration process complete.');
  } catch (error) {
    console.error('[migrate] Migration failed', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
