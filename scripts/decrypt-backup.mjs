// Restore path for vault backups: decrypts a *.json.enc file with BACKUP_ENCRYPTION_KEY and prints the JSON.
// Usage: npm run decrypt-backup -- path/to/vault-backup.json.enc > backup.json
import { createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const raw = process.env.BACKUP_ENCRYPTION_KEY;
if (!file || !raw) {
  console.error('Usage: npm run decrypt-backup -- <file.json.enc>   (BACKUP_ENCRYPTION_KEY must be set in .env.local)');
  process.exit(1);
}
const key = Buffer.from(raw, 'base64');
if (key.length !== 32) { console.error('BACKUP_ENCRYPTION_KEY must be 32 bytes, base64.'); process.exit(1); }
const env = JSON.parse(readFileSync(file, 'utf8'));
const d = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'), { authTagLength: 16 });
d.setAAD(Buffer.from(env.aad, 'utf8'));
d.setAuthTag(Buffer.from(env.tag, 'base64'));
process.stdout.write(Buffer.concat([d.update(Buffer.from(env.ct, 'base64')), d.final()]).toString('utf8'));
