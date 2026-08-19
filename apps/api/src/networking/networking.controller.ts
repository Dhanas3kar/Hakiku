import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FollowService } from './services/follow.service';
import { ConnectionService } from './services/connection.service';
import { BlockService } from './services/block.service';
import { NetworkingQueryService } from './services/networking-query.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  PaginationQueryDto,
  TargetUserParamDto,
  RequestIdParamDto,
} from './dto/networking.dto';

@Controller('networking')
@UseGuards(JwtAuthGuard)
export class NetworkingController {
  constructor(
    private readonly followService: FollowService,
    private readonly connectionService: ConnectionService,
    private readonly blockService: BlockService,
    private readonly queryService: NetworkingQueryService,
  ) {}

  // --- FOLLOW ENDPOINTS ---

  @Post('follow/:targetUserId')
  @HttpCode(HttpStatus.CREATED)
  async followUser(@Req() req: any, @Param() params: TargetUserParamDto) {
    return this.followService.followUser(req.user.sub, params.targetUserId);
  }

  @Delete('follow/:targetUserId')
  @HttpCode(HttpStatus.OK)
  async unfollowUser(@Req() req: any, @Param() params: TargetUserParamDto) {
    return this.followService.unfollowUser(req.user.sub, params.targetUserId);
  }

  @Get('followers/:userId')
  async getFollowers(
    @Param('userId') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.queryService.getFollowers(userId, query.limit, query.cursor);
  }

  @Get('following/:userId')
  async getFollowing(
    @Param('userId') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.queryService.getFollowing(userId, query.limit, query.cursor);
  }

  // --- CONNECTION ENDPOINTS ---

  @Post('connections/request/:targetUserId')
  @HttpCode(HttpStatus.OK)
  async sendConnectionRequest(
    @Req() req: any,
    @Param() params: TargetUserParamDto,
  ) {
    return this.connectionService.sendConnectionRequest(
      req.user.sub,
      params.targetUserId,
    );
  }

  @Post('connections/accept/:requestId')
  @HttpCode(HttpStatus.OK)
  async acceptConnectionRequest(
    @Req() req: any,
    @Param() params: RequestIdParamDto,
  ) {
    return this.connectionService.acceptConnectionRequest(
      req.user.sub,
      params.requestId,
    );
  }

  @Post('connections/reject/:requestId')
  @HttpCode(HttpStatus.OK)
  async rejectConnectionRequest(
    @Req() req: any,
    @Param() params: RequestIdParamDto,
  ) {
    return this.connectionService.rejectConnectionRequest(
      req.user.sub,
      params.requestId,
    );
  }

  @Delete('connections/request/:requestId')
  @HttpCode(HttpStatus.OK)
  async cancelConnectionRequest(
    @Req() req: any,
    @Param() params: RequestIdParamDto,
  ) {
    return this.connectionService.cancelConnectionRequest(
      req.user.sub,
      params.requestId,
    );
  }

  @Delete('connections/:targetUserId')
  @HttpCode(HttpStatus.OK)
  async removeConnection(@Req() req: any, @Param() params: TargetUserParamDto) {
    return this.connectionService.removeConnection(
      req.user.sub,
      params.targetUserId,
    );
  }

  @Get('connections')
  async getConnections(@Req() req: any, @Query() query: PaginationQueryDto) {
    return this.queryService.getConnections(
      req.user.sub,
      query.limit,
      query.cursor,
    );
  }

  @Get('connections/requests/pending')
  async getPendingIncomingRequests(
    @Req() req: any,
    @Query() query: PaginationQueryDto,
  ) {
    return this.queryService.getPendingIncomingRequests(
      req.user.sub,
      query.limit,
      query.cursor,
    );
  }

  @Get('connections/requests/sent')
  async getPendingOutgoingRequests(
    @Req() req: any,
    @Query() query: PaginationQueryDto,
  ) {
    return this.queryService.getPendingOutgoingRequests(
      req.user.sub,
      query.limit,
      query.cursor,
    );
  }

  // --- BLOCK ENDPOINTS ---

  @Post('block/:targetUserId')
  @HttpCode(HttpStatus.OK)
  async blockUser(@Req() req: any, @Param() params: TargetUserParamDto) {
    return this.blockService.blockUser(req.user.sub, params.targetUserId);
  }

  @Delete('block/:targetUserId')
  @HttpCode(HttpStatus.OK)
  async unblockUser(@Req() req: any, @Param() params: TargetUserParamDto) {
    return this.blockService.unblockUser(req.user.sub, params.targetUserId);
  }

  @Get('blocks')
  async getBlockedUsers(@Req() req: any, @Query() query: PaginationQueryDto) {
    return this.queryService.getBlockedUsers(
      req.user.sub,
      query.limit,
      query.cursor,
    );
  }

  // --- RELATIONSHIP STATUS ENDPOINT ---

  @Get('status/:targetUserId')
  async getRelationshipStatus(
    @Req() req: any,
    @Param() params: TargetUserParamDto,
  ) {
    return this.queryService.getRelationshipStatus(
      req.user.sub,
      params.targetUserId,
    );
  }
}
