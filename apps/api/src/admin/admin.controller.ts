import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ModerateContentDto } from './dto/moderate-content.dto';
import { AdminService } from './services/admin.service';
import { MetricsService } from '../metrics/metrics.service';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get('reports')
  async getReports(
    @Query('status') status: 'PENDING' | 'RESOLVED' | 'DISMISSED',
    @Query('page') page: string,
  ) {
    return this.adminService.getReports(
      status || 'PENDING',
      parseInt(page) || 1,
    );
  }

  @Get('metrics')
  getMetrics() {
    return this.metricsService.currentMetrics;
  }

  @Patch('reports/:id')
  async resolveReport(
    @Req() req: any,
    @Param('id') reportId: string,
    @Body() body: ResolveReportDto,
  ) {
    return this.adminService.resolveReport(
      req.user.sub,
      reportId,
      body.action,
      body.reason,
    );
  }

  @Get('users')
  async searchUsers(@Query('q') query: string, @Query('page') page: string) {
    return this.adminService.searchUsers(query || '', parseInt(page) || 1);
  }

  @Patch('users/:id/status')
  async setUserStatus(
    @Req() req: any,
    @Param('id') targetId: string,
    @Body() body: UpdateUserStatusDto,
  ) {
    return this.adminService.setUserStatus(
      req.user.sub,
      targetId,
      body.status,
      body.reason,
    );
  }

  @Delete('posts/:id')
  async moderatePost(
    @Req() req: any,
    @Param('id') postId: string,
    @Body() body: ModerateContentDto,
  ) {
    return this.adminService.moderatePost(
      req.user.sub,
      postId,
      body.reason || 'Admin moderation',
    );
  }

  @Delete('comments/:id')
  async moderateComment(
    @Req() req: any,
    @Param('id') commentId: string,
    @Body() body: ModerateContentDto,
  ) {
    return this.adminService.moderateComment(
      req.user.sub,
      commentId,
      body.reason || 'Admin moderation',
    );
  }
}
