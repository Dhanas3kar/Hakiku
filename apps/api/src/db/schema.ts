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
  AnyPgColumn,
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
  suspendedUntil: timestamp('suspended_until'),
  suspensionReason: varchar('suspension_reason', { length: 500 }),
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

    // Profile Extras
    socialLinks: jsonb('social_links').default({}),

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
    idempotencyKey: varchar('idempotency_key', { length: 100 }),
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
    idempotencyIdx: uniqueIndex('idx_posts_idempotency').on(
      table.authorId,
      table.idempotencyKey,
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

// 5. Comments Table (Supports Nested Replies & Likes)
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, {
      onDelete: 'cascade',
    }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    likesCount: integer('likes_count').default(0).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    postCreatedIdx: index('idx_comments_post_created').on(
      table.postId,
      table.createdAt,
    ),
    parentIdx: index('idx_comments_parent').on(table.parentId),
    authorIdx: index('idx_comments_author').on(table.authorId),
  }),
);

// 6. Comment Likes Relationship Table
export const commentLikes = pgTable(
  'comment_likes',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.commentId, table.userId] }),
    userLikesIdx: index('idx_comment_likes_user').on(table.userId),
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
  'MENTION',
  'COMMUNITY_INVITE',
  'TEAM_JOIN_REQUEST',
  'TEAM_JOIN_ACCEPTED',
  'TEAM_JOIN_REJECTED',
  'TEAM_INVITATION_RECEIVED',
  'TEAM_INVITATION_ACCEPTED',
  'COLLABORATION_REQUEST',
  'COLLABORATION_ACCEPTED',
  'COLLABORATION_DECLINED',
  'TEAM_ROLE_MATCH',
  'HACKATHON_MATCH',
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
    eventId: varchar('event_id', { length: 255 }),
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
    eventIdIdx: uniqueIndex('idx_notifications_event_id').on(table.eventId),
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
    claimedAt: timestamp('claimed_at'),
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
    clearedAt: timestamp('cleared_at'),
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
    idempotencyKey: varchar('idempotency_key', { length: 100 }),
    deletedAt: timestamp('deleted_at'),
    deletedBy: uuid('deleted_by'),
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
    idempotencyIdx: uniqueIndex('idx_messages_idempotency').on(
      table.senderId,
      table.idempotencyKey,
    ),
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

// 5. Message Outbox Table (Durable Realtime Message Delivery)
export const messageOutbox = pgTable(
  'message_outbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: varchar('event_id', { length: 255 }).notNull().unique(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: outboxStatusEnum('status').default('PENDING').notNull(),
    availableAt: timestamp('available_at').defaultNow().notNull(),
    claimedAt: timestamp('claimed_at'),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    pendingProcessingIdx: index('idx_message_outbox_pending')
      .on(table.status, table.availableAt)
      .where(sql`${table.status} IN ('PENDING', 'PROCESSING')`),
    messageIdIdx: index('idx_message_outbox_message_id').on(table.messageId),
  }),
);

// 6. Message Read Receipts Table
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
  'MESSAGE',
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
    upvoteCount: integer('upvote_count').default(0).notNull(),
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

