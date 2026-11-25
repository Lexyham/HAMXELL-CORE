import 'server-only';
import { generate } from '../ai/client';
import { AiError } from '../ai/types';
import type { ImportResult } from './analyze';
import { DESCRIBE_PROMPT_VERSION, DESCRIBE_SYSTEM, describePrompt, parseDescription, templateDescription, type SiteDescription } from './describe';

/**
 * Writes the site description. Never throws: if AI is off, rate-limited, unreachable or returns something unusable,
 * the deterministic writer produces a cautious description instead and records why.
 */
export async function describeSite(r: ImportResult, o: { ai: boolean; actorId?: string; reason?: string }): Promise<SiteDescription> {
  const at = new Date().toISOString();
  let note = o.reason ?? 'AI features are switched off.';
  if (o.ai) {
    try {
      const out = await generate({ task: 'import_summary', system: DESCRIBE_SYSTEM, prompt: describePrompt(r), promptVersion: DESCRIBE_PROMPT_VERSION, maxTokens: 1400, actorId: o.actorId });
      const d = parseDescription(out.text);
      if (d) return { ...d, source: 'ai', provider: out.provider, model: out.model, at };
      note = 'The AI model returned an unusable answer.';
    } catch (e) {
      note = e instanceof AiError ? e.message : 'The AI step failed unexpectedly.';
    }
  }
  return { ...templateDescription(r), source: 'template', note, at };
}
