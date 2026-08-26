import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
  text,
  jsonb,
  primaryKey,
  check,
  index,
  uniqueIndex,
  integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const roleEnum = pgEnum('role', ['STUDENT', 'MODERATOR', 'ADMIN']);

export const statusEnum = pgEnum('status', [
  'ACTIVE',
  'SUSPENDED',
  'BANNED',
  'DEACTIVATED',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  studentId: varchar('student_id', { length: 50 }).unique(),
  isVerified: boolean('is_verified').default(false).notNull(),
  emailVerifiedAt: timestamp('email_verified_at'),
  role: roleEnum('role').default('STUDENT').notNull(),
  status: statusEnum('status').default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const authSessionStatus = pgEnum('session_status', [
  'ACTIVE',
  'ROTATED',
  'REVOKED',
]);
export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenFamilyId: uuid('token_family_id').notNull(),
  hashedRefreshToken: varchar('hashed_refresh_token', {
    length: 255,
  }).notNull(),
  status: authSessionStatus('status').default('ACTIVE').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  rotatedAt: timestamp('rotated_at'),
});

export const eventEnum = pgEnum('event', [
  'OTP_SENT',
  'OTP_VERIFIED',
  'OTP_FAILED',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'TOKEN_REFRESHED',
  // Admin events
  'ADMIN_LOGIN',
  'ADMIN_LOGOUT',
  'ADMIN_MODERATE_POST',
  'ADMIN_MODERATE_COMMENT',
  'ADMIN_MODERATE_HOT_TAKE',
  'USER_SUSPENDED',
  'USER_BANNED',
  'REPORT_RESOLVED',
  'REPORT_DISMISSED',
]);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  event: eventEnum('event').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const adminCredentials = pgTable('admin_credentials', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// --- PHASE 3: NETWORKING & RELATIONSHIPS ---

export const connectionRequestStatusEnum = pgEnum('connection_request_status', [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
]);

// 1. Follows Table (Unidirectional)
export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followingId: uuid('following_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.followerId, table.followingId] }),
    followingIdx: index('idx_follows_following_id').on(table.followingId),
    noSelfFollow: check(
      'no_self_follow',
      sql`${table.followerId} <> ${table.followingId}`,
    ),
  }),
);

// 2. Connection Requests Table (Request History & Active Pending Constraints)
export const connectionRequests = pgTable(
  'connection_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    receiverId: uuid('receiver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: connectionRequestStatusEnum('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    uniquePendingRequest: uniqueIndex('unique_pending_connection_request')
      .on(table.senderId, table.receiverId)
      .where(sql`${table.status} = 'PENDING'`),
    receiverStatusIdx: index('idx_connection_requests_receiver_status').on(
      table.receiverId,
      table.status,
    ),
    senderStatusIdx: index('idx_connection_requests_sender_status').on(
      table.senderId,
      table.status,
    ),
    noSelfConnectionRequest: check(
      'no_self_connection_request',
      sql`${table.senderId} <> ${table.receiverId}`,
    ),
  }),
);

// 3. Connections Table (Sole Source of Truth for Active Mutual Connections)
export const connections = pgTable(
  'connections',
  {
    userAId: uuid('user_a_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userBId: uuid('user_b_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userAId, table.userBId] }),
    userAIdx: index('idx_connections_user_a').on(table.userAId),
    userBIdx: index('idx_connections_user_b').on(table.userBId),
    canonicalOrder: check(
      'canonical_user_order',
      sql`${table.userAId} < ${table.userBId}`,
    ),
  }),
);

// 4. Blocks Table (Unidirectional Isolation)
export const blocks = pgTable(
  'blocks',
  {
    blockerId: uuid('blocker_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid('blocked_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.blockerId, table.blockedId] }),
    blockedIdx: index('idx_blocks_blocked_id').on(table.blockedId),
    noSelfBlock: check(
      'no_self_block',
      sql`${table.blockerId} <> ${table.blockedId}`,
    ),
  }),
);

// --- PHASE 4: STUDENT IDENTITY & PROFILE ---

export const profileVisibilityEnum = pgEnum('profile_visibility', [
  'PUBLIC',
  'CONNECTIONS_ONLY',
  'PRIVATE',
]);

