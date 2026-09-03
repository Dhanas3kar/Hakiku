import 'dotenv/config';
import postgres from 'postgres';

async function checkSchema() {
  const sql = postgres(process.env.DATABASE_URL!);
  const result = await sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'posts' 
      AND column_name = 'idempotency_key';
  `;
  console.log('Exists:', result.length > 0);
  process.exit(0);
}
checkSchema();
