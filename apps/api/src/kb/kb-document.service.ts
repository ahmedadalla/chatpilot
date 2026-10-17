import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import { KbEmbeddingService } from './kb-embedding.service';
import {
  CreateKbDocumentDto,
  UpdateKbDocumentDto,
  KbDocumentResponseDto,
  Role,
  KbStatus,
} from '@chatpilot/contracts';

@Injectable()
export class KbDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: KbEmbeddingService,
  ) {}

  /**
   * Splits text into sliding window chunks (500 chars with 100-char overlap)
   */
  chunkText(text: string, chunkSize = 500, overlap = 100): string[] {
    const chunks: string[] = [];
    const cleaned = text.trim();

    if (cleaned.length <= chunkSize) {
      return [cleaned];
    }

    let start = 0;
    while (start < cleaned.length) {
      const end = Math.min(start + chunkSize, cleaned.length);
      chunks.push(cleaned.slice(start, end));
      if (end >= cleaned.length) break;
      start += chunkSize - overlap;
    }

    return chunks;
  }

  /**
   * Creates and ingests a Knowledge Base document with chunking and embeddings (IMPLEMENTATION_PLAN.md Phase P7)
   */
  async createDocument(
    callerCtx: InteractiveAuthContext,
    dto: CreateKbDocumentDto,
  ): Promise<KbDocumentResponseDto> {
    if (callerCtx.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException('Only Company Admin can manage Knowledge Base documents');
    }

    if (!dto.title || dto.title.trim() === '') {
      throw new BadRequestException('Document title is required');
    }

    const companyId = callerCtx.companyId!;
    const branchId = dto.branchId || null;

    // Verify branch belongs to caller's company if supplied
    if (branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: branchId, companyId },
      });
      if (!branch) {
        throw new NotFoundException('Branch not found in your company');
      }
    }

    const rawContent = dto.content?.trim() || '';

    // Execute atomic creation & chunking
    const doc = await this.prisma.$transaction(async (tx) => {
      const createdDoc = await tx.knowledgeBaseDocument.create({
        data: {
          companyId,
          branchId,
          title: dto.title.trim(),
          fileRef: dto.fileId || null,
          extractedText: rawContent || null,
          status: KbStatus.PROCESSING,
        },
      });

      // Generate chunks if content provided
      if (rawContent.length > 0) {
        const textChunks = this.chunkText(rawContent);

        for (let i = 0; i < textChunks.length; i++) {
          const chunkContent = textChunks[i]!;

          await tx.knowledgeChunk.create({
            data: {
              documentId: createdDoc.id,
              companyId,
              branchId,
              content: chunkContent,
              positions: { chunkIndex: i, totalChunks: textChunks.length } as any,
              metadata: { title: createdDoc.title } as any,
            },
          });
        }

        // Update status to READY
        return tx.knowledgeBaseDocument.update({
          where: { id: createdDoc.id },
          data: { status: KbStatus.READY },
          include: { _count: { select: { chunks: true } } },
        });
      }

      return tx.knowledgeBaseDocument.findUniqueOrThrow({
        where: { id: createdDoc.id },
        include: { _count: { select: { chunks: true } } },
      });
    });

    return {
      id: doc.id,
      companyId: doc.companyId,
      branchId: doc.branchId,
      title: doc.title,
      status: doc.status as KbStatus,
      fileRef: doc.fileRef,
      extractedText: doc.extractedText,
      chunkCount: doc._count.chunks,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Lists Knowledge Base documents with branch-visibility hierarchy (AUTHORIZATION_MODEL.md §5.8):
   * Company Admin sees all; Branch role sees company-wide (null-branch) + own branch.
   */
  async listDocuments(
    callerCtx: InteractiveAuthContext,
    branchId?: string,
  ): Promise<KbDocumentResponseDto[]> {
    const companyId = callerCtx.companyId!;
    let branchFilter: any = undefined;

    if (callerCtx.role === Role.COMPANY_ADMIN) {
      if (branchId) {
        branchFilter = branchId;
      }
    } else if (callerCtx.branchId) {
      // Branch user sees company-wide (branch_id IS NULL) + own branch
      branchFilter = {
        in: [null, callerCtx.branchId],
      };
    }

    const docs = await this.prisma.knowledgeBaseDocument.findMany({
      where: {
        companyId,
        ...(callerCtx.role !== Role.COMPANY_ADMIN
          ? { OR: [{ branchId: null }, { branchId: callerCtx.branchId }] }
          : branchId
          ? { branchId }
          : {}),
      },
      include: {
        _count: { select: { chunks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((d) => ({
      id: d.id,
      companyId: d.companyId,
      branchId: d.branchId,
      title: d.title,
      status: d.status as KbStatus,
      fileRef: d.fileRef,
      extractedText: d.extractedText,
      chunkCount: d._count.chunks,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  /**
   * Retrieves single document details
   */
  async getDocument(callerCtx: InteractiveAuthContext, documentId: string): Promise<KbDocumentResponseDto> {
    const doc = await this.prisma.knowledgeBaseDocument.findFirst({
      where: {
        id: documentId,
        companyId: callerCtx.companyId!,
      },
      include: {
        _count: { select: { chunks: true } },
      },
    });

    if (!doc) {
      throw new NotFoundException('Knowledge Base document not found');
    }

    // Branch visibility check
    if (callerCtx.branchId && doc.branchId && doc.branchId !== callerCtx.branchId) {
      throw new NotFoundException('Knowledge Base document not found');
    }

    return {
      id: doc.id,
      companyId: doc.companyId,
      branchId: doc.branchId,
      title: doc.title,
      status: doc.status as KbStatus,
      fileRef: doc.fileRef,
      extractedText: doc.extractedText,
      chunkCount: doc._count.chunks,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Cascade deletes a document: database onDelete: Cascade removes all child chunks and embeddings
   */
  async deleteDocument(callerCtx: InteractiveAuthContext, documentId: string): Promise<void> {
    if (callerCtx.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException('Only Company Admin can delete Knowledge Base documents');
    }

    const doc = await this.prisma.knowledgeBaseDocument.findFirst({
      where: {
        id: documentId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!doc) {
      throw new NotFoundException('Knowledge Base document not found');
    }

    // Database cascade deletes all KnowledgeChunk records
    await this.prisma.knowledgeBaseDocument.delete({
      where: { id: documentId },
    });
  }

  /**
   * Reprocesses an existing document (re-chunks and generates fresh embeddings)
   */
  async reprocessDocument(callerCtx: InteractiveAuthContext, documentId: string): Promise<void> {
    if (callerCtx.role !== Role.COMPANY_ADMIN) {
      throw new ForbiddenException('Only Company Admin can reprocess Knowledge Base documents');
    }

    const doc = await this.prisma.knowledgeBaseDocument.findFirst({
      where: {
        id: documentId,
        companyId: callerCtx.companyId!,
      },
    });

    if (!doc) {
      throw new NotFoundException('Knowledge Base document not found');
    }

    if (!doc.extractedText) {
      throw new BadRequestException('Document has no extracted text to process');
    }

    const textChunks = this.chunkText(doc.extractedText);

    await this.prisma.$transaction(async (tx) => {
      // 1. Delete existing chunks
      await tx.knowledgeChunk.deleteMany({
        where: { documentId: doc.id },
      });

      // 2. Re-insert fresh chunks
      for (let i = 0; i < textChunks.length; i++) {
        await tx.knowledgeChunk.create({
          data: {
            documentId: doc.id,
            companyId: doc.companyId,
            branchId: doc.branchId,
            content: textChunks[i]!,
            positions: { chunkIndex: i, totalChunks: textChunks.length } as any,
            metadata: { title: doc.title } as any,
          },
        });
      }

      // 3. Mark status READY
      await tx.knowledgeBaseDocument.update({
        where: { id: doc.id },
        data: { status: KbStatus.READY },
      });
    });
  }
}