export const confessionUpvotes = pgTable(
  'confession_upvotes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    confessionId: uuid('confession_id')
      .notNull()
      .references(() => confessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    unq: uniqueIndex('idx_confession_upvotes_user_confession').on(
      table.confessionId,
      table.userId,
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
    snapshotContent: text('snapshot_content'),
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

// 7. Hot Take Votes Table
export const hotTakeVotes = pgTable(
  'hot_take_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    hotTakeId: uuid('hot_take_id')
      .notNull()
      .references(() => hotTakes.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    voteType: text('vote_type').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    uniqueUserVote: uniqueIndex('idx_unique_user_hot_take_vote').on(
      table.hotTakeId,
      table.userId,
    ),
    hotTakeIdx: index('idx_hot_take_votes_take_id').on(table.hotTakeId),
  }),
);

// --- PHASE 10: STUDENT COMMUNITIES, HACKATHON HUB & TEAM FORMATION ---

export const communityVisibilityEnum = pgEnum('community_visibility', [
  'PUBLIC',
  'PRIVATE',
]);

export const communityRoleEnum = pgEnum('community_role', [
  'OWNER',
  'MODERATOR',
  'MEMBER',
]);

export const communityChannelTypeEnum = pgEnum('community_channel_type', [
  'TEXT',
]);

export const hackathonModeEnum = pgEnum('hackathon_mode', [
  'ONLINE',
  'OFFLINE',
  'HYBRID',
]);

export const hackathonStatusEnum = pgEnum('hackathon_status', [
  'UPCOMING',
  'REGISTRATION_OPEN',
  'DEADLINE_SOON',
  'REGISTRATION_CLOSED',
  'ONGOING',
  'ENDED',
]);

export const teamStatusEnum = pgEnum('team_status', [
  'OPEN',
  'FULL',
  'CLOSED',
  'DISBANDED',
]);

export const teamRoleCategoryEnum = pgEnum('team_role_category', [
  'FRONTEND',
  'BACKEND',
  'AI_ML',
  'UI_UX',
  'DEVOPS',
  'PRODUCT',
  'RESEARCH',
  'BLOCKCHAIN',
  'DATA',
  'OTHER',
]);

export const teamRequestStatusEnum = pgEnum('team_request_status', [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
]);

export const teamInvitationStatusEnum = pgEnum('team_invitation_status', [
  'TEAM_INVITATION_PENDING',
  'TEAM_INVITATION_ACCEPTED',
  'TEAM_INVITATION_DECLINED',
  'TEAM_INVITATION_EXPIRED',
]);

// 1. Communities Table
export const communities = pgTable(
  'communities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    description: text('description'),
    avatarUrl: text('avatar_url'),
    bannerUrl: text('banner_url'),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    visibility: communityVisibilityEnum('visibility')
      .default('PUBLIC')
      .notNull(),
    category: varchar('category', { length: 100 }).default('General').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('idx_communities_slug').on(table.slug),
    ownerIdx: index('idx_communities_owner_id').on(table.ownerId),
    categoryVisibilityIdx: index('idx_communities_cat_vis').on(
      table.category,
      table.visibility,
    ),
  }),
);

// 2. Community Members Table
export const communityMembers = pgTable(
  'community_members',
  {
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: communityRoleEnum('role').default('MEMBER').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.communityId, table.userId] }),
    userCommunitiesIdx: index('idx_community_members_user').on(table.userId),
    communityRoleIdx: index('idx_community_members_comm_role').on(
      table.communityId,
      table.role,
    ),
  }),
);

// 3. Community Channels Table
export const communityChannels = pgTable(
  'community_channels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    type: communityChannelTypeEnum('type').default('TEXT').notNull(),
    description: text('description'),
    displayOrder: integer('display_order').default(0).notNull(),
    isPrivate: boolean('is_private').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    commSlugIdx: uniqueIndex('idx_community_channels_comm_slug').on(
      table.communityId,
      table.slug,
    ),
    displayOrderIdx: index('idx_community_channels_order').on(
      table.communityId,
      table.displayOrder,
    ),
  }),
);

// 4. Community Bans Table
export const communityBans = pgTable(
  'community_bans',
  {
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bannedBy: uuid('banned_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reason: text('reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.communityId, table.userId] }),
  }),
);

// 5. Community Moderation Events Table
export const communityModerationEvents = pgTable(
  'community_moderation_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    targetUserId: uuid('target_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    action: varchar('action', { length: 100 }).notNull(),
    reason: text('reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    commCreatedIdx: index('idx_community_mod_events_comm_created').on(
      table.communityId,
      table.createdAt,
    ),
  }),
);

// 6. Community Messages Table
export const communityMessages = pgTable(
  'community_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => communityChannels.id, { onDelete: 'cascade' }),
    communityId: uuid('community_id')
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    deletedAt: timestamp('deleted_at'),
    deletedBy: uuid('deleted_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    channelCreatedIdx: index('idx_community_messages_chan_created').on(
      table.channelId,
      table.createdAt,
    ),
  }),
);

