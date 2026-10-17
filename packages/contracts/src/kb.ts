import { KbStatus } from './enums';

export interface CreateKbDocumentDto {
  title: string;
  branchId?: string;
  fileId?: string;
  content?: string;
}

export interface UpdateKbDocumentDto {
  title?: string;
  branchId?: string;
}

export interface KbDocumentResponseDto {
  id: string;
  companyId: string;
  branchId: string | null;
  title: string;
  status: KbStatus;
  fileRef: string | null;
  extractedText: string | null;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface KbSearchResultDto {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown> | null;
}

export interface SearchKbDto {
  query: string;
  branchId?: string;
  limit?: number;
}
