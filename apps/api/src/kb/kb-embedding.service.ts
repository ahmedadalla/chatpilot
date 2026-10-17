import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class KbEmbeddingService {
  readonly EMBEDDING_DIMENSION = 1536;

  /**
   * Generates a normalized 1536-dimensional vector embedding for text.
   * Produces an L2-normalized float array suitable for pgvector cosine distance (<=>).
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const vector = new Array<number>(this.EMBEDDING_DIMENSION).fill(0);
    const cleaned = text.trim().toLowerCase();

    // Deterministic pseudo-embedding based on sha256 hash buckets for test/offline environments
    const hash = createHash('sha256').update(cleaned).digest();

    for (let i = 0; i < this.EMBEDDING_DIMENSION; i++) {
      const byte = hash[i % hash.length]!;
      // Generate centered float between -1.0 and 1.0
      vector[i] = (byte - 128) / 128;
    }

    // L2-normalize vector to unit length
    let norm = 0;
    for (let i = 0; i < this.EMBEDDING_DIMENSION; i++) {
      norm += vector[i]! * vector[i]!;
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.EMBEDDING_DIMENSION; i++) {
        vector[i] = vector[i]! / norm;
      }
    }

    return vector;
  }

  /**
   * Formats a float array into a pgvector string representation: '[0.012,-0.034,...]'
   */
  formatVectorForPg(vector: number[]): string {
    return `[${vector.map((v) => v.toFixed(6)).join(',')}]`;
  }
}
