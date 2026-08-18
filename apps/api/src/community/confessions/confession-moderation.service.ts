import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { db } from '../../db';
import { confessions } from '../../db/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class ConfessionModerationService {
  
  async getPendingConfessions() {
    return db.query.confessions.findMany({
      where: eq(confessions.status, 'PENDING_MODERATION'),
    });
  }

  async approveConfession(confessionId: string) {
    const confession = await db.query.confessions.findFirst({
      where: eq(confessions.id, confessionId)
    });

    if (!confession) {
      throw new HttpException('Confession not found', HttpStatus.NOT_FOUND);
    }

    await db.update(confessions).set({
      status: 'PUBLISHED',
      publishedAt: new Date(),
    }).where(eq(confessions.id, confessionId));

    return { message: 'Confession approved' };
  }

  async rejectConfession(confessionId: string) {
    const confession = await db.query.confessions.findFirst({
      where: eq(confessions.id, confessionId)
    });

    if (!confession) {
      throw new HttpException('Confession not found', HttpStatus.NOT_FOUND);
    }

    await db.update(confessions).set({
      status: 'REJECTED'
    }).where(eq(confessions.id, confessionId));

    return { message: 'Confession rejected' };
  }

  async removeConfession(confessionId: string) {
    await db.update(confessions).set({
      status: 'REMOVED'
    }).where(eq(confessions.id, confessionId));

    return { message: 'Confession removed' };
  }
}
