import assert from 'node:assert/strict';
import { AiError } from '../lib/ai/types';
import { buildPublicCorpus } from '../lib/rag/corpus';
import {
  answerPublic,
  CHAT_UNAVAILABLE,
  NO_GROUNDED_ANSWER,
  type ChatDeps,
  type ChatLog,
} from '../lib/rag/chat';
import { PublicDataUnavailableError } from '../lib/rag/errors';
import type { Chunk } from '../lib/rag/chunk';
import type { Product } from '../lib/products';
import type { PublicCorpusDoc } from '../lib/docs';
import { listAllPublicDocsForChat } from '../lib/docs';
import { listPublicForChat } from '../lib/projects';

const about: Chunk = {
  id: 'about',
  title: 'About HAMXELL CORE',
  url: '/about',
  kind: 'about',
  text: 'HAMXELL CORE is a technology laboratory. It builds software, AI products and experimental systems.',
};
const publicProduct: Chunk = {
  id: 'product-1',
  title: 'Example public product',
  url: '/products/example-public-product',
  kind: 'product',
  text: 'Example public product supports document management.',
};

function deps(
  chunks: Chunk[],
  respond: (prompt: string, system: string) => string = () => '{"claims":[]}',
) {
  let retrievals = 0;
  const generated: { prompt: string; system: string }[] = [];
  const logs: ChatLog[] = [];
  const value: ChatDeps = {
    retrieve: async () => { retrievals++; return chunks; },
    generate: async ({ prompt, system }) => {
      generated.push({ prompt, system });
      return { text: respond(prompt, system), provider: 'openrouter', model: 'mock-model' };
    },
    log: async (entry) => { logs.push(entry); },
  };
  return { value, generated, logs, retrievals: () => retrievals };
}

const request = (content: string) => ({ messages: [{ role: 'user', content }] });
const claim = (source: number, text: string) => JSON.stringify({ claims: [{ source, text }] });

