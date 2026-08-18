import { FeedRankingService, FeedItemContext, ViewerContext } from './feed-ranking.service';

describe('FeedRankingService (Unit)', () => {
  let rankingService: FeedRankingService;

  beforeEach(() => {
    rankingService = new FeedRankingService();
  });

  const now = new Date();

  const viewerContext: ViewerContext = {
    userId: 'viewer-1',
    campus: 'KTR',
    department: 'CSE',
    batchYear: 2022,
    skillIds: ['skill-1', 'skill-2'],
    interestIds: ['interest-1'],
  };

  const itemConnection: FeedItemContext = {
    post: {
      id: 'post-1',
      content: 'Connection post',
      visibility: 'PUBLIC',
      likesCount: 10,
      commentsCount: 2,
      createdAt: now,
      authorId: 'author-1',
    },
    author: {
      userId: 'author-1',
      username: 'connected_user',
      displayName: 'Connected Student',
      campus: 'KTR',
      department: 'CSE',
      batchYear: 2022,
      skillIds: ['skill-1'],
      interestIds: ['interest-1'],
    },
    viewerState: {
      isLiked: false,
      isFollowing: true,
      isConnected: true,
    },
  };

  const itemDiscovery: FeedItemContext = {
    post: {
      id: 'post-2',
      content: 'Discovery post',
      visibility: 'PUBLIC',
      likesCount: 0,
      commentsCount: 0,
      createdAt: now,
      authorId: 'author-2',
    },
    author: {
      userId: 'author-2',
      username: 'stranger_user',
      displayName: 'Stranger Student',
      campus: 'RAM',
      department: 'ECE',
      batchYear: 2024,
    },
    viewerState: {
      isLiked: false,
      isFollowing: false,
      isConnected: false,
    },
  };

  it('should rank connected + academic match post significantly higher than stranger discovery post', () => {
    const score1 = rankingService.calculateScore(itemConnection, viewerContext);
    const score2 = rankingService.calculateScore(itemDiscovery, viewerContext);

    expect(score1).toBeGreaterThan(score2);
  });

  it('should apply time decay freshness reduction to older posts', () => {
    const freshPost: FeedItemContext = {
      ...itemDiscovery,
      post: { ...itemDiscovery.post, id: 'fresh', createdAt: now },
    };

    const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
    const oldPost: FeedItemContext = {
      ...itemDiscovery,
      post: { ...itemDiscovery.post, id: 'old', createdAt: oldDate },
    };

    const freshScore = rankingService.calculateScore(freshPost, viewerContext);
    const oldScore = rankingService.calculateScore(oldPost, viewerContext);

    expect(freshScore).toBeGreaterThan(oldScore);
  });

  it('should sort ranked items deterministically by score DESC', () => {
    const items = [itemDiscovery, itemConnection];
    const ranked = rankingService.rankFeedItems(items, viewerContext);

    expect(ranked[0].post.id).toBe('post-1');
    expect(ranked[1].post.id).toBe('post-2');
  });

  it('should apply cursor pagination filtering correctly', () => {
    const items = [itemConnection, itemDiscovery];
    const ranked = rankingService.rankFeedItems(items, viewerContext);
    const topScore = ranked[0].score;

    const cursor = {
      score: topScore,
      createdAt: itemConnection.post.createdAt,
      id: itemConnection.post.id,
    };

    const filtered = rankingService.rankFeedItems(items, viewerContext, cursor);
    expect(filtered.length).toBe(1);
    expect(filtered[0].post.id).toBe('post-2');
  });
});
