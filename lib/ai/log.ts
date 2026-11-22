import type { Attempt, Provider, Task } from './types';

export interface AiLogEntry {
  task: Task;
  provider: Provider | null;
  model: string | null;
  promptVersion: string;
  status: 'ok' | 'error';
  ms: number;
  inputTokens: number | null;
  outputTokens: number | null;
  responseChars: number;
  attempts: Attempt[];
  actorId?: string;
  response?: string;
}

/**
 * Records every AI call (provider, model, tokens, latency, failover attempts). Prompt and response bodies are not stored here;
 * raw responses move to MongoDB `raw_ai_responses` in Phase 8. Logging must never break generation.
 */
export async function logAiCall(e: AiLogEntry) {
  try {
    const { mongoConfigured, getDb } = await import('../db/mongo');
    if (mongoConfigured()) {
      await (await getDb()).collection('raw_ai_responses').insertOne({
        task: e.task, provider: e.provider, model: e.model, promptVersion: e.promptVersion, status: e.status, ms: e.ms,
        inputTokens: e.inputTokens, outputTokens: e.outputTokens, costUsd: null, // cost needs verified per-model pricing
        attempts: e.attempts, response: e.response ? e.response.slice(0, 50_000) : null, actorId: e.actorId ?? null, createdAt: new Date(),
      });
      return;
    }
  } catch (err) {
    console.error('mongo ai log failed, using fallback:', (err as Error).message);
  }
  try {
    const { serviceClient } = await import('../supabase/admin');
    await serviceClient().from('ai_call_logs').insert({
      task: e.task,
      provider: e.provider,
      model: e.model,
      prompt_version: e.promptVersion,
      status: e.status,
      ms: e.ms,
      input_tokens: e.inputTokens,
      output_tokens: e.outputTokens,
      response_chars: e.responseChars,
      attempts: e.attempts,
      actor_id: e.actorId ?? null,
    });
  } catch (err) {
    console.error('ai log failed', (err as Error).message);
  }
}
