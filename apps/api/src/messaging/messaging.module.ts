import { Module } from '@nestjs/common';
import { MessagingController } from './messaging.controller';
import { ConversationService } from './services/conversation.service';
import { MessageAccessService } from './services/message-access.service';
import { MessageDeliveryService } from './services/message-delivery.service';
import { MessageMediaService } from './services/message-media.service';
import { MessageQueryService } from './services/message-query.service';
import { MessageReadService } from './services/message-read.service';
import { MessageService } from './services/message.service';
import { MessagingGateway } from './messaging.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [NotificationsModule, ProfileModule],
  controllers: [MessagingController],
  providers: [
    MessageAccessService,
    ConversationService,
    MessageDeliveryService,
    MessageMediaService,
    MessageQueryService,
    MessageReadService,
    MessageService,
    MessagingGateway,
  ],
})
export class MessagingModule {}
