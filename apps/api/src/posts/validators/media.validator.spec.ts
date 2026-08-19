import {
  MediaValidator,
  IMAGE_MAX_SIZE,
  VIDEO_MAX_SIZE,
} from './media.validator';
import { BadRequestException } from '@nestjs/common';

describe('MediaValidator (Unit)', () => {
  it('should validate valid JPEG image buffer', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const res = MediaValidator.validate(jpegBuffer, 'image/jpeg');
    expect(res.mediaType).toBe('IMAGE');
    expect(res.mimeType).toBe('image/jpeg');
  });

  it('should validate valid PNG image buffer', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const res = MediaValidator.validate(pngBuffer, 'image/png');
    expect(res.mediaType).toBe('IMAGE');
    expect(res.mimeType).toBe('image/png');
  });

  it('should validate valid MP4 video buffer', () => {
    const mp4Buffer = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
    ]);
    const res = MediaValidator.validate(mp4Buffer, 'video/mp4');
    expect(res.mediaType).toBe('VIDEO');
    expect(res.mimeType).toBe('video/mp4');
  });

  it('should validate valid WEBM video buffer', () => {
    const webmBuffer = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42]);
    const res = MediaValidator.validate(webmBuffer, 'video/webm');
    expect(res.mediaType).toBe('VIDEO');
    expect(res.mimeType).toBe('video/webm');
  });

  it('should throw BadRequestException for unsupported MIME type', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    expect(() => MediaValidator.validate(buffer, 'application/pdf')).toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException for invalid magic byte signature', () => {
    const invalidBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    expect(() => MediaValidator.validate(invalidBuffer, 'image/jpeg')).toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException for oversized image buffer', () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const oversizedBuffer = Buffer.concat([
      jpegHeader,
      Buffer.alloc(IMAGE_MAX_SIZE + 100),
    ]);
    expect(() =>
      MediaValidator.validate(oversizedBuffer, 'image/jpeg'),
    ).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for oversized video buffer', () => {
    const mp4Header = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
    ]);
    const oversizedBuffer = Buffer.concat([
      mp4Header,
      Buffer.alloc(VIDEO_MAX_SIZE + 100),
    ]);
    expect(() => MediaValidator.validate(oversizedBuffer, 'video/mp4')).toThrow(
      BadRequestException,
    );
  });
});
