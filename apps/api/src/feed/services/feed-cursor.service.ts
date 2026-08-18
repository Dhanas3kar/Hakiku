import { Injectable, BadRequestException } from '@nestjs/common';

export interface DecodedFeedCursor {
  score: number;
  createdAt: Date;
  id: string;
}

@Injectable()
export class FeedCursorService {
  encode(score: number, createdAt: Date | string, id: string): string {
    const payload = {
      score,
      createdAt: typeof createdAt === 'string' ? createdAt : createdAt.toISOString(),
      id,
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  decode(cursorStr: string): DecodedFeedCursor {
    if (!cursorStr || typeof cursorStr !== 'string') {
      throw new BadRequestException('Invalid pagination cursor format');
    }

    try {
      const decodedJson = Buffer.from(cursorStr, 'base64').toString('utf-8');
      const parsed = JSON.parse(decodedJson);

      if (
        parsed.score === undefined ||
        parsed.score === null ||
        typeof parsed.score !== 'number' ||
        !parsed.createdAt ||
        !parsed.id
      ) {
        throw new BadRequestException('Invalid pagination cursor payload');
      }

      const date = new Date(parsed.createdAt);
      if (isNaN(date.getTime())) {
        throw new BadRequestException('Invalid pagination cursor date');
      }

      return {
        score: parsed.score,
        createdAt: date,
        id: parsed.id,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid pagination cursor format');
    }
  }
}
