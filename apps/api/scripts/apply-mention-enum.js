require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('ERROR: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Running ALTER TYPE for notification_type...');
    // We add MENTION to the ENUM if it does not exist.
    await client.query(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'MENTION'`);
    
    console.log('Successfully added MENTION to notification_type enum.');
    
    // As a bonus, ensure connectx@gmail.com is an official verified identity.
    console.log('Ensuring connectx@gmail.com is verified identity...');
    const result = await client.query(`
      UPDATE profiles 
      SET "isVerifiedIdentity" = true,
          "username" = 'hakiku_official',
          "displayName" = 'HAKIKU Official'
      WHERE "userId" = (SELECT id FROM users WHERE email = 'connectx@gmail.com')
    `);
    
    if (result.rowCount && result.rowCount > 0) {
      console.log('Updated connectx@gmail.com to verified identity.');
    } else {
      console.log('connectx@gmail.com not found or already verified (or query failed silently).');
    }

  } catch (error) {
    console.error('Database migration failed:', error);
  } finally {
    await client.end();
  }
}

main();
