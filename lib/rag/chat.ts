import { AiError } from '../ai/types';
import type { Chunk } from './chunk';
import { buildRagPrompt, CHATBOT_PROMPT_VERSION, CHATBOT_SYSTEM, type Turn } from './prompt';
import { scrubPii } from './safety';

export const NO_ANSWER = 'I do not have that information. I can only answer questions about the public products and documentation of HAMXELL CORE. You can ask your question through the contact page.';
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();

export const LIMITS = { messages: 12, chars: 1000, total: 6000, history: 4 } as const;

export function parseChatBody(body: unknown): { ok: true; question: string; history: Turn[] } | { ok: false; error: string } {
  const msgs = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(msgs) || msgs.length < 1 || msgs.length > LIMITS.messages) return { ok: false, error: 'Invalid conversation.' };
  const turns: Turn[] = [];
  let total = 0;
  for (const m of msgs) {
    const role = (m as { role?: unknown })?.role, content = (m as { content?: unknown })?.content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return { ok: false, error: 'Invalid conversation.' };
    const c = clean(content);
    if (!c || c.length > LIMITS.chars) return { ok: false, error: `Messages must be 1 to ${LIMITS.chars} characters.` };
    total += c.length;
    turns.push({ role, content: c });
  }
  if (total > LIMITS.total) return { ok: false, error: 'The conversation is too long. Please start a new one.' };
  if (turns[turns.length - 1].role !== 'user') return { ok: false, error: 'Invalid conversation.' };
  const question = turns[turns.length - 1].content;
  return { ok: true, question, history: turns.slice(0, -1).slice(-LIMITS.history) };
}

export interface ChatLog { question: string; answer: string; grounded: boolean; sources: string[]; provider: string | null; ms: number }
export interface ChatDeps {
  retrieve(question: string): Promise<Chunk[]>;
  generate(a: { system: string; prompt: string; promptVersion: string; maxTokens: number }): Promise<{ text: string; provider: string; model: string }>;
  log(e: ChatLog): Promise<void>;
}
export interface Source { title: string; url: string }
export type ChatResult = { status: 200; body: { answer: string; sources: Source[]; grounded: boolean } } | { status: 400 | 503; body: { error: string } };

/**
 * The public chatbot's whole decision process. It answers only from retrieved public sources: when retrieval finds nothing
 * it returns a fixed message WITHOUT calling any model, so an out-of-scope question can never be answered from the model's own knowledge.
 */
export async function answerPublic(body: unknown, deps: ChatDeps): Promise<ChatResult> {
  const parsed = parseChatBody(body);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  const t0 = Date.now();
  const chunks = await deps.retrieve(parsed.question);
  const logIt = (answer: string, grounded: boolean, provider: string | null, sources: string[]) =>
    deps.log({ question: scrubPii(parsed.question).slice(0, 300), answer: scrubPii(answer).slice(0, 600), grounded, sources, provider, ms: Date.now() - t0 }).catch(() => {});

  if (chunks.length === 0) {
    await logIt(NO_ANSWER, false, null, []);
    return { status: 200, body: { answer: NO_ANSWER, sources: [], grounded: false } };
  }
  let out;
  try {
    out = await deps.generate({ system: CHATBOT_SYSTEM, prompt: buildRagPrompt(parsed.question, parsed.history, chunks), promptVersion: CHATBOT_PROMPT_VERSION, maxTokens: 450 });
  } catch (e) {
    if (e instanceof AiError) return { status: 503, body: { error: 'The assistant is unavailable right now. Please use the contact page.' } };
    throw e;
  }
  const answer = out.text.trim().slice(0, 1500);
  const seen = new Set<string>();
  const sources = chunks.filter((c) => !seen.has(c.url) && seen.add(c.url)).map((c) => ({ title: c.title, url: c.url }));
  await logIt(answer, true, out.provider, sources.map((s) => s.url));
  return { status: 200, body: { answer, sources, grounded: true } };
}