// 7. Hackathons Table
export const hackathons = pgTable(
  'hackathons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: varchar('provider', { length: 100 }).default('MANUAL').notNull(),
    externalId: varchar('external_id', { length: 255 }),
    title: varchar('title', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    organizer: varchar('organizer', { length: 255 }).notNull(),
    description: text('description').notNull(),
    url: text('url').notNull(),
    registrationDeadline: timestamp('registration_deadline'),
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),
    mode: hackathonModeEnum('mode').default('ONLINE').notNull(),
    location: varchar('location', { length: 255 }),
    themes: jsonb('themes').default([]).notNull(),
    skills: jsonb('skills').default([]).notNull(),
    prizeInfo: text('prize_info'),
    canonicalStatus: hackathonStatusEnum('canonical_status')
      .default('UPCOMING')
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: uniqueIndex('idx_hackathons_slug').on(table.slug),
    providerExtIdx: index('idx_hackathons_provider_ext').on(
      table.provider,
      table.externalId,
    ),
    statusDeadlineIdx: index('idx_hackathons_status_deadline').on(
      table.canonicalStatus,
      table.registrationDeadline,
    ),
  }),
);

// 8. Hackathon Sync Runs Table
export const hackathonSyncRuns = pgTable('hackathon_sync_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: varchar('provider', { length: 100 }).notNull(),
  status: varchar('status', { length: 50 }).default('COMPLETED').notNull(),
  itemsProcessed: integer('items_processed').default(0).notNull(),
  itemsCreated: integer('items_created').default(0).notNull(),
  itemsUpdated: integer('items_updated').default(0).notNull(),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// 9. Hackathon Teams Table
export const hackathonTeams = pgTable(
  'hackathon_teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    hackathonId: uuid('hackathon_id')
      .notNull()
      .references(() => hackathons.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: teamStatusEnum('status').default('OPEN').notNull(),
    maxMembers: integer('max_members').default(4).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    hackathonStatusIdx: index('idx_hackathon_teams_hack_status').on(
      table.hackathonId,
      table.status,
    ),
    ownerIdx: index('idx_hackathon_teams_owner').on(table.ownerId),
  }),
);

// 10. Hackathon Team Members Table
export const hackathonTeamMembers = pgTable(
  'hackathon_team_members',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => hackathonTeams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleCategory: teamRoleCategoryEnum('role_category')
      .default('OTHER')
      .notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.teamId, table.userId] }),
    userTeamsIdx: index('idx_team_members_user').on(table.userId),
  }),
);

// 11. Hackathon Team Roles (Open Positions) Table
export const hackathonTeamRoles = pgTable(
  'hackathon_team_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => hackathonTeams.id, { onDelete: 'cascade' }),
    roleCategory: text('role_category').notNull(),
    title: varchar('title', { length: 100 }).notNull(),
    description: text('description'),
    isFilled: boolean('is_filled').default(false).notNull(),
    filledByUserId: uuid('filled_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    teamFilledIdx: index('idx_team_roles_team_filled').on(
      table.teamId,
      table.isFilled,
    ),
  }),
);

// 12. Team Join Requests Table
export const teamJoinRequests = pgTable(
  'team_join_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => hackathonTeams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleCategory: teamRoleCategoryEnum('role_category')
      .default('OTHER')
      .notNull(),
    message: text('message'),
    status: teamRequestStatusEnum('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    teamStatusIdx: index('idx_team_join_req_team_status').on(
      table.teamId,
      table.status,
    ),
    userStatusIdx: index('idx_team_join_req_user_status').on(
      table.userId,
      table.status,
    ),
  }),
);

