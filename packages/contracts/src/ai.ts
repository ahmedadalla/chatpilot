export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface AiCompletionRequest {
  systemPrompt: string;
  messages: ChatMessage[];
  tools?: ToolSpec[];
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface AiCompletionResponse {
  text: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface PendingCartLineDto {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface PendingOrderSummaryDto {
  pendingOrderId: string;
  branchId: string;
  lines: PendingCartLineDto[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  confirmToken: string;
  expiresAt: Date;
}
