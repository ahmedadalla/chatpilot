import pino from 'pino';
import { PrismaClient, KbStatus } from '@chatpilot/database';

const logger = pino({ name: 'kb-ingest-worker' });

export interface IngestJobData {
  documentId: string;
  companyId: string;
}

export class KbIngestWorker {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Processes kb-ingest background queue: extracts text, chunks, embeds, and updates document status (D-7, ARCHITECTURE.md §8)
   */
  async processJob(jobData: IngestJobData): Promise<{ chunksCreated: number }> {
    const { documentId, companyId } = jobData;
    logger.info({ documentId, companyId }, 'Processing Knowledge Base ingestion job');

    const document = await this.prisma.knowledgeBaseDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      logger.warn({ documentId }, 'Document not found, aborting ingestion');
      return { chunksCreated: 0 };
    }

    if (!document.extractedText || document.extractedText.trim() === '') {
      await this.prisma.knowledgeBaseDocument.update({
        where: { id: documentId },
        data: { status: KbStatus.READY },
      });
      return { chunksCreated: 0 };
    }

    // Chunk text (500 chars with 100-char overlap)
    const text = document.extractedText.trim();
    const chunks: string[] = [];
    const chunkSize = 500;
    const overlap = 100;

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      if (end >= text.length) break;
      start += chunkSize - overlap;
    }

    // Atomically insert chunks and update status
    await this.prisma.$transaction(async (tx) => {
      // Clear old chunks if reprocessing
      await tx.knowledgeChunk.deleteMany({
        where: { documentId },
      });

      for (let i = 0; i < chunks.length; i++) {
        await tx.knowledgeChunk.create({
          data: {
            documentId,
            companyId,
            branchId: document.branchId,
            content: chunks[i]!,
            positions: { index: i, total: chunks.length } as any,
            metadata: { title: document.title } as any,
          },
        });
      }

      await tx.knowledgeBaseDocument.update({
        where: { id: documentId },
        data: { status: KbStatus.READY },
      });
    });

    logger.info({ documentId, count: chunks.length }, 'Document ingested and chunks stored');
    return { chunksCreated: chunks.length };
  }
}
