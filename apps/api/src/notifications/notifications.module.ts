import { Module, Global } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationService } from './services/notification.service';
import { NotificationOutboxService } from './services/notification-outbox.service';
import { NotificationWorkerService } from './services/notification-worker.service';
import { NotificationPrivacyService } from './services/notification-privacy.service';
import { NotificationPreferenceService } from './services/notification-preference.service';
import { NotificationGateway } from './notification.gateway';
import { NetworkingModule } from '../networking/networking.module';
import { JwtAuthGuard } from '../networking/guards/jwt-auth.guard';

@Global()
@Module({
  imports: [NetworkingModule],
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    NotificationOutboxService,
    NotificationWorkerService,
    NotificationPrivacyService,
    NotificationPreferenceService,
    NotificationGateway,
    JwtAuthGuard,
  ],
  exports: [NotificationOutboxService],
})
export class NotificationsModule {}
