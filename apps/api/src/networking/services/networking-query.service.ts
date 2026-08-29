import { db } from '../../db/index';
import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, and, or, sql, desc, lt } from 'drizzle-orm';
import * as schema from '../../db/schema';
import {
  follows,
  connections,
  connectionRequests,
  blocks,
  users,
} from '../../db/schema';
import { BlockService } from './block.service';
import { RelationshipStatusResponse } from '../dto/networking.dto';

interface CursorData {
  createdAt: string;
  id?: string;
  followerId?: string;
  followingId?: string;
  userAId?: string;
  userBId?: string;
  blockedId?: string;
}

@Injectable()
export class NetworkingQueryService {
  private db;

  constructor(private readonly blockService: BlockService) {
    this.db = db;
  }

  private encodeCursor(data: CursorData): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private decodeCursor(cursor: string): CursorData {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    } catch {
      throw new Error('Invalid cursor format');
    }
  }

  async getFollowers(userId: string, limit: number = 20, cursor?: string) {
    const conditions = [eq(follows.followingId, userId)];

    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      conditions.push(
        sql`(${follows.createdAt}, ${follows.followerId}) < (${new Date(decoded.createdAt)}, ${decoded.followerId})`,
      );
    }

    const rows = await this.db
      .select({
        followerId: follows.followerId,
        createdAt: follows.createdAt,
        followerEmail: users.email,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(follows.createdAt), desc(follows.followerId))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      nextCursor = this.encodeCursor({
        createdAt: last.createdAt.toISOString(),
        followerId: last.followerId,
      });
    }

    return { data, pagination: { nextCursor, hasMore } };
  }

  async getFollowing(userId: string, limit: number = 20, cursor?: string) {
    const conditions = [eq(follows.followerId, userId)];

    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      conditions.push(
        sql`(${follows.createdAt}, ${follows.followingId}) < (${new Date(decoded.createdAt)}, ${decoded.followingId})`,
      );
    }

    const rows = await this.db
      .select({
        followingId: follows.followingId,
        createdAt: follows.createdAt,
        followingEmail: users.email,
      })
      .from(follows)
      .innerJoin(users, eq(follows.followingId, users.id))
      .where(and(...conditions))
      .orderBy(desc(follows.createdAt), desc(follows.followingId))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      nextCursor = this.encodeCursor({
        createdAt: last.createdAt.toISOString(),
        followingId: last.followingId,
      });
    }

    return { data, pagination: { nextCursor, hasMore } };
  }

  async getConnections(userId: string, limit: number = 20, cursor?: string) {
    const conditions = [
      or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
    ];

    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      conditions.push(
        sql`(${connections.createdAt}, ${connections.userAId}, ${connections.userBId}) < (${new Date(decoded.createdAt)}, ${decoded.userAId}, ${decoded.userBId})`,
      );
    }

    const rows = await this.db
      .select({
        userAId: connections.userAId,
        userBId: connections.userBId,
        createdAt: connections.createdAt,
      })
      .from(connections)
      .where(and(...conditions))
      .orderBy(
        desc(connections.createdAt),
        desc(connections.userAId),
        desc(connections.userBId),
      )
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const rawData = hasMore ? rows.slice(0, limit) : rows;

    const data = rawData.map((row: any) => ({
      connectedUserId: row.userAId === userId ? row.userBId : row.userAId,
      createdAt: row.createdAt,
    }));

    let nextCursor: string | null = null;
    if (hasMore && rawData.length > 0) {
      const last = rawData[rawData.length - 1];
      nextCursor = this.encodeCursor({
        createdAt: last.createdAt.toISOString(),
        userAId: last.userAId,
        userBId: last.userBId,
      });
    }

    return { data, pagination: { nextCursor, hasMore } };
  }

  async getPendingIncomingRequests(
    userId: string,
    limit: number = 20,
    cursor?: string,
  ) {
    const conditions = [
      eq(connectionRequests.receiverId, userId),
      eq(connectionRequests.status, 'PENDING'),
    ];

    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      conditions.push(
        sql`(${connectionRequests.createdAt}, ${connectionRequests.id}) < (${new Date(decoded.createdAt)}, ${decoded.id})`,
      );
    }

    const rows = await this.db
      .select({
        requestId: connectionRequests.id,
        senderId: connectionRequests.senderId,
        senderEmail: users.email,
        createdAt: connectionRequests.createdAt,
      })
      .from(connectionRequests)
      .innerJoin(users, eq(connectionRequests.senderId, users.id))
      .where(and(...conditions))
      .orderBy(desc(connectionRequests.createdAt), desc(connectionRequests.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      nextCursor = this.encodeCursor({
        createdAt: last.createdAt.toISOString(),
        id: last.requestId,
      });
    }

    return { data, pagination: { nextCursor, hasMore } };
  }

  async getPendingOutgoingRequests(
    userId: string,
    limit: number = 20,
    cursor?: string,
  ) {
    const conditions = [
      eq(connectionRequests.senderId, userId),
      eq(connectionRequests.status, 'PENDING'),
    ];

    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      conditions.push(
        sql`(${connectionRequests.createdAt}, ${connectionRequests.id}) < (${new Date(decoded.createdAt)}, ${decoded.id})`,
      );
    }

    const rows = await this.db
      .select({
        requestId: connectionRequests.id,
        receiverId: connectionRequests.receiverId,
        receiverEmail: users.email,
        createdAt: connectionRequests.createdAt,
      })
      .from(connectionRequests)
      .innerJoin(users, eq(connectionRequests.receiverId, users.id))
      .where(and(...conditions))
      .orderBy(desc(connectionRequests.createdAt), desc(connectionRequests.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      nextCursor = this.encodeCursor({
        createdAt: last.createdAt.toISOString(),
        id: last.requestId,
      });
    }

    return { data, pagination: { nextCursor, hasMore } };
  }

  async getBlockedUsers(userId: string, limit: number = 20, cursor?: string) {
    const conditions = [eq(blocks.blockerId, userId)];

    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      conditions.push(
        sql`(${blocks.createdAt}, ${blocks.blockedId}) < (${new Date(decoded.createdAt)}, ${decoded.blockedId})`,
      );
    }

    const rows = await this.db
      .select({
        blockedId: blocks.blockedId,
        blockedEmail: users.email,
        createdAt: blocks.createdAt,
      })
      .from(blocks)
      .innerJoin(users, eq(blocks.blockedId, users.id))
      .where(and(...conditions))
      .orderBy(desc(blocks.createdAt), desc(blocks.blockedId))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && data.length > 0) {
      const last = data[data.length - 1];
      nextCursor = this.encodeCursor({
        createdAt: last.createdAt.toISOString(),
        blockedId: last.blockedId,
      });
    }

    return { data, pagination: { nextCursor, hasMore } };
  }

  async getRelationshipStatus(
    currentUserId: string,
    targetUserId: string,
  ): Promise<RelationshipStatusResponse> {
    // 1. Block Privacy Interceptor
    if (
      await this.blockService.isBlockedByTarget(currentUserId, targetUserId)
    ) {
      throw new NotFoundException('User not found');
    }

    const isBlockedByMe = await this.blockService.isBlockedByMe(
      currentUserId,
      targetUserId,
    );
    if (isBlockedByMe) {
      return {
        targetUserId,
        isFollowing: false,
        isFollowedBy: false,
        connectionStatus: 'NONE',
        isBlockedByMe: true,
      };
    }

    // 2. Check Follows (both directions)
    const followRows = await this.db
      .select()
      .from(follows)
      .where(
        or(
          and(
            eq(follows.followerId, currentUserId),
            eq(follows.followingId, targetUserId),
          ),
          and(
            eq(follows.followerId, targetUserId),
            eq(follows.followingId, currentUserId),
          ),
        ),
      );

    const isFollowing = followRows.some(
      (r: any) =>
        r.followerId === currentUserId && r.followingId === targetUserId,
    );
    const isFollowedBy = followRows.some(
      (r: any) =>
        r.followerId === targetUserId && r.followingId === currentUserId,
    );

    // 3. Check Active Connection in `connections`
    const minId = currentUserId < targetUserId ? currentUserId : targetUserId;
    const maxId = currentUserId < targetUserId ? targetUserId : currentUserId;

    const connectionRow = await this.db
      .select()
      .from(connections)
      .where(
        and(eq(connections.userAId, minId), eq(connections.userBId, maxId)),
      )
      .limit(1);

    let connectionStatus:
      'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'CONNECTED' = 'NONE';
    let pendingRequestId: string | undefined;

    if (connectionRow.length > 0) {
      connectionStatus = 'CONNECTED';
    } else {
      // Check Pending Requests
      const pendingReq = await this.db
        .select()
        .from(connectionRequests)
        .where(
          and(
            eq(connectionRequests.status, 'PENDING'),
            or(
              and(
                eq(connectionRequests.senderId, currentUserId),
                eq(connectionRequests.receiverId, targetUserId),
              ),
              and(
                eq(connectionRequests.senderId, targetUserId),
                eq(connectionRequests.receiverId, currentUserId),
              ),
            ),
          ),
        )
        .limit(1);

      if (pendingReq.length > 0) {
        const req = pendingReq[0];
        pendingRequestId = req.id;
        connectionStatus =
          req.senderId === currentUserId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
      }
    }

    return {
      targetUserId,
      isFollowing,
      isFollowedBy,
      connectionStatus,
      pendingRequestId,
      isBlockedByMe: false,
    };
  }
}
