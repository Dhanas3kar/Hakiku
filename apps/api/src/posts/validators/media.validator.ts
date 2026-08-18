import { BadRequestException } from '@nestjs/common';

export type PostMediaType = 'IMAGE' | 'VIDEO';

export const IMAGE_MAX_SIZE = 10 * 1024 * 1024; // 10MB
export const VIDEO_MAX_SIZE = 50 * 1024 * 1024; // 50MB

export const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm'];

export interface ValidatedMediaResult {
  mediaType: PostMediaType;
  mimeType: string;
  fileSize: number;
}

export class MediaValidator {
  public static validate(buffer: Buffer, mimeType: string): ValidatedMediaResult {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Media file buffer cannot be empty');
    }

    const normalizedMime = mimeType.toLowerCase();

    if (ALLOWED_IMAGE_MIMES.includes(normalizedMime)) {
      if (buffer.length > IMAGE_MAX_SIZE) {
        throw new BadRequestException('Image size exceeds maximum allowed limit of 10MB');
      }

      const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
      const isWebp = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;

      if (!isJpeg && !isPng && !isWebp) {
        throw new BadRequestException('Invalid image header signature or corrupted file');
      }

      return {
        mediaType: 'IMAGE',
        mimeType: normalizedMime,
        fileSize: buffer.length,
      };
    }

    if (ALLOWED_VIDEO_MIMES.includes(normalizedMime)) {
      if (buffer.length > VIDEO_MAX_SIZE) {
        throw new BadRequestException('Video size exceeds maximum allowed limit of 50MB');
      }

      const isMp4 =
        buffer.length >= 8 &&
        buffer[4] === 0x66 && // f
        buffer[5] === 0x74 && // t
        buffer[6] === 0x79 && // y
        buffer[7] === 0x70; // p

      const isWebm =
        buffer.length >= 4 &&
        buffer[0] === 0x1a &&
        buffer[1] === 0x45 &&
        buffer[2] === 0xdf &&
        buffer[3] === 0xa3; // EBML

      if (!isMp4 && !isWebm) {
        throw new BadRequestException('Invalid video header signature or corrupted video file');
      }

      return {
        mediaType: 'VIDEO',
        mimeType: normalizedMime,
        fileSize: buffer.length,
      };
    }

    throw new BadRequestException(
      `Unsupported media MIME type ${mimeType}. Allowed formats: JPEG, PNG, WEBP, MP4, WEBM`
    );
  }
}
