import 'server-only';
import { assertNoSecrets } from './context';
import { logAiCall } from './log';
import { CALL, isConfigured, MODELS } from './providers';
import { REQUEST_DEADLINES, resolveProviderTimeout, runProviderFallback } from './timeouts';
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
  const timeout = resolveProviderTimeout(req.task);
  const configured = ROUTES[req.task].filter(isConfigured);
  const started = Date.now();
  const providerStarted = new Map<Provider, number>();

  try {
    const result = await runProviderFallback({
      providers: ROUTES[req.task],
      configured,
      providerTimeoutMs: timeout,
      totalTimeoutMs: REQUEST_DEADLINES[req.task],
      call: (provider, signal) => {
        providerStarted.set(provider, Date.now());
        return CALL[provider]({ system: req.system, prompt: req.prompt, maxTokens, signal });
      },
      isUsable: (response) => Boolean(response.text.trim()),
    });
    const { provider, value, attempts } = result;
    const out: AiResponse = {
      text: value.text.trim(),
      provider,
      model: value.model,
      ms: Date.now() - (providerStarted.get(provider) ?? started),
      inputTokens: value.inputTokens,
      outputTokens: value.outputTokens,
      attempts,
    };
    void logAiCall({ task: req.task, provider, model: value.model, promptVersion: req.promptVersion, status: 'ok', ms: out.ms, inputTokens: value.inputTokens, outputTokens: value.outputTokens, responseChars: out.text.length, attempts, actorId: req.actorId, response: out.text });
    return out;
  } catch (error) {
    const attempts: Attempt[] = error instanceof AiError ? error.attempts : [];
    void logAiCall({ task: req.task, provider: null, model: null, promptVersion: req.promptVersion, status: 'error', ms: Date.now() - started, inputTokens: null, outputTokens: null, responseChars: 0, attempts, actorId: req.actorId });
    if (configured.length === 0) {
      throw new AiError(
        `No AI provider is configured for this task. Set one of: ${ROUTES[req.task].map((p) => p.toUpperCase() + '_API_KEY').join(', ')}.`,
        attempts,
      );
    }
    if (error instanceof AiError) throw error;
    throw new AiError('All AI providers failed. Try again shortly.', attempts);
  }
}

export { MODELS };
