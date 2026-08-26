import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test if it exists, otherwise it will just use process.env
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Hardcode a fallback test DB if not provided, to ensure we NEVER hit dev DB
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://srm_admin:srm_password@localhost:5432/srm_connect_test';
}

// Force test environment
process.env.NODE_ENV = 'test';
