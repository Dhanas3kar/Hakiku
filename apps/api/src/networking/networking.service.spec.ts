import { Test, TestingModule } from '@nestjs/testing';
import { FollowService } from './services/follow.service';
import { ConnectionService } from './services/connection.service';
import { BlockService } from './services/block.service';
import { EventPublisherService } from './services/event-publisher.service';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationOutboxService } from '../notifications/services/notification-outbox.service';

describe('Networking Services Unit Specs', () => {
  let followService: FollowService;
  let connectionService: ConnectionService;
  let blockService: BlockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        FollowService,
        ConnectionService,
        BlockService,
        EventPublisherService,
        {
          provide: NotificationOutboxService,
          useValue: {
            createEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    followService = module.get<FollowService>(FollowService);
    connectionService = module.get<ConnectionService>(ConnectionService);
    blockService = module.get<BlockService>(BlockService);
  });

  describe('Self-Action Guards', () => {
    it('should throw BadRequestException when trying to follow oneself', async () => {
      await expect(followService.followUser('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when trying to unfollow oneself', async () => {
      await expect(followService.unfollowUser('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when trying to send connection request to oneself', async () => {
      await expect(connectionService.sendConnectionRequest('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when trying to remove connection with oneself', async () => {
      await expect(connectionService.removeConnection('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when trying to block oneself', async () => {
      await expect(blockService.blockUser('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when trying to unblock oneself', async () => {
      await expect(blockService.unblockUser('user-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });
});
