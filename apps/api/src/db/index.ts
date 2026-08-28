import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@127.0.0.1:5433/srm_connect';

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, {
  prepare: false,
  max: 2,
  idle_timeout: 5,
});
export const db = drizzle(client, { schema });
