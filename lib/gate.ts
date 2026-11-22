import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;
const N = 16384, R = 8, P = 1, KEYLEN = 32;

/** scrypt hash with a random salt, stored as "scrypt$N$r$p$salt$hash" (base64). */
export async function hashGatePassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pw, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/** Constant-time check. Any malformed stored value simply fails. */
export async function verifyGatePassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, 'base64');
    const got = await scrypt(pw, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
    return got.length === expected.length && timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

/** Rules for admin account passwords. */
export function passwordProblem(pw: string, email = ''): string | null {
  if (pw.length < 12) return 'Use at least 12 characters.';
  if (pw.length > 200) return 'That password is too long.';
  if (/^(.)\1+$/.test(pw)) return 'Do not repeat a single character.';
  const local = email.split('@')[0].toLowerCase();
  if (local.length >= 4 && pw.toLowerCase().includes(local)) return 'The password must not contain your email name.';
  if (new Set(pw).size < 6) return 'Use a wider variety of characters.';
  return null;
}
