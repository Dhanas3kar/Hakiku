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
import { MetricsModule } from '../metrics/metrics.module';
import { MessageOutboxService } from './services/message-outbox.service';
import { MessageDeliveryWorkerService } from './services/message-delivery-worker.service';

@Module({
  imports: [NotificationsModule, ProfileModule, MetricsModule],
  controllers: [MessagingController],
  providers: [
    MessageAccessService,
    ConversationService,
    MessageDeliveryService,
    MessageOutboxService,
    MessageDeliveryWorkerService,
    MessageMediaService,
    MessageQueryService,
    MessageReadService,
    MessageService,
    MessagingGateway,
  ],
  exports: [MessageDeliveryWorkerService],
})
export class MessagingModule {}