// 1. Profiles Table
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' })
      .unique(),
    username: varchar('username', { length: 30 }).notNull().unique(),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    bio: text('bio'),
    avatarKey: text('avatar_key'),
    coverKey: text('cover_key'),

    // Academic Identity
    campus: varchar('campus', { length: 50 }).notNull(),
    department: varchar('department', { length: 100 }).notNull(),
    degreeProgram: varchar('degree_program', { length: 50 }).notNull(),
    batchYear: integer('batch_year').notNull(),
    graduationYear: integer('graduation_year').notNull(),

    // Visibility & Completion
    visibility: profileVisibilityEnum('visibility').default('PUBLIC').notNull(),
    isProfileCompleted: boolean('is_profile_completed')
      .default(false)
      .notNull(),
    completionPercentage: integer('completion_percentage').default(0).notNull(),

    // System Identity
    isVerifiedIdentity: boolean('is_verified_identity').default(false).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    usernameLowerIdx: uniqueIndex('idx_profiles_username_lower').on(
      sql`lower(${table.username})`,
    ),
    campusDeptIdx: index('idx_profiles_campus_dept').on(
      table.campus,
      table.department,
    ),
    batchGradIdx: index('idx_profiles_batch_grad').on(
      table.batchYear,
      table.graduationYear,
    ),
    validUsernameCheck: check(
      'valid_username_format',
      sql`${table.username} ~ '^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$'`,
    ),
  }),
);

// 2. Normalized Skills Table
export const skills = pgTable(
  'skills',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    category: varchar('category', { length: 50 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    nameLowerIdx: uniqueIndex('idx_skills_name_lower').on(
      sql`lower(${table.name})`,
    ),
  }),
);

// 3. Profile Skills Join Table
export const profileSkills = pgTable(
  'profile_skills',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileId, table.skillId] }),
  }),
);

// 4. Normalized Interests Table
export const interests = pgTable(
  'interests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 50 }).notNull().unique(),
    category: varchar('category', { length: 50 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    nameLowerIdx: uniqueIndex('idx_interests_name_lower').on(
      sql`lower(${table.name})`,
    ),
  }),
);

// 5. Profile Interests Join Table
export const profileInterests = pgTable(
  'profile_interests',
  {
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    interestId: uuid('interest_id')
      .notNull()
      .references(() => interests.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.profileId, table.interestId] }),
  }),
);

// --- PHASE 5: POSTS, MEDIA, LIKES & COMMENTS ---

export const postVisibilityEnum = pgEnum('post_visibility', [
  'PUBLIC',
  'CONNECTIONS_ONLY',
  'PRIVATE',
]);
export const mediaTypeEnum = pgEnum('media_type', ['IMAGE', 'VIDEO']);

// 1. Posts Table
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content'),
    visibility: postVisibilityEnum('visibility').default('PUBLIC').notNull(),
    likesCount: integer('likes_count').default(0).notNull(),
    commentsCount: integer('comments_count').default(0).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    authorCreatedIdx: index('idx_posts_author_created').on(
      table.authorId,
      table.createdAt,
    ),
    createdAtIdx: index('idx_posts_created_at').on(table.createdAt),
    activePostsIdx: index('idx_posts_active').on(
      table.authorId,
      table.deletedAt,
    ),
    likesCountCheck: check(
      'check_likes_count_positive',
      sql`${table.likesCount} >= 0`,
    ),
    commentsCountCheck: check(
      'check_comments_count_positive',
      sql`${table.commentsCount} >= 0`,
    ),
  }),
);

// 2. Post Media Attachments Table
export const postMedia = pgTable(
  'post_media',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    mediaType: mediaTypeEnum('media_type').notNull(),
    storageKey: text('storage_key').notNull(),
    mimeType: varchar('mime_type', { length: 50 }).notNull(),
    fileSize: integer('file_size').notNull(),
    width: integer('width'),
    height: integer('height'),
    durationSeconds: integer('duration_seconds'),
    displayOrder: integer('display_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    postOrderIdx: index('idx_post_media_order').on(
      table.postId,
      table.displayOrder,
    ),
    fileSizeCheck: check(
      'check_file_size_positive',
      sql`${table.fileSize} > 0`,
    ),
    displayOrderCheck: check(
      'check_display_order_positive',
      sql`${table.displayOrder} >= 0`,
    ),
  }),
);

// 3. Staged / Pending Media Uploads Table (Enforces Media Ownership)
export const pendingMediaUploads = pgTable(
  'pending_media_uploads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    mediaType: mediaTypeEnum('media_type').notNull(),
    mimeType: varchar('mime_type', { length: 50 }).notNull(),
    fileSize: integer('file_size').notNull(),
    width: integer('width'),
    height: integer('height'),
    durationSeconds: integer('duration_seconds'),
    isAttached: boolean('is_attached').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userAttachedIdx: index('idx_pending_media_user_attached').on(
      table.userId,
      table.isAttached,
    ),
  }),
);

