import { Test, TestingModule } from '@nestjs/testing';
import { SessionService } from './session.service';
import { db } from '../../db';
import { authSessions } from '../../db/schema';
import * as argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { randomUUID, randomBytes } from 'crypto';

// We must mock the global 'db' export
jest.mock('../../db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    transaction: jest.fn((cb) => cb(db)),
  },
}));

const mockDb = db as any;

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionService],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rotateSession concurrency handling', () => {
    it('should return replacement session during grace period for exact immediately-previous token (N-1)', async () => {
      const familyId = randomUUID();
      const rawTokenN1 = 'old_token';
      const hashedN1 = await argon2.hash(rawTokenN1);
      
      const hashedActive = await argon2.hash('active_token');
      const activeSession = { id: 'active_id', tokenFamilyId: familyId, hashedRefreshToken: hashedActive, status: 'ACTIVE', expiresAt: new Date(Date.now() + 100000) };
      const rotatedSessionN1 = { id: 'rotated_1', tokenFamilyId: familyId, hashedRefreshToken: hashedN1, status: 'ROTATED', rotatedAt: new Date() };

      mockDb.where.mockResolvedValueOnce([activeSession]); // Active session
      mockDb.orderBy.mockResolvedValueOnce([rotatedSessionN1]); // Rotated sessions

      const result = await service.rotateSession(rawTokenN1, familyId);
      expect(result).toEqual({ rawToken: rawTokenN1, session: activeSession });
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('should reject and revoke family if N-1 token is used outside of grace period', async () => {
      const familyId = randomUUID();
      const rawTokenN1 = 'old_token';
      const hashedN1 = await argon2.hash(rawTokenN1);
      
      const hashedActive = await argon2.hash('active_token');
      const activeSession = { id: 'active_id', tokenFamilyId: familyId, hashedRefreshToken: hashedActive, status: 'ACTIVE', expiresAt: new Date(Date.now() + 100000) };
      // Set rotatedAt to 31 seconds ago (outside grace period)
      const rotatedSessionN1 = { id: 'rotated_1', tokenFamilyId: familyId, hashedRefreshToken: hashedN1, status: 'ROTATED', rotatedAt: new Date(Date.now() - 31000) };

      mockDb.where.mockResolvedValueOnce([activeSession]); 
      mockDb.orderBy.mockResolvedValueOnce([rotatedSessionN1]);

      await expect(service.rotateSession(rawTokenN1, familyId)).rejects.toThrow(UnauthorizedException);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should reject and revoke family if N-2 token is used even inside grace period', async () => {
      const familyId = randomUUID();
      const rawTokenN2 = 'older_token';
      const hashedN2 = await argon2.hash(rawTokenN2);
      
      const hashedActive = await argon2.hash('active_token');
      const activeSession = { id: 'active_id', tokenFamilyId: familyId, hashedRefreshToken: hashedActive, status: 'ACTIVE', expiresAt: new Date(Date.now() + 100000) };
      const hashedN1 = await argon2.hash('some_token');
      const rotatedSessionN1 = { id: 'rotated_1', tokenFamilyId: familyId, hashedRefreshToken: hashedN1, status: 'ROTATED', rotatedAt: new Date() };
      const rotatedSessionN2 = { id: 'rotated_2', tokenFamilyId: familyId, hashedRefreshToken: hashedN2, status: 'ROTATED', rotatedAt: new Date() };

      mockDb.where.mockResolvedValueOnce([activeSession]); 
      mockDb.orderBy.mockResolvedValueOnce([rotatedSessionN1, rotatedSessionN2]);

      await expect(service.rotateSession(rawTokenN2, familyId)).rejects.toThrow(UnauthorizedException);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
