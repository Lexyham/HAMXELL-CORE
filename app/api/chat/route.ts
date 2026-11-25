import { generate } from '@/lib/ai/client';
import { flag } from '@/lib/flags';
import { getDb, mongoConfigured } from '@/lib/db/mongo';
import { answerPublic, CHAT_UNAVAILABLE, type ChatLog } from '@/lib/rag/chat';
import { retrievePublic } from '@/lib/rag/corpus';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Anonymised conversation log in the hot store (archived to TiDB cluster B after 30 days). No IP, no identifiers. */
async function logChat(e: ChatLog) {
  if (!mongoConfigured()) return;
  await (await getDb()).collection('chatbot_logs').insertOne({ ...e, createdAt: new Date() });
}

export async function POST(req: Request) {
  if (!flag('FEATURE_CHATBOT')) return json({ error: 'Not available.' }, 404);
  const caller = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'; // transient rate-limit key only
  const max = Number(process.env.RATE_LIMIT_CHATBOT_PER_HOUR ?? 60);
  if (!(await rateLimit(`chat:${caller}`, max, 60 * 60 * 1000))) return json({ error: 'Too many questions from this connection. Please try again later.' }, 429);

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > 16_384) return json({ error: 'Request too large.' }, 413);
  const text = await req.text();
  if (text.length > 16_384) return json({ error: 'Request too large.' }, 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return json({ error: 'Invalid request.' }, 400); }

  try {
    const r = await answerPublic(body, {
      retrieve: (q) => retrievePublic(q, 5),
      generate: async (a) => { const o = await generate({ task: 'chatbot', ...a }); return { text: o.text, provider: o.provider, model: o.model }; },
      log: logChat,
    });
    return json(r.body, r.status);
  } catch (e) {
    console.error('chat failed', (e as Error).message);
    return json({ error: CHAT_UNAVAILABLE }, 503);
  }
}
