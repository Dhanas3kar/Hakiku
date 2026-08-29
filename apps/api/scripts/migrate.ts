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
