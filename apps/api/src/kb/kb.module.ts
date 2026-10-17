import { Module } from '@nestjs/common';
import { KbController } from './kb.controller';
import { KbDocumentService } from './kb-document.service';
import { KbRetrievalService } from './kb-retrieval.service';
import { KbEmbeddingService } from './kb-embedding.service';
import { PrismaService } from '@chatpilot/database';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [KbController],
  providers: [
    KbDocumentService,
    KbRetrievalService,
    KbEmbeddingService,
    PrismaService,
  ],
  exports: [
    KbDocumentService,
    KbRetrievalService,
    KbEmbeddingService,
  ],
})
export class KbModule {}
