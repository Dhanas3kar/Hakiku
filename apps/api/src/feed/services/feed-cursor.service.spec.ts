import { FeedCursorService } from './feed-cursor.service';
import { BadRequestException } from '@nestjs/common';

describe('FeedCursorService (Unit)', () => {
  let service: FeedCursorService;

  beforeEach(() => {
    service = new FeedCursorService();
  });

  it('should encode cursor parameters into Base64 string', () => {
    const date = new Date('2026-08-17T12:00:00.000Z');
    const cursor = service.encode(85.5, date, 'post-123');
    expect(typeof cursor).toBe('string');
    expect(cursor.length).toBeGreaterThan(0);
  });

  it('should decode valid Base64 cursor payload', () => {
    const date = new Date('2026-08-17T12:00:00.000Z');
    const encoded = service.encode(85.5, date, 'post-123');
    const decoded = service.decode(encoded);

    expect(decoded.score).toBe(85.5);
    expect(decoded.createdAt.toISOString()).toBe('2026-08-17T12:00:00.000Z');
    expect(decoded.id).toBe('post-123');
  });

  it('should throw BadRequestException for invalid Base64 string', () => {
    expect(() => service.decode('not-a-valid-json')).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for missing required cursor fields', () => {
    const invalidPayload = Buffer.from(JSON.stringify({ score: 10 })).toString('base64');
    expect(() => service.decode(invalidPayload)).toThrow(BadRequestException);
  });
});
