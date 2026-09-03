import { db } from '../src/db/index';
import {
  users,
  profiles,
  authSessions,
  auditLogs,
  notifications,
  notificationOutbox,
  notificationEvents,
  notificationPreferences,
  conversations,
  conversationParticipants,
  messages,
  messageMedia,
  messageReadReceipts,
  follows,
  connectionRequests,
  connections,
  blocks,
  skills,
  profileSkills,
  interests,
  profileInterests,
  posts,
  postMedia,
  pendingMediaUploads,
  postLikes,
  comments,
  confessions,
  polls,
  pollOptions,
  pollVotes,
  communityReports,
} from '../src/db/schema';

export function ensureTestDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set. Refusing to run destructive tests.');
  }
  
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`NODE_ENV is not set to 'test' (currently '${process.env.NODE_ENV}'). Refusing to run destructive tests.`);
  }

  const isTestDb = dbUrl.includes('_test') || dbUrl.includes('test_db') || dbUrl.endsWith('/test');
  if (!isTestDb) {
    throw new Error(`DATABASE_URL does not explicitly indicate a test environment (e.g., must contain '_test'). Current URL: ${dbUrl}. Refusing to run destructive tests.`);
  }
  
  if (dbUrl.includes('srm_connect') && !dbUrl.includes('srm_connect_test')) {
    throw new Error(`DATABASE_URL appears to target the development database. Refusing to run destructive tests.`);
  }
}

export async function clearTestDatabase() {
  ensureTestDatabase();

  // Clear tables in reverse dependency order
  await db.delete(communityReports);
  await db.delete(pollVotes);
  await db.delete(pollOptions);
  await db.delete(polls);
  await db.delete(confessions);
  
  await db.delete(comments);
  await db.delete(postLikes);
  await db.delete(pendingMediaUploads);
  await db.delete(postMedia);
  await db.delete(posts);

  await db.delete(profileInterests);
  await db.delete(interests);
  await db.delete(profileSkills);
  await db.delete(skills);

  await db.delete(blocks);
  await db.delete(connections);
  await db.delete(connectionRequests);
  await db.delete(follows);

  await db.delete(messageReadReceipts);
  await db.delete(messageMedia);
  await db.delete(messages);
  await db.delete(conversationParticipants);
  await db.delete(conversations);

  await db.delete(notificationPreferences);
  await db.delete(notificationEvents);
  await db.delete(notificationOutbox);
  await db.delete(notifications);
  
  await db.delete(auditLogs);
  await db.delete(authSessions);
  await db.delete(profiles);
  await db.delete(users);
}

export function getE2eJwtSignOptions() {
  const issuer = process.env.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE;

  if (!issuer || !audience) {
    throw new Error('JWT_ISSUER and JWT_AUDIENCE are required for E2E tests');
  }

  return { issuer, audience };
}
