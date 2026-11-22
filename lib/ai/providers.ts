import type { Provider } from './types';

export interface ProviderResult { text: string; model: string; inputTokens: number | null; outputTokens: number | null }
interface Call { system: string; prompt: string; maxTokens: number; signal: AbortSignal }

/* eslint-disable @typescript-eslint/no-explicit-any */
async function post(url: string, headers: Record<string, string>, body: unknown, signal: AbortSignal) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`); // body deliberately not echoed: it can contain request details
  return (await res.json()) as any;
}

export const MODELS: Record<Provider, () => string> = {
  gemini: () => process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  groq: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  openrouter: () => process.env.OPENROUTER_MODEL || 'openrouter/auto',
};
export const KEYS: Record<Provider, string> = { gemini: 'GEMINI_API_KEY', groq: 'GROQ_API_KEY', openrouter: 'OPENROUTER_API_KEY' };
export const isConfigured = (p: Provider) => Boolean(process.env[KEYS[p]]);

async function gemini(c: Call): Promise<ProviderResult> {
  const model = MODELS.gemini();
  const j = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    {
      systemInstruction: { parts: [{ text: c.system }] },
      contents: [{ role: 'user', parts: [{ text: c.prompt }] }],
      generationConfig: { maxOutputTokens: c.maxTokens, temperature: 0.3 },
    },
    c.signal,
  );
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
  return { text, model, inputTokens: j.usageMetadata?.promptTokenCount ?? null, outputTokens: j.usageMetadata?.candidatesTokenCount ?? null };
}

async function openAiCompatible(url: string, key: string, model: string, c: Call, extra: Record<string, string> = {}): Promise<ProviderResult> {
  const j = await post(
    url,
    { authorization: `Bearer ${key}`, ...extra },
    { model, max_tokens: c.maxTokens, temperature: 0.3, messages: [{ role: 'system', content: c.system }, { role: 'user', content: c.prompt }] },
    c.signal,
  );
  return { text: j.choices?.[0]?.message?.content ?? '', model: j.model ?? model, inputTokens: j.usage?.prompt_tokens ?? null, outputTokens: j.usage?.completion_tokens ?? null };
}

export const CALL: Record<Provider, (c: Call) => Promise<ProviderResult>> = {
  gemini,
  groq: (c) => openAiCompatible('https://api.groq.com/openai/v1/chat/completions', process.env.GROQ_API_KEY!, MODELS.groq(), c),
  openrouter: (c) =>
    openAiCompatible('https://openrouter.ai/api/v1/chat/completions', process.env.OPENROUTER_API_KEY!, MODELS.openrouter(), c, {
      'HTTP-Referer': process.env.APP_URL ?? 'http://localhost:3000',
      'X-Title': process.env.APP_NAME ?? 'HAMXELL CORE',
    }),
};
