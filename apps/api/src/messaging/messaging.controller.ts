import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';
import { ConversationService } from './services/conversation.service';
import { MessageService } from './services/message.service';
import { MessageQueryService } from './services/message-query.service';
import { MessageReadService } from './services/message-read.service';
import { MessageMediaService } from './services/message-media.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly messageQueryService: MessageQueryService,
    private readonly messageReadService: MessageReadService,
    private readonly messageMediaService: MessageMediaService,
  ) {}

  @Post('conversations')
  async createConversation(@Req() req: any, @Body('targetUserId') targetUserId: string) {
    return this.conversationService.getOrCreateConversation(req.user.sub, targetUserId);
  }

  @Get('conversations')
  async listConversations(
    @Req() req: any,
    @Query('cursorAt') cursorAt?: string,
    @Query('limit') limit?: string
  ) {
    return this.conversationService.listConversations(req.user.sub, cursorAt, limit ? parseInt(limit) : 20);
  }

  @Post('conversations/:conversationId/messages')
  async sendMessage(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Body() dto: { content?: string, messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE', mediaKeys?: string[], replyToMessageId?: string }
  ) {
    return this.messageService.sendMessage(req.user.sub, conversationId, dto);
  }

  @Get('conversations/:conversationId/messages')
  async listMessages(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Query('cursorAt') cursorAt?: string,
    @Query('cursorId') cursorId?: string,
    @Query('limit') limit?: string
  ) {
    return this.messageQueryService.listMessages(req.user.sub, conversationId, cursorAt, cursorId, limit ? parseInt(limit) : 50);
  }

  @Patch(':messageId')
  async editMessage(
    @Req() req: any,
    @Param('messageId') messageId: string,
    @Body('content') content: string
  ) {
    return this.messageService.editMessage(req.user.sub, messageId, content);
  }

  @Delete(':messageId')
  async deleteMessage(
    @Req() req: any,
    @Param('messageId') messageId: string
  ) {
    return this.messageService.deleteMessage(req.user.sub, messageId);
  }

  @Post('conversations/:conversationId/read')
  async markAsRead(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Body('messageId') messageId: string
  ) {
    return this.messageReadService.markAsRead(req.user.sub, conversationId, messageId);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    return this.messageQueryService.getTotalUnreadCount(req.user.sub);
  }

  @Post('media/upload')
  async requestMediaUpload(
    @Req() req: any,
    @Body() dto: { extension: string, mimeType: string, fileSize: number }
  ) {
    return this.messageMediaService.getPresignedUploadUrl(req.user.sub, dto.extension, dto.mimeType, dto.fileSize);
  }
}
