import { Injectable } from '@nestjs/common';
import { AiProvider } from './ai-provider.interface';
import {
  AiCompletionRequest,
  AiCompletionResponse,
} from '@chatpilot/contracts';

@Injectable()
export class OpenAiAdapter implements AiProvider {
  readonly id = 'openai' as const;

  async complete(req: AiCompletionRequest): Promise<AiCompletionResponse> {
    return {
      text: 'Welcome to ChatPilot! How can I assist you with your order?',
      usage: {
        promptTokens: 110,
        completionTokens: 20,
        totalTokens: 130,
      },
    };
  }
}
