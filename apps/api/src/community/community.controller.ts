import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
  ParseBoolPipe,
  DefaultValuePipe,
  Patch,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
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

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    sub: string;
    email: string;
    role: string;
  };
}

@Controller('community')
@UseGuards(JwtAuthGuard)
export class CommunityController {
  constructor(
    private readonly confessionService: ConfessionService,
    private readonly confessionQueryService: ConfessionQueryService,
    private readonly confessionModerationService: ConfessionModerationService,
    private readonly peopleDiscoveryService: PeopleDiscoveryService,
    private readonly campusPulseService: CampusPulseService,
    private readonly campusInsightsService: CampusInsightsService,
    private readonly pollService: PollService,
    private readonly pollQueryService: PollQueryService,
    private readonly reportService: CommunityReportService,
    private readonly moderationService: CommunityModerationService,
    private readonly hotTakesService: HotTakesService,
  ) { }

  // ==========================================
  // CONFESSIONS
  // ==========================================

  @Get('confessions/hero')
  async getHeroConfession(@Req() req: AuthenticatedRequest) {
    return this.confessionQueryService.getHeroConfession(req.user.sub);
  }

  @Post('confessions')
  async submitConfession(
    @Req() req: AuthenticatedRequest,
    @Body() body: { content: string; campus?: string },
  ) {
    return this.confessionService.submitConfession(
      req.user.sub,
      body.content,
      body.campus,
    );
  }

  @Get('confessions')
  async listConfessions(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20)) limit: number,
    @Query('offset', new DefaultValuePipe(0)) offset: number,
  ) {
    return this.confessionQueryService.listConfessions(
      req.user.sub,
      Number(limit),
      Number(offset),
    );
  }

  @Delete('confessions/:id')
  async deleteOwnConfession(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.confessionService.deleteOwnConfession(req.user.sub, id);
  }

  // ==========================================
  // PEOPLE WORTH KNOWING
  // ==========================================

  @Get('people/recommendations')
  async getRecommendations(
    @Req() req: AuthenticatedRequest,
    @Query('cursor') cursor: string,
    @Query('limit', new DefaultValuePipe(20)) limit: number,
  ) {
    return this.peopleDiscoveryService.getRecommendations(
      req.user.sub,
      cursor,
      Number(limit),
    );
  }

  // ==========================================
  // CAMPUS PULSE & INSIGHTS
  // ==========================================

  @Get('campus/pulse')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getGlobalPulse() {
    return this.campusPulseService.getGlobalPulse();
  }

  @Get('campus/insights')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getCampusInsights(@Req() req: AuthenticatedRequest) {
    return this.campusInsightsService.getInsights(req.user.sub);
  }

  // ==========================================
  // POLLS
  // ==========================================

  @Post('polls')
  async createPoll(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      question: string;
      options: string[];
      isMultipleChoice?: boolean;
      campus?: string;
    },
  ) {
    return this.pollService.createPoll(
      req.user.sub,
      body.question,
      body.options,
      body.isMultipleChoice,
      body.campus,
    );
  }

  @Get('polls')
  async listPolls(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20)) limit: number,
    @Query('offset', new DefaultValuePipe(0)) offset: number,
  ) {
    return this.pollQueryService.listPolls(
      req.user.sub,
      Number(limit),
      Number(offset),
    );
  }

  @Get('polls/:id')
  async getPollDetails(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.pollQueryService.getPollDetails(id, req.user.sub);
  }

  @Post('polls/:id/vote')
  @HttpCode(HttpStatus.OK)
  async voteOnPoll(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { optionId: string },
  ) {
    return this.pollService.vote(req.user.sub, id, body.optionId);
  }

  @Delete('polls/:id/vote')
  async removeVote(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body?: { optionId?: string },
  ) {
    return this.pollService.removeVote(req.user.sub, id, body?.optionId);
  }

  // ==========================================
  // HOT TAKES
  // ==========================================

  @Post('hot-takes')
  async createHotTake(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      content: string;
      date?: string;
      place?: string;
      time?: string;
      media?: string;
      otherDetails?: string;
    },
  ) {
    if (!body.content || body.content.length > 100) {
      throw new HttpException('Content is required and must be under 100 characters', HttpStatus.BAD_REQUEST);
    }
    return this.hotTakesService.createHotTake(req.user.sub, body);
  }

  @Get('hot-takes')
  async listHotTakes(
    @Query('limit', new DefaultValuePipe(20)) limit: number,
    @Query('offset', new DefaultValuePipe(0)) offset: number,
  ) {
    return this.hotTakesService.getHotTakes(Number(limit), Number(offset));
  }

  @Delete('hot-takes/:id')
  async deleteHotTake(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.hotTakesService.deleteHotTake(req.user.sub, id);
  }

  @Patch('hot-takes/:id')
  async updateHotTake(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: {
      content: string;
      date?: string;
      place?: string;
      time?: string;
      media?: string;
      otherDetails?: string;
    },
  ) {
    if (!body.content || body.content.length > 100) {
      throw new HttpException('Content is required and must be under 100 characters', HttpStatus.BAD_REQUEST);
    }
    return this.hotTakesService.updateHotTake(req.user.sub, id, body);
  }

  // ==========================================
  // REPORTING
  // ==========================================

  @Post('report')
  async reportContent(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      targetType: 'CONFESSION' | 'POLL' | 'POST' | 'COMMENT' | 'USER' | 'HOT_TAKE';
      targetId: string;
      reason: string;
    },
  ) {
    return this.reportService.reportContent(
      req.user.sub,
      body.targetType,
      body.targetId,
      body.reason,
    );
  }

  // ==========================================
  // MODERATION (Admin endpoints, protected normally but simplified here)
  // ==========================================

  @Get('moderation/confessions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  async getPendingConfessions() {
    return this.confessionModerationService.getPendingConfessions();
  }

  @Post('moderation/confessions/:id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  async approveConfession(@Param('id') id: string) {
    return this.confessionModerationService.approveConfession(id);
  }

  @Post('moderation/confessions/:id/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  async rejectConfession(@Param('id') id: string) {
    return this.confessionModerationService.rejectConfession(id);
  }

  @Delete('moderation/confessions/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  async removeConfession(@Param('id') id: string) {
    return this.confessionModerationService.removeConfession(id);
  }

  @Get('moderation/reports')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  async getPendingReports() {
    return this.moderationService.getPendingReports();
  }

  @Post('moderation/reports/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  async resolveReport(@Param('id') id: string) {
    return this.moderationService.resolveReport(id);
  }

  @Post('moderation/reports/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  async dismissReport(@Param('id') id: string) {
    return this.moderationService.dismissReport(id);
  }
}
