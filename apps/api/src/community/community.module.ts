import { Module } from '@nestjs/common';
import { CommunityController } from './community.controller';
import { ConfessionService } from './confessions/confession.service';
import { ConfessionQueryService } from './confessions/confession-query.service';
import { ConfessionModerationService } from './confessions/confession-moderation.service';
import { PeopleDiscoveryService } from './people/people-discovery.service';
import { CampusPulseService } from './campus/campus-pulse.service';
import { CampusInsightsService } from './campus/campus-insights.service';
import { PollService } from './polls/poll.service';
import { PollQueryService } from './polls/poll-query.service';
import { CommunityReportService } from './moderation/community-report.service';
import { CommunityModerationService } from './moderation/community-moderation.service';
import { HotTakesService } from './hot-takes/hot-takes.service';
import { StudentCommunitiesController } from './student-communities/student-communities.controller';
import { StudentCommunitiesService } from './student-communities/student-communities.service';
import { ProfileModule } from '../profile/profile.module';
import { NetworkingModule } from '../networking/networking.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ProfileModule,
    NetworkingModule,
    NotificationsModule,
  ],
  controllers: [
    CommunityController,
    StudentCommunitiesController,
  ],
  providers: [
    ConfessionService,
    ConfessionQueryService,
    ConfessionModerationService,
    PeopleDiscoveryService,
    CampusPulseService,
    CampusInsightsService,
    PollService,
    PollQueryService,
    CommunityReportService,
    CommunityModerationService,
    HotTakesService,
    StudentCommunitiesService,
  ],
  exports: [
    ConfessionModerationService,
    HotTakesService,
    PollService,
    StudentCommunitiesService,
  ],
})
export class CommunityModule {}

