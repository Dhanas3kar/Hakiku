import { Controller, Get, Post, Delete, Body, Param, Req, UseGuards, Query, HttpCode, HttpStatus, ParseBoolPipe, DefaultValuePipe } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';
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

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
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
  ) {}

  // ==========================================
  // CONFESSIONS
  // ==========================================

  @Get('confessions/hero')
  async getHeroConfession(@Req() req: AuthenticatedRequest) {
    return this.confessionQueryService.getHeroConfession(req.user.id);
  }

  @Post('confessions')
  async submitConfession(
    @Req() req: AuthenticatedRequest,
    @Body() body: { content: string; campus?: string }
  ) {
    return this.confessionService.submitConfession(req.user.id, body.content, body.campus);
  }

  @Get('confessions')
  async listConfessions(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20)) limit: number,
    @Query('offset', new DefaultValuePipe(0)) offset: number
  ) {
    return this.confessionQueryService.listConfessions(req.user.id, Number(limit), Number(offset));
  }

  @Delete('confessions/:id')
  async deleteOwnConfession(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.confessionService.deleteOwnConfession(req.user.id, id);
  }

  // ==========================================
  // PEOPLE WORTH KNOWING
  // ==========================================

  @Get('people/recommendations')
  async getRecommendations(
    @Req() req: AuthenticatedRequest,
    @Query('cursor') cursor: string,
    @Query('limit', new DefaultValuePipe(20)) limit: number
  ) {
    return this.peopleDiscoveryService.getRecommendations(req.user.id, cursor, Number(limit));
  }

  // ==========================================
  // CAMPUS PULSE & INSIGHTS
  // ==========================================

  @Get('campus/pulse')
  async getGlobalPulse() {
    return this.campusPulseService.getGlobalPulse();
  }

  @Get('campus/insights')
  async getCampusInsights(@Req() req: AuthenticatedRequest) {
    return this.campusInsightsService.getInsights(req.user.id);
  }

  // ==========================================
  // POLLS
  // ==========================================

  @Post('polls')
  async createPoll(
    @Req() req: AuthenticatedRequest,
    @Body() body: { question: string; options: string[]; isMultipleChoice?: boolean; campus?: string }
  ) {
    return this.pollService.createPoll(req.user.id, body.question, body.options, body.isMultipleChoice, body.campus);
  }

  @Get('polls')
  async listPolls(
    @Req() req: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(20)) limit: number,
    @Query('offset', new DefaultValuePipe(0)) offset: number
  ) {
    return this.pollQueryService.listPolls(req.user.id, Number(limit), Number(offset));
  }

  @Get('polls/:id')
  async getPollDetails(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.pollQueryService.getPollDetails(id, req.user.id);
  }

  @Post('polls/:id/vote')
  @HttpCode(HttpStatus.OK)
  async voteOnPoll(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { optionId: string }
  ) {
    return this.pollService.vote(req.user.id, id, body.optionId);
  }

  @Delete('polls/:id/vote')
  async removeVote(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body?: { optionId?: string }
  ) {
    return this.pollService.removeVote(req.user.id, id, body?.optionId);
  }

  // ==========================================
  // REPORTING
  // ==========================================

  @Post('report')
  async reportContent(
    @Req() req: AuthenticatedRequest,
    @Body() body: { targetType: 'CONFESSION' | 'POLL' | 'POST' | 'COMMENT' | 'USER'; targetId: string; reason: string }
  ) {
    return this.reportService.reportContent(req.user.id, body.targetType, body.targetId, body.reason);
  }

  // ==========================================
  // MODERATION (Admin endpoints, protected normally but simplified here)
  // ==========================================

  @Get('moderation/confessions')
  async getPendingConfessions() {
    return this.confessionModerationService.getPendingConfessions();
  }

  @Post('moderation/confessions/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveConfession(@Param('id') id: string) {
    return this.confessionModerationService.approveConfession(id);
  }

  @Post('moderation/confessions/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectConfession(@Param('id') id: string) {
    return this.confessionModerationService.rejectConfession(id);
  }

  @Delete('moderation/confessions/:id')
  async removeConfession(@Param('id') id: string) {
    return this.confessionModerationService.removeConfession(id);
  }

  @Get('moderation/reports')
  async getPendingReports() {
    return this.moderationService.getPendingReports();
  }

  @Post('moderation/reports/:id/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveReport(@Param('id') id: string) {
    return this.moderationService.resolveReport(id);
  }

  @Post('moderation/reports/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  async dismissReport(@Param('id') id: string) {
    return this.moderationService.dismissReport(id);
  }
}
