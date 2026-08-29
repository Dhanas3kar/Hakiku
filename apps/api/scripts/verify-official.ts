import { db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function verify() {
  try {
    const profiles = await db.select().from(schema.profiles).where(eq(schema.profiles.username, 'hakiku_official'));
    console.log('profiles.length=', profiles.length);
    if (profiles.length === 0) {
      console.log('No profile found for hakiku_official');
      process.exit(2);
    }
    const p = profiles[0];
    console.log(JSON.stringify({
      id: p.id,
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      isVerifiedIdentity: p.isVerifiedIdentity,
      visibility: p.visibility,
    }, null, 2));

    // fetch user email
    const users = await db.select().from(schema.users).where(eq(schema.users.id, p.userId));
    console.log('users.length=', users.length);
    if (users.length > 0) {
      console.log('email=', users[0].email);
    }
    process.exit(0);
  } catch (err) {
    console.error('verify error', err);
    process.exit(1);
  }
}

verify();
