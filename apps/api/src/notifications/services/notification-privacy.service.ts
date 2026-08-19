import { Injectable } from '@nestjs/common';
import { BlockService } from '../../networking/services/block.service';

@Injectable()
export class NotificationPrivacyService {
  constructor(private readonly blockService: BlockService) {}

  /**
   * Evaluates whether a notification should be delivered based on block relationships.
   * If recipient has blocked actor OR actor has blocked recipient, it returns false.
   */
  async canDeliverNotification(
    recipientId: string,
    actorId: string | null,
  ): Promise<boolean> {
    if (!actorId || recipientId === actorId) {
      return true; // System notifications or self-actions are always delivered
    }

    const isBlocked = await this.blockService.isBlocked(recipientId, actorId);
    return !isBlocked;
  }
}
