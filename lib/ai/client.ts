import 'server-only';
import { assertNoSecrets } from './context';
import { logAiCall } from './log';
import { CALL, isConfigured, MODELS } from './providers';
import { AiError, type AiRequest, type AiResponse, type Attempt, type Provider, type Task } from './types';

/** Per-task provider order (spec section 10). Chatbot and knowledge routes are wired now and used in Phase 10. */
export const ROUTES: Record<Task, Provider[]> = {
  docs: ['gemini', 'openrouter', 'groq'],
  import_summary: ['groq', 'openrouter', 'gemini'],
  chatbot: ['openrouter', 'groq'],
  knowledge: ['gemini', 'openrouter'],
};

export const configuredProviders = (): Provider[] => (['gemini', 'groq', 'openrouter'] as Provider[]).filter(isConfigured);
const clamp = (n: number) => Math.max(256, Math.min(n, Number(process.env.AI_MAX_TOKENS_PER_CALL ?? 4096)));

/** Provider-agnostic generation with automatic fallback, hard token caps, secret screening and logging. */
export async function generate(req: AiRequest): Promise<AiResponse> {
  assertNoSecrets(req.system);
  assertNoSecrets(req.prompt);
  const maxTokens = clamp(req.maxTokens ?? 2048);
  const taskTimeouts: Record<Task, number> = { docs: 30000, import_summary: 30000, chatbot: 20000, knowledge: 25000 };
  const timeout = Number(process.env.AI_TIMEOUT_MS ?? taskTimeouts[req.task]);
  const attempts: Attempt[] = [];
  const started = Date.now();

  for (const provider of ROUTES[req.task]) {
    if (!isConfigured(provider)) {
      attempts.push({ provider, error: 'not configured' });
      continue;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeout);
    const t0 = Date.now();
    try {
      const r = await CALL[provider]({ system: req.system, prompt: req.prompt, maxTokens, signal: ctl.signal });
      if (!r.text.trim()) throw new Error('empty response');
      const out: AiResponse = { text: r.text.trim(), provider, model: r.model, ms: Date.now() - t0, inputTokens: r.inputTokens, outputTokens: r.outputTokens, attempts };
      void logAiCall({ task: req.task, provider, model: r.model, promptVersion: req.promptVersion, status: 'ok', ms: out.ms, inputTokens: r.inputTokens, outputTokens: r.outputTokens, responseChars: out.text.length, attempts, actorId: req.actorId, response: out.text });
      return out;
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? 'timed out' : (e as Error).message;
      attempts.push({ provider, error: msg });
    } finally {
      clearTimeout(timer);
    }
  }

  void logAiCall({ task: req.task, provider: null, model: null, promptVersion: req.promptVersion, status: 'error', ms: Date.now() - started, inputTokens: null, outputTokens: null, responseChars: 0, attempts, actorId: req.actorId });
  const usable = ROUTES[req.task].filter(isConfigured);
  throw new AiError(
    usable.length === 0
      ? `No AI provider is configured for this task. Set one of: ${ROUTES[req.task].map((p) => p.toUpperCase() + '_API_KEY').join(', ')}.`
      : 'All AI providers failed. Try again shortly.',
    attempts,
  );
}

export { MODELS };
