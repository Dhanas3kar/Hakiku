import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NetworkingController } from './networking.controller';
import { FollowService } from './services/follow.service';
import { ConnectionService } from './services/connection.service';
import { BlockService } from './services/block.service';
import { NetworkingQueryService } from './services/networking-query.service';
import { EventPublisherService } from './services/event-publisher.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { BlockPrivacyGuard } from './guards/block-privacy.guard';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret',
    }),
  ],
  controllers: [NetworkingController],
  providers: [
    FollowService,
    ConnectionService,
    BlockService,
    NetworkingQueryService,
    EventPublisherService,
    JwtAuthGuard,
    BlockPrivacyGuard,
  ],
  exports: [FollowService, ConnectionService, BlockService, NetworkingQueryService],
})
export class NetworkingModule {}
