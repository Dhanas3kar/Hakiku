import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { FeedService } from './services/feed.service';
import { FeedQueryDto, DiscoverQueryDto } from './dto/feed.dto';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  async getPersonalizedFeed(@Req() req: any, @Query() query: FeedQueryDto) {
    return this.feedService.getPersonalizedFeed(req.user.sub, query);
  }

  @Get('discover')
  async getDiscoveryFeed(@Req() req: any, @Query() query: DiscoverQueryDto) {
    return this.feedService.getDiscoveryFeed(req.user.sub, query);
  }
}
