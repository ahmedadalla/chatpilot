import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { GeminiAdapter } from './providers/gemini.adapter';
import { OpenAiAdapter } from './providers/openai.adapter';
import { OpenRouterAdapter } from './providers/openrouter.adapter';
import { AiToolsService } from './tools/ai-tools.service';
import { PendingOrderService } from './tools/pending-order.service';
import { MenuModule } from '../menu/menu.module';
import { OrderModule } from '../order/order.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '@chatpilot/database';

@Module({
  imports: [MenuModule, OrderModule, AuthModule],
  controllers: [AiController],
  providers: [
    AiOrchestratorService,
    GeminiAdapter,
    OpenAiAdapter,
    OpenRouterAdapter,
    AiToolsService,
    PendingOrderService,
    PrismaService,
  ],
  exports: [AiOrchestratorService, AiToolsService, PendingOrderService, GeminiAdapter],
})
export class AiModule {}
