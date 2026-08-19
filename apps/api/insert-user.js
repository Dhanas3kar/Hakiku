const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: 'postgres://postgres:postgres@127.0.0.1:5433/srm_connect' });
  await client.connect();
  await client.query("INSERT INTO users (email, role, is_verified) VALUES ('attacker@srmist.edu.in', 'STUDENT', true) ON CONFLICT DO NOTHING;");
  await client.end();
}

run();
