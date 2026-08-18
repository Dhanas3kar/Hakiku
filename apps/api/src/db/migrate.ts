import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function main() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: join(__dirname, '../../drizzle') });
  console.log('Migrations complete!');
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