async function main() {
  const greetingDeps = deps([]);
  const greeting = await answerPublic(request('Hi'), greetingDeps.value);
  assert.equal(greeting.status, 200);
  assert.match(greeting.body.answer, /^Hello\./);
  assert.equal(greetingDeps.retrievals(), 0);
  assert.equal(greetingDeps.generated.length, 0);
  assert.equal(greetingDeps.logs[0]?.provider, null);

  const supportedDeps = deps([about], () => claim(1, 'HAMXELL CORE is a technology laboratory.'));
  const supported = await answerPublic(request('What is HAMXELL CORE?'), supportedDeps.value);
  assert.equal(supported.status, 200);
  assert.equal(supported.body.answer, 'HAMXELL CORE is a technology laboratory.');
  assert.equal(supported.body.grounded, true);
  assert.deepEqual(supported.body.sources, [{ title: about.title, url: about.url }]);
  assert.match(supportedDeps.generated[0].system, /exact excerpt/);
  assert.match(supportedDeps.generated[0].prompt, /answerable="true"/);

  const unsupportedDeps = deps([{ ...about, contextOnly: true }], () => claim(1, about.text));
  const unsupported = await answerPublic(request('What is the unpublished launch date?'), unsupportedDeps.value);
  assert.equal(unsupported.status, 200);
  assert.equal(unsupported.body.answer, NO_GROUNDED_ANSWER);
  assert.equal(unsupported.body.grounded, false);
  assert.deepEqual(unsupported.body.sources, []);
  assert.match(unsupportedDeps.generated[0].prompt, /answerable="false"/);

  const hallucinationDeps = deps([about], () => 'HAMXELL CORE launched in 2030.');
  const hallucination = await answerPublic(request('When did HAMXELL CORE launch?'), hallucinationDeps.value);
  assert.equal(hallucination.status, 200);
  assert.equal(hallucination.body.answer, NO_GROUNDED_ANSWER);
  assert.equal(hallucination.body.grounded, false);
  assert.deepEqual(hallucination.body.sources, []);

  const paraphraseDeps = deps([about], () => claim(1, 'HAMXELL CORE is a technology lab.'));
  const paraphrase = await answerPublic(request('What is HAMXELL CORE?'), paraphraseDeps.value);
  assert.equal(paraphrase.status, 200);
  assert.equal(paraphrase.body.answer, NO_GROUNDED_ANSWER);
  assert.equal(paraphrase.body.grounded, false);
  assert.deepEqual(paraphrase.body.sources, []);

  const unrelated: Chunk = {
    id: 'unrelated',
    title: 'Unrelated information',
    url: '/docs/unrelated',
    kind: 'doc',
    text: 'This unrelated project uses a booking calendar.',
  };
  const sourceDeps = deps([publicProduct, unrelated], () => JSON.stringify({
    claims: [
      { source: 1, text: publicProduct.text },
      { source: 2, text: unrelated.text },
      { source: 99, text: 'A claim from a nonexistent source.' },
    ],
  }));
  const sourceResult = await answerPublic(request('Which product supports document management?'), sourceDeps.value);
  assert.equal(sourceResult.status, 200);
  assert.equal(sourceResult.body.answer, publicProduct.text);
  assert.equal(sourceResult.body.grounded, true);
  assert.deepEqual(sourceResult.body.sources, [{ title: publicProduct.title, url: publicProduct.url }]);

  const invalidSourceDeps = deps([publicProduct], () => claim(2, publicProduct.text));
  const invalidSource = await answerPublic(request('Which product supports document management?'), invalidSourceDeps.value);
  assert.equal(invalidSource.status, 200);
  assert.equal(invalidSource.body.answer, NO_GROUNDED_ANSWER);
  assert.equal(invalidSource.body.grounded, false);
  assert.deepEqual(invalidSource.body.sources, []);

  const duplicateDeps = deps([publicProduct], () => JSON.stringify({
    claims: [
      { source: 1, text: publicProduct.text },
      { source: 1, text: publicProduct.text },
    ],
  }));
  const duplicate = await answerPublic(request('Which product supports document management?'), duplicateDeps.value);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.answer, publicProduct.text);
  assert.equal(duplicate.body.grounded, true);
  assert.deepEqual(duplicate.body.sources, [{ title: publicProduct.title, url: publicProduct.url }]);

  const emptyClaimsDeps = deps([about], () => '{"claims":[]}');
  const emptyClaims = await answerPublic(request('What is HAMXELL CORE?'), emptyClaimsDeps.value);
  assert.equal(emptyClaims.status, 200);
  assert.equal(emptyClaims.body.answer, NO_GROUNDED_ANSWER);
  assert.equal(emptyClaims.body.grounded, false);
  assert.deepEqual(emptyClaims.body.sources, []);

  const overlapOnlyDeps = deps([about], () => claim(1, 'HAMXELL CORE builds software and experimental systems.'));
  const overlapOnly = await answerPublic(request('What is HAMXELL CORE?'), overlapOnlyDeps.value);
  assert.equal(overlapOnly.status, 200);
  assert.equal(overlapOnly.body.answer, NO_GROUNDED_ANSWER);
  assert.equal(overlapOnly.body.grounded, false);
  assert.deepEqual(overlapOnly.body.sources, []);

  const noProductsOrDocs = buildPublicCorpus([], []);
  const productDirectory = noProductsOrDocs.chunks.find((chunk) => chunk.url === '/products');
  const docsDirectory = noProductsOrDocs.chunks.find((chunk) => chunk.url === '/docs');
  assert.ok(productDirectory);
  assert.match(productDirectory.text, /No individual product listings are currently available/);
  assert.ok(docsDirectory);
  assert.match(docsDirectory.text, /No published documentation pages are currently available/);
  assert.equal(noProductsOrDocs.chunks.some((chunk) => chunk.kind === 'product'), false);
  assert.equal(noProductsOrDocs.chunks.some((chunk) => chunk.kind === 'doc'), false);
  const productDirectoryId = noProductsOrDocs.chunks.indexOf(productDirectory) + 1;
  const emptyProductsDeps = deps(noProductsOrDocs.chunks, () => claim(productDirectoryId, productDirectory.text));
  const emptyProducts = await answerPublic(request('What products are listed?'), emptyProductsDeps.value);
  assert.equal(emptyProducts.status, 200);
  assert.equal(emptyProducts.body.answer, productDirectory.text);
  assert.equal(emptyProducts.body.grounded, true);
  assert.deepEqual(emptyProducts.body.sources, [{ title: productDirectory.title, url: '/products' }]);

  const emptyProduct: Product = {
    slug: 'placeholder',
    name: 'Placeholder',
    summary: 'Not a real listing.',
    status: 'active',
    visibility: 'public',
    category: 'product',
    tags: [],
    placeholder: true,
  };
  const emptyDocCorpus = buildPublicCorpus([emptyProduct], []);
  assert.equal(emptyDocCorpus.chunks.some((chunk) => chunk.kind === 'product'), false);
  assert.match(emptyDocCorpus.chunks.find((chunk) => chunk.url === '/products')?.text ?? '', /No individual product listings/);
  assert.match(emptyDocCorpus.chunks.find((chunk) => chunk.url === '/docs')?.text ?? '', /No published documentation pages/);
  const emptyDocsDirectory = emptyDocCorpus.chunks.find((chunk) => chunk.url === '/docs');
  assert.ok(emptyDocsDirectory);
  const emptyDocsId = emptyDocCorpus.chunks.indexOf(emptyDocsDirectory) + 1;
  const emptyDocsDeps = deps(emptyDocCorpus.chunks, () => claim(emptyDocsId, emptyDocsDirectory.text));
  const emptyDocs = await answerPublic(request('What documentation pages are published?'), emptyDocsDeps.value);
  assert.equal(emptyDocs.status, 200);
  assert.equal(emptyDocs.body.answer, emptyDocsDirectory.text);
  assert.equal(emptyDocs.body.grounded, true);
  assert.deepEqual(emptyDocs.body.sources, [{ title: emptyDocsDirectory.title, url: '/docs' }]);

  const publishedDoc: PublicCorpusDoc = {
    slug: 'example',
    projectName: 'Example',
    kind: 'overview',
    title: 'Overview',
    md: 'The Example product supports document management.',
  };
  const docsCorpus = buildPublicCorpus([], [publishedDoc]);
  assert.match(docsCorpus.chunks.find((chunk) => chunk.url === '/docs')?.text ?? '', /Example: Overview/);
  assert.ok(docsCorpus.chunks.some((chunk) => chunk.url === '/docs/example#overview'));

  for (const source of ['products', 'documentation'] as const) {
    const failedDeps: ChatDeps = {
      retrieve: async () => { throw new PublicDataUnavailableError(source); },
      generate: async () => { throw new Error('Provider must not run when public data is unavailable.'); },
      log: async (entry) => { assert.equal(entry.provider, null); },
    };
    const failed = await answerPublic(request('What public information is available?'), failedDeps);
    assert.equal(failed.status, 503, `${source} retrieval failure should return 503`);
    assert.deepEqual(failed.body, { error: CHAT_UNAVAILABLE });
  }

  const originalFetch = globalThis.fetch;
  const originalSupabaseEnv = {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  globalThis.fetch = async () => new Response('null', { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    await assert.rejects(listPublicForChat(), (error: unknown) =>
      error instanceof PublicDataUnavailableError && error.source === 'products');
    await assert.rejects(listAllPublicDocsForChat(), (error: unknown) =>
      error instanceof PublicDataUnavailableError && error.source === 'documentation');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSupabaseEnv.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalSupabaseEnv.url;
    if (originalSupabaseEnv.anonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalSupabaseEnv.anonKey;
    if (originalSupabaseEnv.serviceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSupabaseEnv.serviceRoleKey;
  }

  const tooLongDeps = deps([about]);
  const tooLongResult = await answerPublic(request('x'.repeat(1001)), tooLongDeps.value);
  assert.equal(tooLongResult.status, 400);
  assert.equal(tooLongDeps.generated.length, 0);

  const unavailableDeps: ChatDeps = {
    retrieve: async () => [about],
    generate: async () => { throw new AiError('All providers unavailable.'); },
    log: async (entry) => { assert.equal(entry.provider, null); },
  };
  const unavailable = await answerPublic(request('What is HAMXELL CORE?'), unavailableDeps);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.error, CHAT_UNAVAILABLE);

  console.log('Chat behavior tests passed with mocked providers; no real-provider verification was performed.');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
