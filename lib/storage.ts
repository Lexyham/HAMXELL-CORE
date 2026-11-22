import 'server-only';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { serviceClient } from './supabase/admin';
import { supabaseConfigured } from './supabase/config';

export type StorageProvider = 's3' | 'supabase';

const s3Configured = () =>
  Boolean(process.env.ZEVCLOUD_S3_ENDPOINT && process.env.ZEVCLOUD_S3_BUCKET && process.env.ZEVCLOUD_S3_ACCESS_KEY && process.env.ZEVCLOUD_S3_SECRET_KEY);
export const storageConfigured = () => s3Configured() || supabaseConfigured();

let client: S3Client | null = null;
const s3 = () =>
  (client ??= new S3Client({
    endpoint: process.env.ZEVCLOUD_S3_ENDPOINT,
    region: process.env.ZEVCLOUD_S3_REGION || 'auto',
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.ZEVCLOUD_S3_ACCESS_KEY!, secretAccessKey: process.env.ZEVCLOUD_S3_SECRET_KEY! },
  }));
const bucket = () => process.env.ZEVCLOUD_S3_BUCKET!;
const fallbackBucket = () => process.env.SUPABASE_STORAGE_BUCKET || 'hamxell-assets';

/** ZevCloud S3 first; Supabase Storage as the fallback bucket (spec section 9.4). Returns the backend that accepted the object. */
export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<StorageProvider> {
  if (s3Configured()) {
    try {
      await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
      return 's3';
    } catch (e) {
      console.error('S3 upload failed, trying fallback:', (e as Error).message);
    }
  }
  if (supabaseConfigured()) {
    const { error } = await serviceClient().storage.from(fallbackBucket()).upload(key, body, { contentType, upsert: false });
    if (!error) return 'supabase';
    console.error('Supabase Storage upload failed:', error.message);
  }
  throw new Error('No storage backend accepted the file. Check the ZevCloud S3 settings or the Supabase storage bucket.');
}

/** Short-lived (60 s) download link, always served as an attachment so uploaded content is never rendered by the browser. */
export async function downloadUrl(provider: StorageProvider, key: string, filename: string): Promise<string> {
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  if (provider === 's3') {
    return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentDisposition: `attachment; filename="${safe}"` }), { expiresIn: 60 });
  }
  const { data, error } = await serviceClient().storage.from(fallbackBucket()).createSignedUrl(key, 60, { download: safe });
  if (error || !data) throw new Error('Could not create a download link.');
  return data.signedUrl;
}

export async function removeObject(provider: StorageProvider, key: string): Promise<void> {
  if (provider === 's3') await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  else await serviceClient().storage.from(fallbackBucket()).remove([key]);
}
