import { UnsupportedMediaTypeException } from '@nestjs/common';

export interface ValidatedMime {
  mimeType: string;
  extension: string;
}

export class MagicBytesValidator {
  /**
   * Validates binary buffer magic bytes against declared MIME type (AUTHORIZATION_MODEL.md §5.9).
   * Throws 415 Unsupported Media Type if headers do not match expected binary signatures.
   */
  static validate(buffer: Buffer, declaredMimeType: string): ValidatedMime {
    if (!buffer || buffer.length < 4) {
      throw new UnsupportedMediaTypeException('File buffer too short or empty');
    }

    const mime = declaredMimeType.toLowerCase().trim();

    // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      if (mime !== 'image/png' && mime !== 'application/octet-stream') {
        throw new UnsupportedMediaTypeException(`Declared MIME "${declaredMimeType}" does not match detected PNG signature`);
      }
      return { mimeType: 'image/png', extension: 'png' };
    }

    // 2. JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      if (mime !== 'image/jpeg' && mime !== 'image/jpg' && mime !== 'application/octet-stream') {
        throw new UnsupportedMediaTypeException(`Declared MIME "${declaredMimeType}" does not match detected JPEG signature`);
      }
      return { mimeType: 'image/jpeg', extension: 'jpg' };
    }

    // 3. WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      if (mime !== 'image/webp' && mime !== 'application/octet-stream') {
        throw new UnsupportedMediaTypeException(`Declared MIME "${declaredMimeType}" does not match detected WebP signature`);
      }
      return { mimeType: 'image/webp', extension: 'webp' };
    }

    // 4. PDF: 25 50 44 46 (%PDF)
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      if (mime !== 'application/pdf' && mime !== 'application/octet-stream') {
        throw new UnsupportedMediaTypeException(`Declared MIME "${declaredMimeType}" does not match detected PDF signature`);
      }
      return { mimeType: 'application/pdf', extension: 'pdf' };
    }

    throw new UnsupportedMediaTypeException(
      `Unsupported or corrupted file format. Declared: "${declaredMimeType}"`,
    );
  }
}
