import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { FastifyRequest as FastifyRequestType } from 'fastify';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';
import { NotificationService } from './services/notification.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import type { NotificationCategory } from './services/notification-preference.service';
import { NotificationsQueryDto, UpdatePreferencesDto } from './dto/notifications.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService
  ) {}

  @Get()
  async getNotifications(@Req() req: FastifyRequestType, @Query() query: NotificationsQueryDto) {
    const userId = (req as any).user.sub;
    return this.notificationService.getNotifications(userId, query);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: FastifyRequestType) {
    const userId = (req as any).user.sub;
    return this.notificationService.getUnreadCount(userId);
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: FastifyRequestType) {
    const userId = (req as any).user.sub;
    return this.notificationService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  async markAsRead(@Req() req: FastifyRequestType, @Param('id') notificationId: string) {
    const userId = (req as any).user.sub;
    return this.notificationService.markAsRead(userId, notificationId);
  }

  @Delete(':id')
  async deleteNotification(@Req() req: FastifyRequestType, @Param('id') notificationId: string) {
    const userId = (req as any).user.sub;
    return this.notificationService.deleteNotification(userId, notificationId);
  }

  @Get('preferences')
  async getPreferences(@Req() req: FastifyRequestType) {
    const userId = (req as any).user.sub;
    return this.preferenceService.getPreferences(userId);
  }

  @Patch('preferences/:category')
  async updatePreference(
    @Req() req: FastifyRequestType,
    @Param('category') category: NotificationCategory,
    @Body() dto: UpdatePreferencesDto
  ) {
    const userId = (req as any).user.sub;
    return this.preferenceService.updatePreference(userId, category, dto);
  }
}
