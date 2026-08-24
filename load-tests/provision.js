const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5433/srm_connect';
const client = postgres(connectionString, { max: 5 });

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-that-should-be-changed';
const TOTAL_USERS = 10000;
const BATCH_SIZE = 1000;

async function provision() {
  console.log(`[Provision] Starting provision of ${TOTAL_USERS} users...`);
  
  // Cleanup old load test users
  console.log(`[Provision] Cleaning up old load test users...`);
  await client`DELETE FROM users WHERE email LIKE 'loadtest%@srmist.edu.in'`;

  const tokens = [];

  for (let i = 0; i < TOTAL_USERS; i += BATCH_SIZE) {
    console.log(`[Provision] Processing batch ${i} to ${i + BATCH_SIZE}...`);
    
    const usersData = [];
    const profilesData = [];

    for (let j = 0; j < BATCH_SIZE; j++) {
      const index = i + j;
      const id = uuidv4();
      const email = `loadtest${index}@srmist.edu.in`;
      const role = 'STUDENT';
      
      usersData.push({ id, email, role, is_verified: true, created_at: new Date() });
      profilesData.push({
        id: uuidv4(),
        user_id: id,
        display_name: `Load Test User ${index}`,
        username: `loadtest_${index}`,
        department: 'Load Test Dept',
        batch_year: 2026,
        campus: 'KTR',
        degree_program: 'B.Tech',
        graduation_year: 2030,
        is_profile_completed: true,
        is_verified_identity: true,
        created_at: new Date()
      });

      // Generate token
      const token = jwt.sign(
        { sub: id, email, role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );
      tokens.push(token);
    }

    // Batch insert Users
    await client`
      INSERT INTO users ${client(usersData, 'id', 'email', 'role', 'is_verified', 'created_at')}
      ON CONFLICT (email) DO NOTHING
    `;

    // Batch insert Profiles
    await client`
      INSERT INTO profiles ${client(profilesData, 'id', 'user_id', 'display_name', 'username', 'department', 'batch_year', 'campus', 'degree_program', 'graduation_year', 'is_profile_completed', 'is_verified_identity', 'created_at')}
      ON CONFLICT (username) DO NOTHING
    `;
  }

  const tokensFile = path.join(__dirname, 'tokens.json');
  fs.writeFileSync(tokensFile, JSON.stringify(tokens, null, 2));
  console.log(`[Provision] Completed! Wrote ${tokens.length} tokens to ${tokensFile}`);
  
  await client.end();
}

provision().catch(console.error);
