import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import { MagicBytesValidator } from './magic-bytes.validator';
import { FilePurpose, Capability } from '@chatpilot/contracts';
import { randomUUID } from 'node:crypto';

// Mapping per AUTHORIZATION_MODEL.md §5.9
export const PURPOSE_PERMISSIONS: Record<
  FilePurpose,
  { readCap: Capability; uploadCap?: Capability; maxSize: number }
> = {
  'menu-image': {
    readCap: 'menu:read',
    uploadCap: 'menu:write',
    maxSize: 5 * 1024 * 1024, // 5 MB
  },
  'kb-document': {
    readCap: 'kb:write/read', // kb:read in matrix is kb:write/read
    uploadCap: 'kb:write/read',
    maxSize: 20 * 1024 * 1024, // 20 MB
  },
  'receipt': {
    readCap: 'orders:read',
    maxSize: 10 * 1024 * 1024, // 10 MB
  },
  'avatar': {
    readCap: 'staff:self:read',
    uploadCap: 'staff:self:read',
    maxSize: 2 * 1024 * 1024, // 2 MB
  },
};

@Injectable()
export class FileService {
  private readonly s3Bucket: string;
  private readonly s3Endpoint: string;

  constructor(private readonly prisma: PrismaService) {
    this.s3Bucket = process.env['S3_BUCKET'] || 'chatpilot-uploads';
    this.s3Endpoint = process.env['S3_ENDPOINT'] || 'https://storage.chatpilot.io';
  }

  /**
   * Validates binary buffer, checks upload permissions, and saves metadata.
   */
  async uploadFile(
    callerCtx: InteractiveAuthContext,
    purpose: FilePurpose,
    buffer: Buffer,
    filename: string,
    declaredMime: string,
  ) {
    const purposeConfig = PURPOSE_PERMISSIONS[purpose];
    if (!purposeConfig) {
      throw new BadRequestException(`Invalid file purpose "${purpose}"`);
    }

    // 1. Permission check for upload
    if (purposeConfig.uploadCap && !callerCtx.capabilities.has(purposeConfig.uploadCap)) {
      throw new ForbiddenException(`Insufficient permissions to upload files for purpose "${purpose}"`);
    }

    // 2. Size limit validation
    if (buffer.length > purposeConfig.maxSize) {
      throw new BadRequestException(
        `File size ${buffer.length} bytes exceeds maximum allowed ${purposeConfig.maxSize} bytes for ${purpose}`,
      );
    }

    // 3. Magic-byte signature verification (returns 415 on mismatch)
    const { mimeType } = MagicBytesValidator.validate(buffer, declaredMime);

    // 4. Generate private S3 storage key
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `companies/${callerCtx.companyId}/${purpose}/${randomUUID()}-${sanitizedFilename}`;

    // 5. Persist metadata in database
    return this.prisma.file.create({
      data: {
        companyId: callerCtx.companyId!,
        purpose,
        storageKey,
        filename: sanitizedFilename,
        mimeType,
        sizeBytes: buffer.length,
      },
    });
  }

  /**
   * Generates a short-lived presigned URL (≤ 5 min) gated by caller's capability for the file's purpose tag.
   */
  async getPresignedUrl(callerCtx: InteractiveAuthContext, fileId: string) {
    // 1. Fetch file record (non-leaking 404 for cross-tenant attempts)
    const file = await this.prisma.file.findFirst({
      where: {
        id: fileId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // 2. Capability check against purpose tag
    const purpose = file.purpose as FilePurpose;
    const purposeConfig = PURPOSE_PERMISSIONS[purpose];

    if (!purposeConfig || !callerCtx.capabilities.has(purposeConfig.readCap)) {
      throw new ForbiddenException(
        `Insufficient permissions to access file of purpose "${file.purpose}". Required: "${purposeConfig?.readCap}"`,
      );
    }

    // 3. Generate presigned URL (TTL 300 seconds / 5 minutes)
    const expiresInSeconds = 300;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    const presignedUrl = `${this.s3Endpoint}/${this.s3Bucket}/${file.storageKey}?token=${randomUUID()}&exp=${Math.floor(expiresAt.getTime() / 1000)}`;

    return {
      url: presignedUrl,
      expiresInSeconds,
      expiresAt,
    };
  }
}
