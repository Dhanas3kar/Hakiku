import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { db } from '../../db';
import {
  communities,
  communityMembers,
  communityChannels,
  communityBans,
  communityModerationEvents,
  communityMessages,
  users,
  profiles,
} from '../../db/schema';
import { eq, and, sql, desc, asc, ilike, count, inArray } from 'drizzle-orm';
import { Redis } from 'ioredis';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  CreateChannelDto,
  UpdateChannelDto,
  UpdateMemberRoleDto,
  BanMemberDto,
  SendChannelMessageDto,
  QueryCommunitiesDto,
} from './dto/student-communities.dto';

@Injectable()
export class StudentCommunitiesService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private formatAvatarUrl(key?: string | null): string | null {
    if (!key) return null;
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    return `${baseUrl}/uploads/${key}`;
  }

  // --- COMMUNITY CORE ---

  async createCommunity(userId: string, dto: CreateCommunityDto) {
    const rawSlug = dto.slug || this.generateSlug(dto.name);
    const slug = rawSlug || `community-${Date.now()}`;

    return await db.transaction(async (tx) => {
      // 1. Check slug uniqueness inside transaction
      const [existing] = await tx
        .select()
        .from(communities)
        .where(eq(communities.slug, slug))
        .limit(1);

      if (existing) {
        throw new ConflictException('A community with this slug already exists.');
      }

      // 2. Create Community
      const [newCommunity] = await tx
        .insert(communities)
        .values({
          name: dto.name,
          slug,
          description: dto.description || null,
          avatarUrl: dto.avatarUrl || null,
          bannerUrl: dto.bannerUrl || null,
          ownerId: userId,
          visibility: dto.visibility || 'PUBLIC',
          category: dto.category || 'General',
        })
        .returning();

      // 3. Add Owner as OWNER in community_members
      await tx.insert(communityMembers).values({
        communityId: newCommunity.id,
        userId,
        role: 'OWNER',
      });

      // 4. Create default channels: #general and #announcements
      await tx.insert(communityChannels).values([
        {
          communityId: newCommunity.id,
          name: 'general',
          slug: 'general',
          type: 'TEXT',
          description: 'General discussion channel',
          displayOrder: 0,
        },
        {
          communityId: newCommunity.id,
          name: 'announcements',
          slug: 'announcements',
          type: 'TEXT',
          description: 'Official announcements and updates',
          displayOrder: 1,
        },
      ]);

      return {
        ...newCommunity,
        role: 'OWNER',
        memberCount: 1,
      };
    });
  }

  async getCommunities(userId: string | undefined, dto: QueryCommunitiesDto) {
    try {
      const page = Math.max(1, Number(dto?.page) || 1);
      const limit = Math.min(Math.max(1, Number(dto?.limit) || 20), 100);
      const offset = (page - 1) * limit;

      const conditions = [];
      if (dto?.search && typeof dto.search === 'string' && dto.search.trim()) {
        conditions.push(ilike(communities.name, `%${dto.search.trim()}%`));
      }
      if (dto?.category && typeof dto.category === 'string' && dto.category.trim()) {
        conditions.push(eq(communities.category, dto.category.trim()));
      }
      if (dto?.visibility) {
        conditions.push(eq(communities.visibility, dto.visibility));
      }

      const items = conditions.length > 0
        ? await db
            .select()
            .from(communities)
            .where(and(...conditions))
            .orderBy(desc(communities.createdAt))
            .limit(limit)
            .offset(offset)
        : await db
            .select()
            .from(communities)
            .orderBy(desc(communities.createdAt))
            .limit(limit)
            .offset(offset);

      const [totalRes] = conditions.length > 0
        ? await db
            .select({ count: sql<number>`count(*)::int` })
            .from(communities)
            .where(and(...conditions))
        : await db
            .select({ count: sql<number>`count(*)::int` })
            .from(communities);
      const total = Number(totalRes?.count || 0);

      if (items.length === 0) {
        return { items: [], total: 0, page, limit };
      }

      const communityIds = items.map((c) => c.id);

      // Get member counts for these communities
      const memberCounts = await db
        .select({
          communityId: communityMembers.communityId,
          count: sql<number>`count(*)::int`,
        })
        .from(communityMembers)
        .where(inArray(communityMembers.communityId, communityIds))
        .groupBy(communityMembers.communityId);

      const countMap = new Map(memberCounts.map((m) => [m.communityId, Number(m.count)]));

      // Get user's membership roles in these communities if userId is present
      const userMemberships = userId
        ? await db
            .select()
            .from(communityMembers)
            .where(
              and(
                inArray(communityMembers.communityId, communityIds),
                eq(communityMembers.userId, userId),
              ),
            )
        : [];

      const userRoleMap = new Map(userMemberships.map((m) => [m.communityId, m.role]));

      const enrichedItems = items.map((item) => ({
        ...item,
        memberCount: countMap.get(item.id) || 0,
        userRole: userRoleMap.get(item.id) || null,
        isMember: userRoleMap.has(item.id),
      }));

      return {
        items: enrichedItems,
        total,
        page,
        limit,
      };
    } catch (error) {
      console.error('[StudentCommunitiesService.getCommunities Error]:', error);
      throw error;
    }
  }

  async getMyCommunities(userId: string | undefined) {
    if (!userId) return [];
    try {
      const items = await db
        .select({
          id: communities.id,
          name: communities.name,
          slug: communities.slug,
          description: communities.description,
          avatarUrl: communities.avatarUrl,
          bannerUrl: communities.bannerUrl,
          ownerId: communities.ownerId,
          visibility: communities.visibility,
          category: communities.category,
          createdAt: communities.createdAt,
          updatedAt: communities.updatedAt,
          userRole: communityMembers.role,
        })
        .from(communityMembers)
        .innerJoin(communities, eq(communities.id, communityMembers.communityId))
        .where(eq(communityMembers.userId, userId))
        .orderBy(desc(communityMembers.joinedAt));

      return items.map((item) => ({
        ...item,
        isMember: true,
      }));
    } catch (error) {
      console.error('[StudentCommunitiesService.getMyCommunities Error]:', error);
      throw error;
    }
  }

  async getCommunityByIdOrSlug(userId: string | undefined, idOrSlug: string) {
    const [community] = await db
      .select()
      .from(communities)
      .where(
        idOrSlug.includes('-') && !idOrSlug.includes('00000000')
          ? eq(communities.slug, idOrSlug)
          : eq(communities.id, idOrSlug),
      )
      .limit(1);

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    // Check membership
    const [membership] = userId
      ? await db
          .select()
          .from(communityMembers)
          .where(
            and(
              eq(communityMembers.communityId, community.id),
              eq(communityMembers.userId, userId),
            ),
          )
          .limit(1)
      : [undefined];

    // Check ban status
    const [ban] = userId
      ? await db
          .select()
          .from(communityBans)
          .where(
            and(
              eq(communityBans.communityId, community.id),
              eq(communityBans.userId, userId),
            ),
          )
          .limit(1)
      : [undefined];

    if (ban) {
      throw new ForbiddenException('You have been banned from this community');
    }

    if (community.visibility === 'PRIVATE' && !membership) {
      throw new ForbiddenException('This is a private community. Membership required.');
    }

    // Get channels
    const channels = await db
      .select()
      .from(communityChannels)
      .where(eq(communityChannels.communityId, community.id))
      .orderBy(asc(communityChannels.displayOrder), asc(communityChannels.createdAt));

    // Member count
    const [memberCountRes] = await db
      .select({ count: count() })
      .from(communityMembers)
      .where(eq(communityMembers.communityId, community.id));

    return {
      ...community,
      userRole: membership?.role || null,
      isMember: Boolean(membership),
      memberCount: Number(memberCountRes?.count || 0),
      channels,
    };
  }

  async updateCommunity(userId: string, communityId: string, dto: UpdateCommunityDto) {
    await this.requireMemberRole(communityId, userId, ['OWNER']);

    const [updated] = await db
      .update(communities)
      .set({
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.bannerUrl !== undefined && { bannerUrl: dto.bannerUrl }),
        ...(dto.visibility && { visibility: dto.visibility }),
        ...(dto.category && { category: dto.category }),
        updatedAt: new Date(),
      })
      .where(eq(communities.id, communityId))
      .returning();

    return updated;
  }

  async deleteCommunity(userId: string, communityId: string) {
    await this.requireMemberRole(communityId, userId, ['OWNER']);

    await db.transaction(async (tx) => {
      await tx.delete(communities).where(eq(communities.id, communityId));
    });

    await this.publishEvent('community_events', {
      type: 'community:deleted',
      communityId,
    });

    return { success: true, message: 'Community deleted successfully' };
  }

  async transferOwnership(actorId: string, communityId: string, targetUserId: string) {
    if (actorId === targetUserId) {
      throw new BadRequestException('You are already the owner of this community');
    }

    await this.requireMemberRole(communityId, actorId, ['OWNER']);

    const [targetMember] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, targetUserId),
        ),
      )
      .limit(1);

    if (!targetMember) {
      throw new BadRequestException('Target user must be an active member of the community to receive ownership');
    }

    await db.transaction(async (tx) => {
      // 1. Demote actor to MODERATOR
      await tx
        .update(communityMembers)
        .set({ role: 'MODERATOR' })
        .where(
          and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, actorId),
          ),
        );

      // 2. Promote target to OWNER
      await tx
        .update(communityMembers)
        .set({ role: 'OWNER' })
        .where(
          and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, targetUserId),
          ),
        );

      // 3. Update community ownerId
      await tx
        .update(communities)
        .set({ ownerId: targetUserId, updatedAt: new Date() })
        .where(eq(communities.id, communityId));

      // 4. Log moderation event
      await tx.insert(communityModerationEvents).values({
        communityId,
        actorId,
        targetUserId,
        action: 'OWNERSHIP_TRANSFERRED',
        reason: 'Ownership transferred by community owner',
      });
    });

    await this.publishEvent('community_events', {
      type: 'community:ownership:transferred',
      communityId,
      previousOwnerId: actorId,
      newOwnerId: targetUserId,
    });

    return { success: true, message: 'Ownership transferred successfully' };
  }

  // --- MEMBERSHIP & ROLES ---

  async joinCommunity(userId: string, communityId: string) {
    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, communityId))
      .limit(1);

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.visibility === 'PRIVATE') {
      throw new ForbiddenException('Cannot freely join private community');
    }

    // Check ban
    const [ban] = await db
      .select()
      .from(communityBans)
      .where(
        and(
          eq(communityBans.communityId, communityId),
          eq(communityBans.userId, userId),
        ),
      )
      .limit(1);

    if (ban) {
      throw new ForbiddenException('You are banned from joining this community');
    }

    const [existing] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      return { success: true, message: 'Already a member', role: existing.role };
    }

    await db
      .insert(communityMembers)
      .values({
        communityId,
        userId,
        role: 'MEMBER',
      })
      .onConflictDoNothing();

    // Broadcast realtime member joined event
    await this.publishEvent('community_events', {
      type: 'community:member:joined',
      communityId,
      userId,
    });

    return { success: true, message: 'Joined community successfully', role: 'MEMBER' };
  }

  async leaveCommunity(userId: string, communityId: string) {
    const [membership] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new BadRequestException('Not a member of this community');
    }

    if (membership.role === 'OWNER') {
      throw new BadRequestException(
        'Community owner cannot leave without transferring ownership first.',
      );
    }

    await db
      .delete(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, userId),
        ),
      );

    await this.publishEvent('community_events', {
      type: 'community:member:left',
      communityId,
      userId,
    });

    return { success: true, message: 'Left community successfully' };
  }

  async getMembers(requesterId: string | undefined, communityId: string, page = 1, limit = 50) {
    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, communityId))
      .limit(1);

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    if (community.visibility === 'PRIVATE') {
      await this.requireMembership(communityId, requesterId);
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const offset = (safePage - 1) * safeLimit;

    const memberList = await db
      .select({
        userId: users.id,
        role: communityMembers.role,
        joinedAt: communityMembers.joinedAt,
        profile: {
          fullName: profiles.displayName,
          username: profiles.username,
          avatarKey: profiles.avatarKey,
          bio: profiles.bio,
          department: profiles.department,
        },
      })
      .from(communityMembers)
      .innerJoin(users, eq(users.id, communityMembers.userId))
      .leftJoin(profiles, eq(profiles.userId, communityMembers.userId))
      .where(eq(communityMembers.communityId, communityId))
      .orderBy(asc(communityMembers.joinedAt))
      .limit(safeLimit)
      .offset(offset);

    return memberList.map((m) => ({
      ...m,
      profile: m.profile
        ? {
            fullName: m.profile.fullName,
            username: m.profile.username,
            avatarUrl: this.formatAvatarUrl(m.profile.avatarKey),
            bio: m.profile.bio,
            department: m.profile.department,
          }
        : null,
    }));
  }

  async updateMemberRole(
    actorId: string,
    communityId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.requireMemberRole(communityId, actorId, ['OWNER']);

    if (dto.role === 'OWNER') {
      throw new BadRequestException('Use the /transfer-ownership endpoint to transfer community ownership');
    }

    if (actorId === targetUserId) {
      throw new BadRequestException('Cannot change your own role directly');
    }

    const [updated] = await db
      .update(communityMembers)
      .set({ role: dto.role })
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, targetUserId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException('Target user is not a member of this community');
    }

    return updated;
  }

  async banMember(
    actorId: string,
    communityId: string,
    targetUserId: string,
    dto: BanMemberDto,
  ) {
    const actorMember = await this.requireMemberRole(communityId, actorId, ['OWNER', 'MODERATOR']);

    if (actorId === targetUserId) {
      throw new BadRequestException('Cannot ban yourself');
    }

    // Check target's role
    const [targetMembership] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, targetUserId),
        ),
      )
      .limit(1);

    if (targetMembership?.role === 'OWNER') {
      throw new ForbiddenException('Cannot ban community owner');
    }

    if (actorMember.role === 'MODERATOR' && targetMembership?.role === 'MODERATOR') {
      throw new ForbiddenException('Moderators cannot ban other moderators');
    }

    return await db.transaction(async (tx) => {
      // 1. Remove from members
      await tx
        .delete(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, targetUserId),
          ),
        );

      // 2. Insert into bans
      const [ban] = await tx
        .insert(communityBans)
        .values({
          communityId,
          userId: targetUserId,
          bannedBy: actorId,
          reason: dto.reason || null,
        })
        .onConflictDoNothing()
        .returning();

      // 3. Insert moderation log event
      await tx.insert(communityModerationEvents).values({
        communityId,
        actorId,
        targetUserId,
        action: 'MEMBER_BANNED',
        reason: dto.reason || null,
      });

      return ban || { communityId, userId: targetUserId, bannedBy: actorId, reason: dto.reason || null };
    });
  }

  // --- CHANNELS & MESSAGES ---

  async createChannel(
    actorId: string,
    communityId: string,
    dto: CreateChannelDto,
  ) {
    await this.requireMemberRole(communityId, actorId, ['OWNER', 'MODERATOR']);

    const slug = dto.slug || this.generateSlug(dto.name);
    if (!slug) {
      throw new BadRequestException('Channel name must produce a valid slug');
    }

    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(communityChannels)
        .where(
          and(
            eq(communityChannels.communityId, communityId),
            eq(communityChannels.slug, slug),
          ),
        )
        .limit(1);

      if (existing) {
        throw new ConflictException('A channel with this name/slug already exists in this community');
      }

      const [channel] = await tx
        .insert(communityChannels)
        .values({
          communityId,
          name: dto.name,
          slug,
          type: dto.type || 'TEXT',
          description: dto.description || null,
          isPrivate: dto.isPrivate || false,
        })
        .returning();

      return channel;
    });
  }

  async getChannelMessages(
    userId: string | undefined,
    communityId: string,
    channelId: string,
    page = 1,
    limit = 50,
  ) {
    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, communityId))
      .limit(1);

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const [channel] = await db
      .select()
      .from(communityChannels)
      .where(
        and(
          eq(communityChannels.id, channelId),
          eq(communityChannels.communityId, communityId),
        ),
      )
      .limit(1);

    if (!channel) {
      throw new NotFoundException('Channel not found in this community');
    }

    if (community.visibility === 'PRIVATE' || channel.isPrivate) {
      await this.requireMembership(communityId, userId);
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const offset = (safePage - 1) * safeLimit;

    const messageList = await db
      .select({
        id: communityMessages.id,
        channelId: communityMessages.channelId,
        communityId: communityMessages.communityId,
        senderId: communityMessages.senderId,
        content: communityMessages.content,
        createdAt: communityMessages.createdAt,
        senderName: profiles.displayName,
        senderAvatarKey: profiles.avatarKey,
      })
      .from(communityMessages)
      .leftJoin(profiles, eq(profiles.userId, communityMessages.senderId))
      .where(
        and(
          eq(communityMessages.channelId, channelId),
          eq(communityMessages.communityId, communityId),
        ),
      )
      .orderBy(asc(communityMessages.createdAt))
      .limit(safeLimit)
      .offset(offset);

    return messageList.map((msg) => ({
      id: msg.id,
      channelId: msg.channelId,
      communityId: msg.communityId,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: msg.createdAt,
      senderName: msg.senderName,
      senderAvatar: this.formatAvatarUrl(msg.senderAvatarKey),
    }));
  }

  async sendChannelMessage(
    senderId: string,
    communityId: string,
    channelId: string,
    dto: SendChannelMessageDto,
  ) {
    if (!senderId) {
      throw new ForbiddenException('Authentication required');
    }

    if (!dto.content || !dto.content.trim()) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, communityId))
      .limit(1);

    if (!community) {
      throw new NotFoundException('Community not found');
    }

    const [channel] = await db
      .select()
      .from(communityChannels)
      .where(
        and(
          eq(communityChannels.id, channelId),
          eq(communityChannels.communityId, communityId),
        ),
      )
      .limit(1);

    if (!channel) {
      throw new NotFoundException('Channel not found in this community');
    }

    const [ban] = await db
      .select()
      .from(communityBans)
      .where(
        and(
          eq(communityBans.communityId, communityId),
          eq(communityBans.userId, senderId),
        ),
      )
      .limit(1);

    if (ban) {
      throw new ForbiddenException('Banned users cannot post messages');
    }

    const [membership] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, senderId),
        ),
      )
      .limit(1);

    if (!membership) {
      if (community.visibility === 'PUBLIC' && !channel.isPrivate) {
        // Auto-join public community on sending first message
        await db.insert(communityMembers).values({
          communityId,
          userId: senderId,
          role: 'MEMBER',
        }).onConflictDoNothing();
      } else {
        throw new ForbiddenException('You must be a member of this community to post messages');
      }
    }

    const [message] = await db
      .insert(communityMessages)
      .values({
        channelId,
        communityId,
        senderId,
        content: dto.content.trim(),
      })
      .returning();

    const [senderProfile] = await db
      .select({
        displayName: profiles.displayName,
        avatarKey: profiles.avatarKey,
      })
      .from(profiles)
      .where(eq(profiles.userId, senderId))
      .limit(1);

    const fullMessage = {
      ...message,
      senderName: senderProfile?.displayName || 'Student Member',
      senderAvatar: this.formatAvatarUrl(senderProfile?.avatarKey),
    };

    // Broadcast realtime event
    await this.publishEvent('community_events', {
      type: 'community:message:new',
      communityId,
      channelId,
      payload: fullMessage,
    });

    return fullMessage;
  }

  // --- HELPER GUARDS & REUSABLES ---

  async requireMembership(communityId: string, userId: string | undefined) {
    if (!userId) {
      throw new ForbiddenException('Authentication required');
    }

    const [membership] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException('You must be a member of this community');
    }
    return membership;
  }

  async requireMemberRole(
    communityId: string,
    userId: string,
    allowedRoles: Array<'OWNER' | 'MODERATOR' | 'MEMBER'>,
  ) {
    const membership = await this.requireMembership(communityId, userId);
    if (!allowedRoles.includes(membership.role as any)) {
      throw new ForbiddenException('Insufficient community permissions');
    }
    return membership;
  }

  private async publishEvent(channel: string, payload: any) {
    try {
      await this.redis.publish(channel, JSON.stringify(payload));
    } catch (err) {
      console.error(`[StudentCommunitiesService] Redis publish error on ${channel}:`, err);
    }
  }
}
