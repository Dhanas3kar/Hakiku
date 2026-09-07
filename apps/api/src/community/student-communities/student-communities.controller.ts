import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../networking/guards/jwt-auth.guard';
import { StudentCommunitiesService } from './student-communities.service';
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  CreateChannelDto,
  UpdateMemberRoleDto,
  BanMemberDto,
  SendChannelMessageDto,
  QueryCommunitiesDto,
  TransferOwnershipDto,
} from './dto/student-communities.dto';

interface AuthenticatedRequest {
  user: {
    sub: string;
    email: string;
    role: string;
  };
}

@Controller('communities')
@UseGuards(JwtAuthGuard)
export class StudentCommunitiesController {
  constructor(
    private readonly communitiesService: StudentCommunitiesService,
  ) {}

  @Post()
  async createCommunity(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateCommunityDto,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.createCommunity(userId, body);
  }

  @Get()
  async getCommunities(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryCommunitiesDto,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.getCommunities(userId, query);
  }

  @Get('my')
  async getMyCommunities(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.getMyCommunities(userId);
  }

  @Get(':idOrSlug')
  async getCommunityByIdOrSlug(
    @Req() req: AuthenticatedRequest,
    @Param('idOrSlug') idOrSlug: string,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.getCommunityByIdOrSlug(
      userId,
      idOrSlug,
    );
  }

  @Patch(':id')
  async updateCommunity(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateCommunityDto,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.updateCommunity(userId, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteCommunity(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.deleteCommunity(userId, id);
  }

  @Post(':id/transfer-ownership')
  @HttpCode(HttpStatus.OK)
  async transferOwnership(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: TransferOwnershipDto,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.transferOwnership(userId, id, body.targetUserId);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  async joinCommunity(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.joinCommunity(userId, id);
  }

  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  async leaveCommunity(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.leaveCommunity(userId, id);
  }

  @Get(':id/members')
  async getMembers(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.getMembers(
      userId,
      id,
      Number(page || 1),
      Number(limit || 50),
    );
  }

  @Patch(':id/members/:userId/role')
  async updateMemberRole(
    @Req() req: AuthenticatedRequest,
    @Param('id') communityId: string,
    @Param('userId') targetUserId: string,
    @Body() body: UpdateMemberRoleDto,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.updateMemberRole(
      userId,
      communityId,
      targetUserId,
      body,
    );
  }

  @Post(':id/members/:userId/ban')
  @HttpCode(HttpStatus.OK)
  async banMember(
    @Req() req: AuthenticatedRequest,
    @Param('id') communityId: string,
    @Param('userId') targetUserId: string,
    @Body() body: BanMemberDto,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.banMember(
      userId,
      communityId,
      targetUserId,
      body,
    );
  }

  @Post(':id/channels')
  async createChannel(
    @Req() req: AuthenticatedRequest,
    @Param('id') communityId: string,
    @Body() body: CreateChannelDto,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.createChannel(
      userId,
      communityId,
      body,
    );
  }

  @Get(':id/channels/:channelId/messages')
  async getChannelMessages(
    @Req() req: AuthenticatedRequest,
    @Param('id') communityId: string,
    @Param('channelId') channelId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.getChannelMessages(
      userId,
      communityId,
      channelId,
      Number(page || 1),
      Number(limit || 50),
    );
  }

  @Post(':id/channels/:channelId/messages')
  async sendChannelMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') communityId: string,
    @Param('channelId') channelId: string,
    @Body() body: SendChannelMessageDto,
  ) {
    const userId = req.user?.sub || (req.user as any)?.id;
    return this.communitiesService.sendChannelMessage(
      userId,
      communityId,
      channelId,
      body,
    );
  }
}
