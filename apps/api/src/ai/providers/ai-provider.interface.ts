import {
  AiCompletionRequest,
  AiCompletionResponse,
} from '@chatpilot/contracts';

export interface AiProvider {
  id: 'gemini' | 'openai' | 'openrouter';
  complete(req: AiCompletionRequest): Promise<AiCompletionResponse>;
}
