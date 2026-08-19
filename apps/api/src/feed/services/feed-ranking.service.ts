import { Injectable } from '@nestjs/common';
import { DecodedFeedCursor } from './feed-cursor.service';

export interface FeedItemContext {
  post: {
    id: string;
    content: string | null;
    visibility: string;
    likesCount: number;
    commentsCount: number;
    createdAt: Date;
    authorId: string;
  };
  author: {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    campus?: string;
    department?: string;
    batchYear?: number;
    skillIds?: string[];
    interestIds?: string[];
  };
  viewerState: {
    isLiked: boolean;
    isFollowing: boolean;
    isConnected: boolean;
  };
}

export interface ViewerContext {
  userId: string;
  campus?: string;
  department?: string;
  batchYear?: number;
  skillIds?: string[];
  interestIds?: string[];
}

export interface RankedFeedItem extends FeedItemContext {
  score: number;
}

@Injectable()
export class FeedRankingService {
  calculateScore(item: FeedItemContext, viewer: ViewerContext): number {
    let relationshipScore = 0;
    if (item.viewerState.isConnected) {
      relationshipScore += 50;
    }
    if (item.viewerState.isFollowing) {
      relationshipScore += 35;
    }

    let academicScore = 0;
    if (
      viewer.department &&
      item.author.department &&
      viewer.department === item.author.department
    ) {
      academicScore += 20;
    }
    if (
      viewer.campus &&
      item.author.campus &&
      viewer.campus === item.author.campus
    ) {
      academicScore += 15;
    }
    if (
      viewer.batchYear &&
      item.author.batchYear &&
      viewer.batchYear === item.author.batchYear
    ) {
      academicScore += 10;
    }

    let interestScore = 0;
    if (viewer.interestIds && item.author.interestIds) {
      const sharedInterests = viewer.interestIds.filter((id) =>
        item.author.interestIds!.includes(id),
      );
      interestScore = Math.min(30, sharedInterests.length * 10);
    }

    let skillScore = 0;
    if (viewer.skillIds && item.author.skillIds) {
      const sharedSkills = viewer.skillIds.filter((id) =>
        item.author.skillIds!.includes(id),
      );
      skillScore = Math.min(24, sharedSkills.length * 8);
    }

    const likes = Math.max(0, item.post.likesCount || 0);
    const comments = Math.max(0, item.post.commentsCount || 0);
    const engagementScore = Math.log(1 + likes) + 2 * Math.log(1 + comments);

    const postDate =
      item.post.createdAt instanceof Date
        ? item.post.createdAt
        : new Date(item.post.createdAt);
    const ageInMs = Math.max(0, Date.now() - postDate.getTime());
    const ageInHours = ageInMs / (1000 * 60 * 60);
    const freshnessScore = Math.max(0, 100 - (ageInHours / 24) * 10);

    return Number(
      (
        relationshipScore +
        academicScore +
        interestScore +
        skillScore +
        engagementScore +
        freshnessScore
      ).toFixed(4),
    );
  }

  rankFeedItems(
    items: FeedItemContext[],
    viewer: ViewerContext,
    cursor?: DecodedFeedCursor,
  ): RankedFeedItem[] {
    const scoredItems: RankedFeedItem[] = items.map((item) => ({
      ...item,
      score: this.calculateScore(item, viewer),
    }));

    // Deterministic Sort: score DESC, createdAt DESC, id DESC
    scoredItems.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const dateA =
        a.post.createdAt instanceof Date
          ? a.post.createdAt.getTime()
          : new Date(a.post.createdAt).getTime();
      const dateB =
        b.post.createdAt instanceof Date
          ? b.post.createdAt.getTime()
          : new Date(b.post.createdAt).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.post.id.localeCompare(a.post.id);
    });

    if (!cursor) return scoredItems;

    // Filter items according to cursor
    return scoredItems.filter((item) => {
      if (item.score < cursor.score) return true;
      if (item.score > cursor.score) return false;

      const itemDate =
        item.post.createdAt instanceof Date
          ? item.post.createdAt.getTime()
          : new Date(item.post.createdAt).getTime();
      const cursorDate = cursor.createdAt.getTime();

      if (itemDate < cursorDate) return true;
      if (itemDate > cursorDate) return false;

      return item.post.id < cursor.id;
    });
  }
}
