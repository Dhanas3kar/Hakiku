import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
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
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET!,
    }),
    NetworkingModule,
  ],
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
