import { Injectable, CanActivate, ExecutionContext, NotFoundException } from '@nestjs/common';
import { BlockService } from '../services/block.service';

@Injectable()
export class BlockPrivacyGuard implements CanActivate {
  constructor(private readonly blockService: BlockService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const currentUserId = request.user?.sub;
    const targetUserId = request.params?.targetUserId;

    if (currentUserId && targetUserId && currentUserId !== targetUserId) {
      const isBlockedByTarget = await this.blockService.isBlockedByTarget(currentUserId, targetUserId);
      if (isBlockedByTarget) {
        throw new NotFoundException('User not found');
      }
    }

    return true;
  }
}
