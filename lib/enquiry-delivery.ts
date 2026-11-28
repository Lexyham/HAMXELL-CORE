export const EMAIL_DELIVERY_PENDING = 'Email delivery pending.';

export type EmailAttempt =
  | { ok: true }
  | { ok: false; error: string; retryable?: boolean };

export interface EmailDeliveryPatch {
  ack_sent_at?: string;
  notified_at?: string;
  email_error: string | null;
}

export interface EmailDeliveryResult {
  ackSentAt: string | null;
  notifiedAt: string | null;
  errors: string[];
}

type Persist = (patch: EmailDeliveryPatch) => Promise<string | null>;

async function sendBounded(send: () => Promise<EmailAttempt>, wait: (ms: number) => Promise<void>): Promise<EmailAttempt> {
  let result = await send();
  if (!result.ok && result.retryable) {
    await wait(250);
    result = await send();
  }
  return result;
}

export async function deliverEnquiryEmails(options: {
  ackSentAt: string | null;
  notifiedAt: string | null;
  sendAcknowledgement: () => Promise<EmailAttempt>;
  sendNotification: () => Promise<EmailAttempt>;
  persist: Persist;
  now?: () => string;
  wait?: (ms: number) => Promise<void>;
}): Promise<EmailDeliveryResult> {
  const { ackSentAt, notifiedAt, sendAcknowledgement, sendNotification, persist } = options;
  const now = options.now ?? (() => new Date().toISOString());
  const wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  const pendingError = await persist({ email_error: EMAIL_DELIVERY_PENDING });
  if (pendingError) {
    return {
      ackSentAt,
      notifiedAt,
      errors: ['Could not record pending email delivery; no email was attempted.'],
    };
  }

  const outcomes = await Promise.all([
    ackSentAt ? Promise.resolve({ kind: 'ack' as const, result: { ok: true as const } }) :
      sendBounded(sendAcknowledgement, wait).then((result) => ({ kind: 'ack' as const, result })),
    notifiedAt ? Promise.resolve({ kind: 'notification' as const, result: { ok: true as const } }) :
      sendBounded(sendNotification, wait).then((result) => ({ kind: 'notification' as const, result })),
  ]);

  let nextAckSentAt = ackSentAt;
  let nextNotifiedAt = notifiedAt;
  const errors: string[] = [];
  const patch: EmailDeliveryPatch = { email_error: null };
  for (const outcome of outcomes) {
    if (outcome.kind === 'ack') {
      if (!ackSentAt && outcome.result.ok) nextAckSentAt = now();
      else if (!outcome.result.ok) errors.push(`acknowledgement: ${outcome.result.error}`);
    } else {
      if (!notifiedAt && outcome.result.ok) nextNotifiedAt = now();
      else if (!outcome.result.ok) errors.push(`notification: ${outcome.result.error}`);
    }
  }

  if (!ackSentAt && nextAckSentAt) patch.ack_sent_at = nextAckSentAt;
  if (!notifiedAt && nextNotifiedAt) patch.notified_at = nextNotifiedAt;
  patch.email_error = errors.join(' | ') || null;
  const persistError = await persist(patch);
  if (persistError) errors.push('Could not save final email delivery status. Review delivery carefully before retrying.');
  return { ackSentAt: nextAckSentAt, notifiedAt: nextNotifiedAt, errors };
}
