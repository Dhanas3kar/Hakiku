import { db } from '../../db/index';
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { pendingMediaUploads, postMedia } from '../../db/schema';
import * as schema from '../../db/schema';
import { LocalStorageProvider } from '../../profile/storage/local-storage.provider';
import { MediaValidator } from '../validators/media.validator';
import { randomUUID } from 'crypto';

@Injectable()
export class PostMediaService {
  private db;

  constructor(private readonly storageProvider: LocalStorageProvider) {
    this.db = db;
  }

  /**
   * Upload and stage post media attachment using Phase 4 StorageProvider.
   * Validates MIME type, file size, and magic byte headers.
   */
  async uploadMedia(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    width?: number,
    height?: number,
    durationSeconds?: number,
  ) {
    const validated = MediaValidator.validate(fileBuffer, mimeType);

    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
    };
    const ext = extMap[validated.mimeType] || 'bin';
    const storageKey = `users/${userId}/posts/media/${randomUUID()}.${ext}`;

    // Upload via StorageProvider
    const fileMeta = await this.storageProvider.uploadFile(
      fileBuffer,
      storageKey,
      validated.mimeType,
    );

    // Save pending upload record
    const [pending] = await this.db
      .insert(pendingMediaUploads)
      .values({
        userId,
        storageKey: fileMeta.key,
        mediaType: validated.mediaType,
        mimeType: validated.mimeType,
        fileSize: fileMeta.size,
        width,
        height,
        durationSeconds,
        isAttached: false,
      })
      .returning();

    return {
      uploadId: pending.id,
      storageKey: pending.storageKey,
      mediaType: pending.mediaType,
      mimeType: pending.mimeType,
      fileSize: pending.fileSize,
      url: fileMeta.url,
    };
  }

  /**
   * Enforce Media Ownership and bind attached media records to a post inside a transaction.
   */
  async attachMediaToPost(
    userId: string,
    postId: string,
    uploadIds: string[],
    tx: any,
  ) {
    if (!uploadIds || uploadIds.length === 0) return [];

    const dbClient = tx || this.db;

    // Fetch pending uploads
    const pendingList = await dbClient
      .select()
      .from(pendingMediaUploads)
      .where(inArray(pendingMediaUploads.id, uploadIds));

    if (pendingList.length !== uploadIds.length) {
      throw new NotFoundException(
        'One or more media upload records were not found',
      );
    }

    // Verify ownership and attachment status
    for (const pending of pendingList) {
      if (pending.userId !== userId) {
        throw new ForbiddenException(
          'Media ownership violation: Cannot attach media uploaded by another user',
        );
      }
      if (pending.isAttached) {
        throw new BadRequestException(
          `Media upload ${pending.id} has already been attached to a post`,
        );
      }
    }

    // Map uploadIds order to displayOrder
    const attachedMedia = [];
    for (let i = 0; i < uploadIds.length; i++) {
      const uploadId = uploadIds[i];
      const pending = pendingList.find((p: any) => p.id === uploadId)!;

      const [mediaRecord] = await dbClient
        .insert(postMedia)
        .values({
          postId,
          mediaType: pending.mediaType,
          storageKey: pending.storageKey,
          mimeType: pending.mimeType,
          fileSize: pending.fileSize,
          width: pending.width,
          height: pending.height,
          durationSeconds: pending.durationSeconds,
          displayOrder: i,
        })
        .returning();

      // Mark pending record as attached
      await dbClient
        .update(pendingMediaUploads)
        .set({ isAttached: true })
        .where(eq(pendingMediaUploads.id, pending.id));

      attachedMedia.push({
        ...mediaRecord,
        url: `${process.env.BASE_URL || 'http://localhost:3001'}/uploads/${mediaRecord.storageKey}`,
      });
    }

    return attachedMedia;
  }

  /**
   * Get media attachments for a post sorted by display_order.
   */
  async getPostMedia(postId: string) {
    const mediaList = await this.db
      .select()
      .from(postMedia)
      .where(eq(postMedia.postId, postId))
      .orderBy(postMedia.displayOrder);

    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    return mediaList.map((m: any) => ({
      ...m,
      url: `${baseUrl}/uploads/${m.storageKey}`,
    }));
  }
}
