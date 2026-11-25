'use server';

import { logActivity } from '@/lib/activity';
import { generate } from '@/lib/ai/client';
import { AiError } from '@/lib/ai/types';
import { requireAdmin } from '@/lib/auth';
import { flag } from '@/lib/flags';
import { buildRagPrompt, KNOWLEDGE_PROMPT_VERSION, KNOWLEDGE_SYSTEM, type Turn } from '@/lib/rag/prompt';
import { buildAdminCorpus } from '@/lib/rag/corpus';
import { rateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export interface KnowledgeAnswer { answer: string; sources: { title: string; url: string }[]; provider: string; model: string }

/**
 * Private Knowledge Engine: retrieval over every record the signed-in admin can see, answered by Gemini (OpenRouter as fallback).
 * The corpus is built from the admin's own session, so database policies apply, and it has no access to the credentials vault.
 */
export async function askKnowledge(question: string, history: Turn[]): Promise<KnowledgeAnswer | { error: string }> {
  const { user, email } = await requireAdmin();
  if (!flag('FEATURE_KNOWLEDGE_ENGINE')) return { error: 'The Knowledge Engine is switched off.' };
  const q = String(question ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (!q || q.length > 1000) return { error: 'Ask a question of up to 1,000 characters.' };
  if (!(await rateLimit(`knowledge:${user.id}`, 30, 60 * 60 * 1000))) return { error: 'Question limit reached (30 per hour). Try again later.' };

  const turns = (Array.isArray(history) ? history : []).filter((t) => (t?.role === 'user' || t?.role === 'assistant') && typeof t.content === 'string').slice(-6).map((t) => ({ role: t.role, content: t.content.slice(0, 1500) })) as Turn[];

  const corpus = await buildAdminCorpus(createClient(), user.id);
  const hits = corpus.index.search(q, 8).map((h) => corpus.byId.get(h.id)!).filter(Boolean);
  await logActivity({ actorId: user.id, actorEmail: email, action: 'knowledge.ask', meta: { sources: hits.length, chars: q.length } }); // the question text is not logged
  if (hits.length === 0) {
    return { answer: 'No matching records were found. Try different words, or check that the project, document or note you mean has been recorded.', sources: [], provider: 'none', model: 'none' };
  }
  try {
    const out = await generate({ task: 'knowledge', system: KNOWLEDGE_SYSTEM, prompt: buildRagPrompt(q, turns, hits), promptVersion: KNOWLEDGE_PROMPT_VERSION, maxTokens: 900, actorId: user.id });
    const seen = new Set<string>();
    return { answer: out.text, sources: hits.filter((c) => !seen.has(c.url) && seen.add(c.url)).map((c) => ({ title: c.title, url: c.url })), provider: out.provider, model: out.model };
  } catch (e) {
    return { error: e instanceof AiError ? e.message : 'The Knowledge Engine failed. Try again.' };
  }
}
