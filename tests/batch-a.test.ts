import assert from 'node:assert/strict';
import { deliverEnquiryEmails, EMAIL_DELIVERY_PENDING, type EmailDeliveryPatch, type EmailAttempt } from '../lib/enquiry-delivery';
import { resolveProviderTimeout, runProviderFallback } from '../lib/ai/timeouts';
import { AiError, type Provider } from '../lib/ai/types';

async function testTimeoutValidation() {
  assert.equal(resolveProviderTimeout('chatbot', '1000'), 1000);
  assert.equal(resolveProviderTimeout('docs', '120000'), 120000);
  for (const invalid of ['0', '999', '120001', '-1', '1.5', 'abc', '', ' 1000']) {
    assert.throws(() => resolveProviderTimeout('chatbot', invalid), AiError, `rejects override ${JSON.stringify(invalid)}`);
  }
}

async function testProviderFallbackAndDeadline() {
  const providers: Provider[] = ['gemini', 'openrouter'];
  const fallback = await runProviderFallback({
    providers,
    configured: providers,
    providerTimeoutMs: 100,
    totalTimeoutMs: 500,
    call: async (provider) => {
      if (provider === 'gemini') throw new Error('temporary provider error');
      return 'usable answer';
    },
    isUsable: (value) => value.length > 0,
  });
  assert.equal(fallback.provider, 'openrouter');
  assert.equal(fallback.value, 'usable answer');
  assert.deepEqual(fallback.attempts, [{ provider: 'gemini', error: 'temporary provider error' }]);

  let aborted = false;
  await assert.rejects(
    runProviderFallback({
      providers: ['gemini', 'openrouter'],
      configured: ['gemini', 'openrouter'],
      providerTimeoutMs: 1000,
      totalTimeoutMs: 30,
      call: (_provider, signal) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true;
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }),
      isUsable: Boolean,
    }),
    (error: unknown) => error instanceof AiError && error.message === 'AI request deadline exceeded. Try again shortly.',
  );
  assert.equal(aborted, true, 'deadline aborts the active provider');
}

async function testEmailFailureAndRecovery() {
  const patches: EmailDeliveryPatch[] = [];
  const persist = async (patch: EmailDeliveryPatch) => {
    patches.push(patch);
    return null;
  };
  let acknowledgementCalls = 0;
  const first = await deliverEnquiryEmails({
    ackSentAt: null,
    notifiedAt: null,
    sendAcknowledgement: async () => {
      acknowledgementCalls++;
      return { ok: true };
    },
    sendNotification: async () => ({ ok: false, error: 'temporary delivery failure' }),
    persist,
    now: () => '2025-01-01T00:00:00.000Z',
    wait: async () => {},
  });
  assert.deepEqual(patches[0], { email_error: EMAIL_DELIVERY_PENDING }, 'persists pending before network requests');
  assert.equal(first.ackSentAt, '2025-01-01T00:00:00.000Z');
  assert.equal(first.notifiedAt, null);
  assert.match(first.errors[0], /notification: temporary delivery failure/);
  assert.equal(patches[1].ack_sent_at, first.ackSentAt);
  assert.match(patches[1].email_error ?? '', /temporary delivery failure/);

  let retryAcknowledgementCalls = 0;
  const recovered = await deliverEnquiryEmails({
    ackSentAt: first.ackSentAt,
    notifiedAt: first.notifiedAt,
    sendAcknowledgement: async () => {
      retryAcknowledgementCalls++;
      return { ok: false, error: 'must not resend' };
    },
    sendNotification: async () => ({ ok: true }),
    persist,
    now: () => '2025-01-01T00:01:00.000Z',
    wait: async () => {},
  });
  assert.equal(retryAcknowledgementCalls, 0, 'does not resend a previously accepted acknowledgement');
  assert.equal(recovered.notifiedAt, '2025-01-01T00:01:00.000Z');
  assert.deepEqual(recovered.errors, []);
  assert.equal(patches[3].email_error, null, 'clears failure state after recovery');

  let rateLimitAttempts = 0;
  const bounded = await deliverEnquiryEmails({
    ackSentAt: null,
    notifiedAt: '2025-01-01T00:00:00.000Z',
    sendAcknowledgement: async (): Promise<EmailAttempt> => {
      rateLimitAttempts++;
      return { ok: false, error: 'rate limited', retryable: true };
    },
    sendNotification: async () => ({ ok: true }),
    persist,
    wait: async () => {},
  });
  assert.equal(rateLimitAttempts, 2, 'retries a clear 429 only once');
  assert.match(bounded.errors[0], /rate limited/);
}

async function main() {
  await testTimeoutValidation();
  await testProviderFallbackAndDeadline();
  await testEmailFailureAndRecovery();
  console.log('ALL BATCH A TESTS PASSED');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
