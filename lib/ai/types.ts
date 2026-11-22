export type Provider = 'gemini' | 'groq' | 'openrouter';
export type Task = 'docs' | 'import_summary' | 'chatbot' | 'knowledge';

export interface AiRequest {
  task: Task;
  system: string;
  prompt: string;
  promptVersion: string;
  maxTokens?: number;
  actorId?: string;
}
export interface Attempt { provider: Provider; error: string }
export interface AiResponse {
  text: string;
  provider: Provider;
  model: string;
  ms: number;
  inputTokens: number | null;
  outputTokens: number | null;
  attempts: Attempt[];
}
export class AiError extends Error {
  constructor(message: string, public attempts: Attempt[] = []) {
    super(message);
  }
}
