import { AiError } from '../ai/types';
import type { Chunk } from './chunk';
import { tokenize } from './bm25';
import { PublicDataUnavailableError } from './errors';
import { buildRagPrompt, CHATBOT_PROMPT_VERSION, CHATBOT_SYSTEM, type Turn } from './prompt';
import { scrubPii } from './safety';

export const CHAT_UNAVAILABLE = 'The assistant is unavailable right now. Please try again later.';
export const NO_GROUNDED_ANSWER = 'I could not verify an answer from the public information available. Please check the public products or documentation, or contact HAMXELL CORE.';
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
const GREETING = /^(?:hi|hello|hey|hiya|howdy|good morning|good afternoon|good evening)(?:[\s,!.?]+(?:there|hamxell core|assistant))*[\s!.?]*$/i;
const GREETING_ANSWER = 'Hello. I’m the HAMXELL CORE assistant. I can help with public products and published documentation. What would you like to know?';

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

interface ProviderClaim { source: number; text: string }

function answersQuestion(question: string, excerpt: string, overlap: number, questionTerms: Set<string>): boolean {
  const q = question.toLowerCase().trim();
  const text = excerpt.toLowerCase();
  const coverage = overlap / Math.max(questionTerms.size, 1);
  const asksForDirectory = /\b(?:products?|documentation|docs|pages?)\b/.test(q) &&
    /\b(?:list|listed|publish|published|available|exist|include|show)\b/.test(q);
  if (coverage < (asksForDirectory ? 0.4 : 0.6)) return false;

  if (/^(?:when|what date|what time|how long)\b/.test(q)) {
    return /\b(?:19|20)\d{2}\b|\b\d{1,2}:\d{2}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b|\b(?:day|week|month|year|hour|minute)s?\b/.test(text);
  }
  if (/^(?:where|what location)\b/.test(q)) {
    return /\b(?:located|based|headquartered|situated|operates|in|at|near|from)\b/.test(text);
  }
  if (/^(?:who|whose)\b/.test(q)) {
    return /\b(?:by|founder|founded|created|maintained|led|author|owner)\b/.test(text);
  }
  if (/^why\b/.test(q)) {
    return /\b(?:because|due to|reason|so that|in order to|allows|enables)\b/.test(text);
  }
  if (/^how many\b|^how much\b/.test(q)) {
    return /\b\d+\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand)\b/.test(text);
  }
  if (/^how\b/.test(q)) {
    return /\b(?:by|using|via|through|step|first|then|finally|configure|select|install)\b/.test(text);
  }

  if (asksForDirectory) {
    return /\b(?:no|none|available|directory|listings?|published|include|contains?)\b/.test(text);
  }
  if (/^what\s+(?:is|are)\b/.test(q)) {
    return /\b(?:is|are|means|refers to|serves as|known as|defined as)\b/.test(text);
  }

  return coverage >= 0.75;
}

function verifiedClaims(text: string, question: string, chunks: Chunk[]): ProviderClaim[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return [];
  }
  if (!value || typeof value !== 'object' || !Array.isArray((value as { claims?: unknown }).claims)) return [];

  const questionTerms = new Set(tokenize(question));
  const claims: ProviderClaim[] = [];
  const seen = new Set<string>();
  let total = 0;
  for (const candidate of (value as { claims: unknown[] }).claims) {
    if (!candidate || typeof candidate !== 'object') continue;
    const source = (candidate as { source?: unknown }).source;
    const text = (candidate as { text?: unknown }).text;
    if (!Number.isInteger(source) || typeof text !== 'string' || !text.trim() || text !== text.trim()) continue;
    const chunk = chunks[(source as number) - 1];
    if (!chunk || chunk.contextOnly || !chunk.text.includes(text) || seen.has(text)) continue;
    const claimTerms = new Set(tokenize(text));
    const overlap = [...questionTerms].filter((term) => claimTerms.has(term)).length;
    if (!overlap || !answersQuestion(question, text, overlap, questionTerms)) continue;
    if (total + text.length > 1500 || claims.length >= 5) continue;
    claims.push({ source: source as number, text });
    seen.add(text);
    total += text.length;
  }
  return claims;
}

/** Public answers are extractive: only exact, question-relevant source excerpts are returned as grounded claims. */
export async function answerPublic(body: unknown, deps: ChatDeps): Promise<ChatResult> {
  const parsed = parseChatBody(body);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
  const t0 = Date.now();
  const logIt = (answer: string, grounded: boolean, provider: string | null, sources: string[]) =>
    deps.log({ question: scrubPii(parsed.question).slice(0, 300), answer: scrubPii(answer).slice(0, 600), grounded, sources, provider, ms: Date.now() - t0 }).catch(() => {});

  if (GREETING.test(parsed.question)) {
    await logIt(GREETING_ANSWER, false, null, []);
    return { status: 200, body: { answer: GREETING_ANSWER, sources: [], grounded: false } };
  }
  let chunks: Chunk[];
  try {
    chunks = await deps.retrieve(parsed.question);
  } catch (e) {
    if (e instanceof PublicDataUnavailableError) {
      console.error('public chatbot data unavailable', e.source);
      await logIt(CHAT_UNAVAILABLE, false, null, []);
      return { status: 503, body: { error: CHAT_UNAVAILABLE } };
    }
    throw e;
  }
  let out;
  try {
    out = await deps.generate({ system: CHATBOT_SYSTEM, prompt: buildRagPrompt(parsed.question, parsed.history, chunks), promptVersion: CHATBOT_PROMPT_VERSION, maxTokens: 450 });
  } catch (e) {
    if (e instanceof AiError) {
      await logIt(CHAT_UNAVAILABLE, false, null, []);
      return { status: 503, body: { error: CHAT_UNAVAILABLE } };
    }
    throw e;
  }
  const claims = verifiedClaims(out.text, parsed.question, chunks);
  const answer = claims.length ? claims.map((claim) => claim.text).join('\n') : NO_GROUNDED_ANSWER;
  const seen = new Set<string>();
  const citedChunks = claims.map((claim) => chunks[claim.source - 1]);
  const sources = citedChunks.filter((c) => !seen.has(c.url) && seen.add(c.url)).map((c) => ({ title: c.title, url: c.url }));
  const grounded = claims.length > 0;
  await logIt(answer, grounded, out.provider, sources.map((s) => s.url));
  return { status: 200, body: { answer, sources, grounded } };
}
