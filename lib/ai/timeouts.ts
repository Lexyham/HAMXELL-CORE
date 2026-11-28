import { AiError, type Attempt, type Provider, type Task } from './types';

const PROVIDER_DEFAULTS: Record<Task, number> = {
  docs: 30_000,
  import_summary: 30_000,
  chatbot: 20_000,
  knowledge: 25_000,
};

export const REQUEST_DEADLINES: Record<Task, number> = {
  docs: 60_000,
  import_summary: 60_000,
  chatbot: 35_000,
  knowledge: 40_000,
};

export function resolveProviderTimeout(task: Task, rawOverride = process.env.AI_TIMEOUT_MS): number {
  if (rawOverride === undefined) return PROVIDER_DEFAULTS[task];
  if (!/^\d+$/.test(rawOverride)) throw new AiError('AI_TIMEOUT_MS must be an integer from 1000 to 120000 milliseconds.');
  const timeout = Number(rawOverride);
  if (!Number.isSafeInteger(timeout) || timeout < 1_000 || timeout > 120_000) {
    throw new AiError('AI_TIMEOUT_MS must be an integer from 1000 to 120000 milliseconds.');
  }
  return timeout;
}

export async function runProviderFallback<T>(options: {
  providers: Provider[];
  configured: Provider[];
  providerTimeoutMs: number;
  totalTimeoutMs: number;
  call: (provider: Provider, signal: AbortSignal) => Promise<T>;
  isUsable: (value: T) => boolean;
}): Promise<{ provider: Provider; value: T; attempts: Attempt[] }> {
  const { providers, configured, providerTimeoutMs, totalTimeoutMs, call, isUsable } = options;
  const attempts: Attempt[] = [];
  const deadline = Date.now() + totalTimeoutMs;

  for (const provider of providers) {
    if (!configured.includes(provider)) {
      attempts.push({ provider, error: 'not configured' });
      continue;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    const limitedByDeadline = remaining <= providerTimeoutMs;
    const attemptTimeout = Math.min(providerTimeoutMs, remaining);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      const timedOut = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new DOMException('Provider request timed out.', 'AbortError'));
        }, attemptTimeout);
      });
      const value = await Promise.race([call(provider, controller.signal), timedOut]);
      if (!isUsable(value)) throw new Error('empty response');
      return { provider, value, attempts };
    } catch (error) {
      const deadlineExpired = Date.now() >= deadline || (limitedByDeadline && controller.signal.aborted);
      const errorName = error instanceof Error ? error.name : '';
      const errorMessage = error instanceof Error ? error.message : 'Provider request failed.';
      const message = deadlineExpired
        ? 'overall request deadline exceeded'
        : errorName === 'AbortError'
          ? 'timed out'
          : errorMessage;
      attempts.push({ provider, error: message });
      if (deadlineExpired) throw new AiError('AI request deadline exceeded. Try again shortly.', attempts);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  if (Date.now() >= deadline) {
    throw new AiError('AI request deadline exceeded. Try again shortly.', attempts);
  }
  throw new AiError('All AI providers failed. Try again shortly.', attempts);
}
