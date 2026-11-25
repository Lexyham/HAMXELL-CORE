import KnowledgeChat from '@/components/admin/KnowledgeChat';
import { configuredProviders, ROUTES } from '@/lib/ai/client';
import { requireAdmin } from '@/lib/auth';
import { flag } from '@/lib/flags';

export default async function KnowledgePage() {
  await requireAdmin();
  if (!flag('FEATURE_KNOWLEDGE_ENGINE')) {
    return <div><h1 className="text-h1 font-semibold">Knowledge Engine</h1><p className="mt-4 border border-line p-5 text-small text-ink-muted">Coming soon. Set FEATURE_KNOWLEDGE_ENGINE=true to enable.</p></div>;
  }
  const ok = ROUTES.knowledge.some((p) => configuredProviders().includes(p));
  return (
    <div className="max-w-[48rem]">
      <h1 className="text-h1 font-semibold">Knowledge Engine</h1>
      <p className="mt-3 max-w-[62ch] text-small text-ink-muted">Ask questions across all project records. Retrieval is keyword-based over projects, documentation (drafts included), infrastructure notes, deployments and domains, then summarised by Gemini with OpenRouter as fallback. The credentials vault is never read.</p>
      {!ok && <p className="mt-4 border border-warning p-4 text-small text-warning">No AI provider is configured for this. Set GEMINI_API_KEY or OPENROUTER_API_KEY in .env.local.</p>}
      <div className="mt-6"><KnowledgeChat /></div>
    </div>
  );
}
