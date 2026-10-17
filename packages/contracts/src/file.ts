export type FilePurpose = 'menu-image' | 'kb-document' | 'receipt' | 'avatar';

export interface UploadFileResponseDto {
  id: string;
  companyId: string;
  purpose: FilePurpose;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}

export interface PresignedUrlResponseDto {
  url: string;
  expiresInSeconds: number;
  expiresAt: Date;
}
