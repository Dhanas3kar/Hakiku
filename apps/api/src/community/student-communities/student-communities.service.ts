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

  // --- COMMUNITY CORE ---

  async createCommunity(userId: string, dto: CreateCommunityDto) {
    const rawSlug = dto.slug || this.generateSlug(dto.name);
    const slug = rawSlug || `community-${Date.now()}`;

    // Check slug uniqueness
    const [existing] = await db
      .select()
      .from(communities)
      .where(eq(communities.slug, slug))
      .limit(1);
    if (existing) {
      throw new ConflictException('A community with this slug already exists.');
    }

    return await db.transaction(async (tx) => {
      // 1. Create Community
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

      // 2. Add Owner as OWNER in community_members
      await tx.insert(communityMembers).values({
        communityId: newCommunity.id,
        userId,
        role: 'OWNER',
      });

      // 3. Create default channels: #general and #announcements
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
      const page = Number(dto?.page) || 1;
      const limit = Number(dto?.limit) || 20;
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
      const memberships = await db
        .select()
        .from(communityMembers)
        .where(eq(communityMembers.userId, userId))
        .orderBy(desc(communityMembers.joinedAt));

      if (memberships.length === 0) return [];

      const communityIds = memberships.map((m) => m.communityId);
      const commList = await db
        .select()
        .from(communities)
        .where(inArray(communities.id, communityIds));

      const roleMap = new Map(memberships.map((m) => [m.communityId, m.role]));

      return commList.map((c) => ({
        ...c,
        userRole: roleMap.get(c.id) || 'MEMBER',
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
    const member = await this.requireMemberRole(communityId, userId, ['OWNER']);

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

    await db.delete(communities).where(eq(communities.id, communityId));
    return { success: true, message: 'Community deleted successfully' };
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

    await db.insert(communityMembers).values({
      communityId,
      userId,
      role: 'MEMBER',
    });

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

  async getMembers(communityId: string, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const memberList = await db
      .select({
        userId: users.id,
        role: communityMembers.role,
        joinedAt: communityMembers.joinedAt,
        profile: {
          fullName: profiles.displayName,
          avatarUrl: profiles.avatarKey,
          bio: profiles.bio,
          department: profiles.department,
        },
      })
      .from(communityMembers)
      .innerJoin(users, eq(users.id, communityMembers.userId))
      .leftJoin(profiles, eq(profiles.userId, communityMembers.userId))
      .where(eq(communityMembers.communityId, communityId))
      .orderBy(asc(communityMembers.joinedAt))
      .limit(limit)
      .offset(offset);

    return memberList;
  }

  async updateMemberRole(
    actorId: string,
    communityId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.requireMemberRole(communityId, actorId, ['OWNER']);

    if (actorId === targetUserId) {
      throw new BadRequestException('Cannot change your own owner role directly');
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
    await this.requireMemberRole(communityId, actorId, ['OWNER', 'MODERATOR']);

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
          reason: dto.reason,
        })
        .returning();

      return ban;
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

    const [existing] = await db
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
      throw new ConflictException('A channel with this name/slug already exists');
    }

    const [channel] = await txInsertChannel(communityId, dto, slug);
    return channel;
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

    if (community.visibility === 'PRIVATE') {
      await this.requireMembership(communityId, userId);
    }

    const offset = (page - 1) * limit;

    const messageList = await db
      .select({
        id: communityMessages.id,
        channelId: communityMessages.channelId,
        communityId: communityMessages.communityId,
        senderId: communityMessages.senderId,
        content: communityMessages.content,
        createdAt: communityMessages.createdAt,
        senderName: profiles.displayName,
        senderAvatar: profiles.avatarKey,
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
      .limit(limit)
      .offset(offset);

    return messageList;
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

    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, communityId))
      .limit(1);

    if (!community) {
      throw new NotFoundException('Community not found');
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
      if (community.visibility === 'PUBLIC') {
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
      throw new NotFoundException('Channel not found');
    }

    const [message] = await db
      .insert(communityMessages)
      .values({
        channelId,
        communityId,
        senderId,
        content: dto.content,
      })
      .returning();

    // Broadcast realtime event
    await this.publishEvent('community_events', {
      type: 'community:message:new',
      communityId,
      channelId,
      payload: message,
    });

    return message;
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

async function txInsertChannel(communityId: string, dto: CreateChannelDto, slug: string) {
  return db
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
}
