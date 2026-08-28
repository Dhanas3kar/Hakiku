import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test if it exists, otherwise it will just use process.env.
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const testDatabaseUrl = 'postgres://postgres:postgres@127.0.0.1:5433/srm_connect_test';

// Force the repo's isolated test database even when a local dev .env is present.
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('_test')) {
  process.env.DATABASE_URL = testDatabaseUrl;
}

// Force test environment
process.env.NODE_ENV = 'test';
