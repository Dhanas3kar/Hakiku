import { Injectable, BadRequestException } from '@nestjs/common';
import { LocalStorageProvider } from '../../profile/storage/local-storage.provider';
import { db } from '../../db/index';
import { pendingMediaUploads } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import * as crypto from 'crypto';

@Injectable()
export class MessageMediaService {
  constructor(private readonly storageProvider: LocalStorageProvider) {}

  /**
   * Generates a signed URL for uploading message media.
   */
  async requestMediaUpload(userId: string, mimeType: string, fileSize: number) {
    if (fileSize <= 0) {
      throw new BadRequestException('File size must be positive');
    }

    // Constraints
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isFile = !isImage && !isVideo; // Basic file

    if (isImage && fileSize > 10 * 1024 * 1024)
      throw new BadRequestException('Image exceeds 10MB limit');
    if (isVideo && fileSize > 50 * 1024 * 1024)
      throw new BadRequestException('Video exceeds 50MB limit');
    if (isFile && fileSize > 25 * 1024 * 1024)
      throw new BadRequestException('File exceeds 25MB limit');

    const extension = mimeType.split('/')[1] || 'bin';
    const uniqueId = crypto.randomUUID();
    const objectKey = `messages/${userId}/${uniqueId}.${extension}`;

    const uploadUrlResult = await this.storageProvider.getPresignedUploadUrl(
      objectKey,
      mimeType,
    );
    const uploadUrl = uploadUrlResult.uploadUrl;

    // Stage upload
    await db.insert(pendingMediaUploads).values({
      userId,
      storageKey: objectKey,
      mimeType,
      fileSize,
      mediaType: isImage ? 'IMAGE' : isVideo ? 'VIDEO' : 'IMAGE', // fallback to IMAGE for files, or we could add FILE to DB enum
      isAttached: false,
    });

    return { uploadUrl, storageKey: objectKey };
  }
}
