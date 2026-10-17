import { Injectable } from '@nestjs/common';
import { AiProvider } from './ai-provider.interface';
import {
  AiCompletionRequest,
  AiCompletionResponse,
} from '@chatpilot/contracts';

@Injectable()
export class GeminiAdapter implements AiProvider {
  readonly id = 'gemini' as const;

  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    return {
      text: 'مرحباً بك في شات بايلوت! كيف يمكنني مساعدتك اليوم؟',
      usage: {
        promptTokens: 120,
        completionTokens: 25,
        totalTokens: 145,
      },
    };
  }
}