// 4. Post Likes Relationship Table (Source of Truth for Likes)
export const postLikes = pgTable(
  'post_likes',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.postId, table.userId] }),
    userLikesIdx: index('idx_post_likes_user').on(table.userId),
  }),
);

// 5. Flat Comments Table
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    postCreatedIdx: index('idx_comments_post_created').on(
      table.postId,
      table.createdAt,
    ),
    authorIdx: index('idx_comments_author').on(table.authorId),
  }),
);

// --- PHASE 7: NOTIFICATIONS & REAL-TIME DELIVERY ---

export const notificationTypeEnum = pgEnum('notification_type', [
  'FOLLOW',
  'CONNECTION_REQUEST',
  'CONNECTION_ACCEPTED',
  'POST_LIKE',
  'POST_COMMENT',
  'COMMENT_REPLY',
  'SYSTEM',
  'MESSAGE',
]);

export const outboxStatusEnum = pgEnum('outbox_status', [
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED',
]);

// 1. Notifications Table (User Inbox)
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    type: notificationTypeEnum('type').notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }).notNull(),
    payload: jsonb('payload').default({}).notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    recipientInboxIdx: index('idx_notifications_recipient_inbox').on(
      table.recipientId,
      table.createdAt,
    ),
    recipientUnreadIdx: index('idx_notifications_recipient_unread').on(
      table.recipientId,
      table.isRead,
    ),
  }),
);

// 2. Notification Events Table (Idempotency Registry)
export const notificationEvents = pgTable('notification_events', {
  eventId: varchar('event_id', { length: 255 }).primaryKey(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Notification Outbox Table (Durable Event Delivery)
export const notificationOutbox = pgTable(
  'notification_outbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: varchar('event_id', { length: 255 }).notNull().unique(),
    type: notificationTypeEnum('type').notNull(),
    payload: jsonb('payload').notNull(),
    status: outboxStatusEnum('status').default('PENDING').notNull(),
    availableAt: timestamp('available_at').defaultNow().notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    pendingProcessingIdx: index('idx_notification_outbox_pending')
      .on(table.status, table.availableAt)
      .where(sql`${table.status} IN ('PENDING', 'PROCESSING')`),
  }),
);

// 4. Notification Preferences Table (User Settings)
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: varchar('category', { length: 50 }).notNull(), // e.g., 'POST_ENGAGEMENT', 'NETWORK'
    isEmailEnabled: boolean('is_email_enabled').default(true).notNull(),
    isPushEnabled: boolean('is_push_enabled').default(true).notNull(),
    isInAppEnabled: boolean('is_in_app_enabled').default(true).notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.category] }),
  }),
);

// --- PHASE 8: REAL-TIME MESSAGING & CONVERSATIONS ---

export const messageTypeEnum = pgEnum('message_type', [
  'TEXT',
  'IMAGE',
  'VIDEO',
  'FILE',
  'SYSTEM',
]);

// 1. Conversations Table
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userAId: uuid('user_a_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userBId: uuid('user_b_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastMessageAt: timestamp('last_message_at'),
    lastMessageId: uuid('last_message_id'), // Will self-reference messages.id, handled via application
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    canonicalOrder: check(
      'canonical_conversation_order',
      sql`${table.userAId} < ${table.userBId}`,
    ),
    uniqueParticipants: uniqueIndex('idx_conversations_unique_participants').on(
      table.userAId,
      table.userBId,
    ),
  }),
);

// 2. Conversation Participants Table (Access & Read Status)
export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
    lastReadMessageId: uuid('last_read_message_id'),
    lastReadAt: timestamp('last_read_at'),
    isArchived: boolean('is_archived').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversationId, table.userId] }),
    userUpdatedIdx: index('idx_conversation_participants_user_updated').on(
      table.userId,
      table.lastReadAt,
    ), // Helps unread counts
  }),
);

// 3. Messages Table
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content'),
    messageType: messageTypeEnum('message_type').default('TEXT').notNull(),
    replyToMessageId: uuid('reply_to_message_id'), // Self-reference skipped here for simplicity to avoid circular dep at runtime setup, or use explicit relation
    deletedAt: timestamp('deleted_at'),
    editedAt: timestamp('edited_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    convoCreatedIdIdx: index('idx_messages_conversation_created_id').on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
    senderCreatedIdx: index('idx_messages_sender_created').on(
      table.senderId,
      table.createdAt,
    ),
    replyIdx: index('idx_messages_reply_to').on(table.replyToMessageId),
  }),
);

