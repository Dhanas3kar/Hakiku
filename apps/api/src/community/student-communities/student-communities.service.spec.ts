import { Test, TestingModule } from '@nestjs/testing';
import { StudentCommunitiesService } from './student-communities.service';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { db } from '../../db';

// Mock DB and Redis client
jest.mock('../../db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    transaction: jest.fn((cb) => cb({
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
  },
}));

describe('StudentCommunitiesService', () => {
  let service: StudentCommunitiesService;
  let mockRedis: any;

  beforeEach(async () => {
    mockRedis = {
      publish: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentCommunitiesService,
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<StudentCommunitiesService>(StudentCommunitiesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCommunity', () => {
    it('should throw ConflictException if slug already exists', async () => {
      const mockTx = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: 'existing-id', slug: 'test-community' }]),
      };
      (db.transaction as jest.Mock).mockImplementationOnce((cb) => cb(mockTx));

      await expect(
        service.createCommunity('user-1', {
          name: 'Test Community',
          slug: 'test-community',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('transferOwnership', () => {
    it('should throw BadRequestException when attempting self-transfer', async () => {
      await expect(
        service.transferOwnership('user-owner', 'comm-1', 'user-owner'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if target user is not a member', async () => {
      jest.spyOn(service, 'requireMemberRole').mockResolvedValueOnce({
        communityId: 'comm-1',
        userId: 'user-owner',
        role: 'OWNER',
        joinedAt: new Date(),
      });

      (db.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.transferOwnership('user-owner', 'comm-1', 'user-target'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully transfer ownership in transaction', async () => {
      jest.spyOn(service, 'requireMemberRole').mockResolvedValueOnce({
        communityId: 'comm-1',
        userId: 'user-owner',
        role: 'OWNER',
        joinedAt: new Date(),
      });

      (db.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ communityId: 'comm-1', userId: 'user-target', role: 'MEMBER' }]),
      });

      const mockTx = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockResolvedValue([]),
      };
      (db.transaction as jest.Mock).mockImplementationOnce((cb) => cb(mockTx));

      const result = await service.transferOwnership('user-owner', 'comm-1', 'user-target');
      expect(result.success).toBe(true);
      expect(mockRedis.publish).toHaveBeenCalledWith(
        'community_events',
        expect.stringContaining('community:ownership:transferred'),
      );
    });
  });

  describe('banMember (Role Hierarchy & Moderation)', () => {
    it('should throw ForbiddenException if actor is MODERATOR attempting to ban another MODERATOR', async () => {
      jest.spyOn(service, 'requireMemberRole').mockResolvedValueOnce({
        communityId: 'comm-1',
        userId: 'mod-actor',
        role: 'MODERATOR',
        joinedAt: new Date(),
      });

      (db.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ communityId: 'comm-1', userId: 'mod-target', role: 'MODERATOR' }]),
      });

      await expect(
        service.banMember('mod-actor', 'comm-1', 'mod-target', { reason: 'Spam' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if actor attempts to ban OWNER', async () => {
      jest.spyOn(service, 'requireMemberRole').mockResolvedValueOnce({
        communityId: 'comm-1',
        userId: 'mod-actor',
        role: 'MODERATOR',
        joinedAt: new Date(),
      });

      (db.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ communityId: 'comm-1', userId: 'owner-user', role: 'OWNER' }]),
      });

      await expect(
        service.banMember('mod-actor', 'comm-1', 'owner-user', { reason: 'Test' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('BOLA / IDOR Channel Scoping', () => {
    it('should throw NotFoundException if channel does not belong to requested community in getChannelMessages', async () => {
      (db.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: 'comm-A', visibility: 'PUBLIC' }]),
      });

      (db.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.getChannelMessages('user-1', 'comm-A', 'channel-belonging-to-comm-B'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on whitespace-only message content in sendChannelMessage', async () => {
      await expect(
        service.sendChannelMessage('user-1', 'comm-1', 'channel-1', { content: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
