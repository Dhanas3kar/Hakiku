import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';
dotenv.config();

let connectionString = process.env.DATABASE_URL;

if (process.env.NODE_ENV === 'test') {
  if (connectionString && !connectionString.includes('_test')) {
    connectionString = connectionString.replace('/srm_connect', '/srm_connect_test');
    process.env.DATABASE_URL = connectionString;
  }
}

if (!connectionString) {
  throw new Error('DATABASE_URL is strictly required. No fallbacks allowed.');
}

if (process.env.NODE_ENV === 'test' && !connectionString.includes('_test')) {
  throw new Error(`DATABASE_URL (${connectionString}) does not appear to be a test database. Refusing to connect in test environment.`);
}

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, {
  prepare: false,
  max: 2,
  idle_timeout: 5,
});
export const db = drizzle(client, { schema });