// 4. Message Media Attachments Table
export const messageMedia = pgTable(
  'message_media',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    mimeType: varchar('mime_type', { length: 50 }).notNull(),
    fileSize: integer('file_size').notNull(),
    width: integer('width'),
    height: integer('height'),
    durationSeconds: integer('duration_seconds'),
    displayOrder: integer('display_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    messageOrderIdx: index('idx_message_media_order').on(
      table.messageId,
      table.displayOrder,
    ),
    fileSizeCheck: check(
      'check_message_file_size_positive',
      sql`${table.fileSize} > 0`,
    ),
    displayOrderCheck: check(
      'check_message_display_order_positive',
      sql`${table.displayOrder} >= 0`,
    ),
  }),
);

// 5. Message Read Receipts Table
export const messageReadReceipts = pgTable(
  'message_read_receipts',
  {
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.messageId, table.userId] }),
  }),
);

// --- PHASE 9: COMMUNITY, CAMPUS CULTURE & SOCIAL DISCOVERY ---

export const confessionStatusEnum = pgEnum('confession_status', [
  'DRAFT',
  'PENDING_MODERATION',
  'PUBLISHED',
  'REJECTED',
  'REMOVED',
  'EXPIRED',
]);
export const pollStatusEnum = pgEnum('poll_status', [
  'PUBLISHED',
  'CLOSED',
  'REMOVED',
]);
export const reportStatusEnum = pgEnum('report_status', [
  'PENDING',
  'REVIEWED',
  'RESOLVED',
  'DISMISSED',
]);
export const reportTargetTypeEnum = pgEnum('report_target_type', [
  'CONFESSION',
  'POLL',
  'POST',
  'COMMENT',
  'USER',
  'HOT_TAKE',
]);

// 1. Confessions Table
export const confessions = pgTable(
  'confessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    campus: varchar('campus', { length: 50 }),
    status: confessionStatusEnum('status')
      .default('PENDING_MODERATION')
      .notNull(),
    publishedAt: timestamp('published_at'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    statusPublishedIdx: index('idx_confessions_status_published').on(
      table.status,
      table.publishedAt,
    ),
    campusPublishedIdx: index('idx_confessions_campus_published').on(
      table.campus,
      table.publishedAt,
    ),
  }),
);

// 2. Polls Table
export const polls = pgTable(
  'polls',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    isMultipleChoice: boolean('is_multiple_choice').default(false).notNull(),
    campus: varchar('campus', { length: 50 }),
    status: pollStatusEnum('status').default('PUBLISHED').notNull(),
    endsAt: timestamp('ends_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    statusCreatedIdx: index('idx_polls_status_created').on(
      table.status,
      table.createdAt,
    ),
    endsAtIdx: index('idx_polls_ends_at').on(table.endsAt),
    postIdx: index('idx_polls_post_id').on(table.postId),
  }),
);

// 3. Poll Options Table
export const pollOptions = pgTable(
  'poll_options',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    text: varchar('text', { length: 255 }).notNull(),
    voteCount: integer('vote_count').default(0).notNull(),
  },
  (table) => ({
    voteCountCheck: check(
      'check_poll_vote_count_positive',
      sql`${table.voteCount} >= 0`,
    ),
  }),
);

// 4. Poll Votes Table
export const pollVotes = pgTable(
  'poll_votes',
  {
    pollId: uuid('poll_id')
      .notNull()
      .references(() => polls.id, { onDelete: 'cascade' }),
    optionId: uuid('option_id')
      .notNull()
      .references(() => pollOptions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.pollId, table.optionId, table.userId] }),
  }),
);

// 5. Community Reports Table
export const communityReports = pgTable(
  'community_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: reportTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    reason: text('reason').notNull(),
    status: reportStatusEnum('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    targetTypeStatusCreatedIdx: index('idx_reports_type_status_created').on(
      table.targetType,
      table.status,
      table.createdAt,
    ),
    noSelfReportConfession: check(
      'no_self_report_confession',
      sql`${table.targetType} != 'USER' OR ${table.reporterId} != ${table.targetId}`,
    ),
  }),
);

// 6. Hot Takes Table
export const hotTakes = pgTable(
  'hot_takes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    date: text('date'),
    place: text('place'),
    time: text('time'),
    media: text('media'),
    otherDetails: text('other_details'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    authorCreatedIdx: index('idx_hot_takes_author_created').on(
      table.authorId,
      table.createdAt,
    ),
    createdAtIdx: index('idx_hot_takes_created_at').on(table.createdAt),
  }),
);
