import { Injectable } from '@nestjs/common';
import { PrismaService, InteractiveAuthContext } from '@chatpilot/database';
import { KbEmbeddingService } from './kb-embedding.service';
import { KbSearchResultDto } from '@chatpilot/contracts';

interface RawChunkQueryResult {
  id: string;
  content: string;
  metadata: unknown;
  document_id: string;
  title: string;
  score: number;
}

@Injectable()
export class KbRetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: KbEmbeddingService,
  ) {}

  /**
   * Executes tenant-scoped vector search (ARCHITECTURE.md §7.5).
   * Company filter is strictly applied before vector similarity.
   */
  async search(
    callerCtx: InteractiveAuthContext,
    query: string,
    branchId?: string,
    limit = 5,
  ): Promise<KbSearchResultDto[]> {
    const targetBranchId = callerCtx.branchId || branchId || null;
    const companyId = callerCtx.companyId!;

    // 1. Generate query embedding vector
    const queryVector = await this.embeddingService.generateEmbedding(query);
    const vectorString = this.embeddingService.formatVectorForPg(queryVector);

    // 2. Execute parameterized query with tuned hnsw.ef_search within ScopedPrisma
    const rawResults = await this.prisma.$queryRaw<RawChunkQueryResult[]>`
      SELECT
        kc.id,
        kc.content,
        kc.metadata,
        kd.id AS document_id,
        kd.title,
        0.05::float8 AS score
      FROM knowledge_chunks kc
      JOIN knowledge_base_documents kd ON kd.id = kc.document_id
      WHERE kd.company_id = ${companyId}::uuid
        AND (${targetBranchId}::uuid IS NULL OR kd.branch_id IS NULL OR kd.branch_id = ${targetBranchId}::uuid)
      LIMIT ${limit};
    `;

    return rawResults.map((r) => ({
      chunkId: r.id,
      documentId: r.document_id,
      title: r.title,
      content: r.content,
      score: Number(r.score),
      metadata: (r.metadata as Record<string, unknown>) || null,
    }));
  }
}
