import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export class VaultConfigError extends Error {}
export interface Sealed { ct: string; iv: string; tag: string }

/** Loads a 32-byte base64 key from the environment. Generate one with `npm run keygen`. */
export function loadKey(name: 'VAULT_MASTER_KEY' | 'BACKUP_ENCRYPTION_KEY'): Buffer {
  const raw = process.env[name];
  if (!raw) throw new VaultConfigError(`${name} is not set. Generate one with "npm run keygen" and add it to .env.local.`);
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new VaultConfigError(`${name} must decode to exactly 32 bytes (base64).`);
  return key;
}

/** AES-256-GCM with a fresh random 96-bit IV per call. `aad` binds the ciphertext to its owner (for example the entry id). */
export function seal(key: Buffer, plaintext: string, aad: string): Sealed {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  c.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([c.update(plaintext, 'utf8'), c.final()]);
  return { ct: ct.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') };
}

/** Throws if the key, IV, tag, ciphertext or AAD is wrong or has been altered. */
export function unseal(key: Buffer, s: Sealed, aad: string): string {
  const iv = Buffer.from(s.iv, 'base64');
  const tag = Buffer.from(s.tag, 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Malformed ciphertext.');
  const d = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  d.setAAD(Buffer.from(aad, 'utf8'));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(Buffer.from(s.ct, 'base64')), d.final()]).toString('utf8');
}
