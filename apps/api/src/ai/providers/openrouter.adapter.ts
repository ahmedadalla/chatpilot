import { Injectable } from '@nestjs/common';
import { AiProvider } from './ai-provider.interface';
import {
  AiCompletionRequest,
  AiCompletionResponse,
} from '@chatpilot/contracts';

@Injectable()
export class OpenRouterAdapter implements AiProvider {
  readonly id = 'openrouter' as const;

  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    return {
      text: 'AI response processed via OpenRouter router',
      usage: {
        promptTokens: 100,
        completionTokens: 20,
        totalTokens: 120,
      },
    };
  }
}