// 13. Team Invitations Table
export const teamInvitations = pgTable(
  'team_invitations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => hackathonTeams.id, { onDelete: 'cascade' }),
    inviterId: uuid('inviter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    inviteeId: uuid('invitee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleCategory: teamRoleCategoryEnum('role_category')
      .default('OTHER')
      .notNull(),
    message: text('message'),
    status: teamInvitationStatusEnum('status')
      .default('TEAM_INVITATION_PENDING')
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    teamStatusIdx: index('idx_team_inv_team_status').on(
      table.teamId,
      table.status,
    ),
    inviteeStatusIdx: index('idx_team_inv_invitee_status').on(
      table.inviteeId,
      table.status,
    ),
  }),
);

// --- PHASE 11: STUDENT COLLABORATION INTELLIGENCE LAYER ---

export const collaborationIntentEnum = pgEnum('collaboration_intent', [
  'LOOKING_FOR_TEAMMATES',
  'OPEN_TO_COLLABORATION',
  'JUST_EXPLORING',
]);

export const availabilityEnum = pgEnum('availability', [
  'WEEKDAYS',
  'WEEKENDS',
  'FLEXIBLE',
]);

export const collaborationRequestStatusEnum = pgEnum('collaboration_request_status', [
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'CANCELLED',
  'EXPIRED',
]);

// 1. Skill Aliases Table (Canonical Normalization Registry)
export const skillAliases = pgTable(
  'skill_aliases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    alias: varchar('alias', { length: 50 }).notNull(),
    normalizedAlias: varchar('normalized_alias', { length: 50 }).notNull().unique(),
    canonicalSkillId: uuid('canonical_skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    normalizedAliasIdx: uniqueIndex('idx_skill_aliases_normalized').on(table.normalizedAlias),
    canonicalSkillIdx: index('idx_skill_aliases_canonical').on(table.canonicalSkillId),
  }),
);

// 2. User Skills Join Table
export const userSkills = pgTable(
  'user_skills',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.skillId] }),
    userSkillIdx: index('idx_user_skills_user').on(table.userId, table.skillId),
    skillUserIdx: index('idx_user_skills_skill').on(table.skillId, table.userId),
  }),
);

// 3. User Interests Join Table
export const userInterests = pgTable(
  'user_interests',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    interestId: uuid('interest_id')
      .notNull()
      .references(() => interests.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.interestId] }),
    userInterestIdx: index('idx_user_interests_user').on(table.userId, table.interestId),
    interestUserIdx: index('idx_user_interests_interest').on(table.interestId, table.userId),
  }),
);

// 4. Collaboration Preferences Table
export const collaborationPreferences = pgTable(
  'collaboration_preferences',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    intent: collaborationIntentEnum('intent').default('OPEN_TO_COLLABORATION').notNull(),
    availability: availabilityEnum('availability').default('FLEXIBLE').notNull(),
    lookingForRoles: jsonb('looking_for_roles').default([]).notNull(),
    preferredHackathonThemes: jsonb('preferred_hackathon_themes').default([]).notNull(),
    bio: text('bio'),
    isDiscoverable: boolean('is_discoverable').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    discoverableIntentIdx: index('idx_collab_pref_disc_intent').on(
      table.isDiscoverable,
      table.intent,
    ),
  }),
);

// 5. Collaboration Requests Table
export const collaborationRequests = pgTable(
  'collaboration_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    hackathonId: uuid('hackathon_id').references(() => hackathons.id, { onDelete: 'set null' }),
    message: text('message'),
    status: collaborationRequestStatusEnum('status').default('PENDING').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    targetStatusIdx: index('idx_collab_req_target_status').on(
      table.targetUserId,
      table.status,
      table.createdAt,
    ),
    senderStatusIdx: index('idx_collab_req_sender_status').on(
      table.senderId,
      table.status,
      table.createdAt,
    ),
    hackathonIdx: index('idx_collab_req_hackathon').on(table.hackathonId),
    senderTargetUnique: uniqueIndex('idx_collab_req_sender_target_pending')
      .on(table.senderId, table.targetUserId)
      .where(sql`${table.status} = 'PENDING'`),
    noSelfRequestCheck: check('no_self_collaboration_request', sql`${table.senderId} <> ${table.targetUserId}`),
  }),
);

