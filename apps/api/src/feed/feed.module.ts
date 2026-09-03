import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './services/feed.service';
import { FeedCandidateService } from './services/feed-candidate.service';
import { FeedVisibilityService } from './services/feed-visibility.service';
import { FeedRankingService } from './services/feed-ranking.service';
import { FeedCursorService } from './services/feed-cursor.service';
import { FeedQueryService } from './services/feed-query.service';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';

@Module({
  imports: [],
  controllers: [FeedController],
  providers: [
    FeedService,
    FeedCandidateService,
    FeedVisibilityService,
    FeedRankingService,
    FeedCursorService,
    FeedQueryService,
    JwtAuthGuard,
  ],
  exports: [
    FeedService,
    FeedCandidateService,
    FeedVisibilityService,
    FeedRankingService,
    FeedCursorService,
    FeedQueryService,
  ],
})
export class FeedModule {}
