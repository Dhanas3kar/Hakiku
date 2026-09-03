import { db } from '../../db/index';
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';
import * as schema from '../../db/schema';
import { FeedCandidateService } from './feed-candidate.service';
import { FeedVisibilityService } from './feed-visibility.service';
import { FeedRankingService } from './feed-ranking.service';
import { FeedCursorService } from './feed-cursor.service';
import { FeedQueryService } from './feed-query.service';
import { FeedQueryDto, DiscoverQueryDto } from '../dto/feed.dto';

@Injectable()
export class FeedService {
  private db;

  constructor(
    private readonly candidateService: FeedCandidateService,
    private readonly visibilityService: FeedVisibilityService,
    private readonly rankingService: FeedRankingService,
    private readonly cursorService: FeedCursorService,
    private readonly queryService: FeedQueryService,
  ) {
    this.db = db;
  }

  /**
   * Verify that active authenticated student is requesting feed.
   */
  private async verifyActiveViewer(viewerId: string) {
    const [viewer] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, viewerId))
      .limit(1);

    if (!viewer) {
      throw new UnauthorizedException('User account not found or session invalid');
    }

    if (viewer.status !== 'ACTIVE') {
      throw new ForbiddenException(
        `Account is ${(viewer.status || '').toLowerCase()} and cannot retrieve feed`,
      );
    }

    return viewer;
  }

  /**
   * Phase 4 optimized personalized feed.
   *
   * Roundtrip 1: Viewer Context + Candidate Post IDs (concurrent)
   * Roundtrip 2: Hydration + Relationship Matrix + Likes + Media + Polls (concurrent)
   * Then: Ranking + Cursor Pagination (in-memory)
   *
   * Total DB roundtrips: 2 (down from ~8 sequential roundtrips / 23 queries)
   */
  async getPersonalizedFeed(viewerId: string, query: FeedQueryDto) {
    await this.verifyActiveViewer(viewerId);

    const limit = Math.min(query.limit || 20, 50);
    const decodedCursor = query.cursor
      ? this.cursorService.decode(query.cursor)
      : undefined;

    // ── Roundtrip 1: Viewer Context & Candidate IDs (Concurrent) ──
    const viewerContext = await this.queryService.getViewerContext(viewerId);

    const candidatePostIds = await this.candidateService.getPersonalizedCandidates(
      viewerId,
      {
        campus: viewerContext.campus,
        department: viewerContext.department,
        batchYear: viewerContext.batchYear,
      },
    );

    if (candidatePostIds.length === 0) {
      return { data: [], pagination: { nextCursor: null, hasMore: false } };
    }

    // ── Roundtrip 2: Consolidated Hydration + Visibility ──
    // hydrateCandidatePosts now handles visibility/block filtering inline
    const eligibleHydrated = await this.queryService.hydrateCandidatePosts(
      viewerId,
      candidatePostIds,
    );

    // ── In-Memory: Ranking & Cursor Filtering ──
    const rankedItems = this.rankingService.rankFeedItems(
      eligibleHydrated,
      viewerContext,
      decodedCursor,
    );

    // ── Pagination Slicing ──
    const hasMore = rankedItems.length > limit;
    const pageItems = hasMore ? rankedItems.slice(0, limit) : rankedItems;

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = this.cursorService.encode(
        lastItem.score,
        lastItem.post.createdAt,
        lastItem.post.id,
      );
    }

    // Format final JSON response
    const formattedData = pageItems.map((item) => ({
      id: item.post.id,
      authorId: item.post.authorId,
      content: item.post.content,
      visibility: item.post.visibility,
      likesCount: item.post.likesCount,
      commentsCount: item.post.commentsCount,
      createdAt: item.post.createdAt,
      media: (item.post as any).media || [],
      poll: (item.post as any).poll || null,
      author: {
        id: item.author.userId,
        userId: item.author.userId,
        username: item.author.username,
        displayName: item.author.displayName,
        avatarUrl: item.author.avatarUrl,
        campus: item.author.campus,
        department: item.author.department,
      },
      isLikedByViewer: item.viewerState?.isLiked || false,
    }));

    return {
      data: formattedData,
      pagination: {
        nextCursor,
        hasMore,
      },
    };
  }

  /**
   * Orchestrate public discovery feed with optional academic & taxonomy filters.
   */
  async getDiscoveryFeed(viewerId: string, query: DiscoverQueryDto) {
    await this.verifyActiveViewer(viewerId);

    const limit = Math.min(query.limit || 20, 50);
    const decodedCursor = query.cursor
      ? this.cursorService.decode(query.cursor)
      : undefined;

    // 1. Discovery Candidate Generation
    const candidatePostIds = await this.candidateService.getDiscoveryCandidates(
      viewerId,
      query,
    );
    if (candidatePostIds.length === 0) {
      return { data: [], pagination: { nextCursor: null, hasMore: false } };
    }

    // 2. Consolidated Hydration (includes visibility filtering)
    const eligibleHydrated = await this.queryService.hydrateCandidatePosts(
      viewerId,
      candidatePostIds,
    );

    // 3. Ranking & Cursor Filtering
    const viewerContext = await this.queryService.getViewerContext(viewerId);
    const rankedItems = this.rankingService.rankFeedItems(
      eligibleHydrated,
      viewerContext,
      decodedCursor,
    );

    // 4. Pagination Slicing
    const hasMore = rankedItems.length > limit;
    const pageItems = hasMore ? rankedItems.slice(0, limit) : rankedItems;

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      nextCursor = this.cursorService.encode(
        lastItem.score,
        lastItem.post.createdAt,
        lastItem.post.id,
      );
    }

    const formattedData = pageItems.map((item) => ({
      id: item.post.id,
      authorId: item.post.authorId,
      content: item.post.content,
      visibility: item.post.visibility,
      likesCount: item.post.likesCount,
      commentsCount: item.post.commentsCount,
      createdAt: item.post.createdAt,
      media: (item.post as any).media || [],
      poll: (item.post as any).poll || null,
      author: {
        id: item.author.userId,
        userId: item.author.userId,
        username: item.author.username,
        displayName: item.author.displayName,
        avatarUrl: item.author.avatarUrl,
        campus: item.author.campus,
        department: item.author.department,
      },
      isLikedByViewer: item.viewerState?.isLiked || false,
    }));

    return {
      data: formattedData,
      pagination: {
        nextCursor,
        hasMore,
      },
    };
  }
}
