// Org-branding logo uploads, stored in a public Supabase Storage bucket. Public
// (not signed URLs) because the nav bar renders the logo unauthenticated on the
// client — logos aren't sensitive, so this trades zero-auth simplicity for that.
import { randomUUID } from 'node:crypto';
import { getSupabaseClient } from './supabaseClient';

const BUCKET = 'branding-logos';
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

let bucketReadyPromise = null;

// Idempotent, cached per warm serverless instance — safe because it's just a
// readiness check, not state that can go stale mid-request the way a cached
// GoogleSpreadsheet doc instance would.
function ensureBucket() {
  if (!bucketReadyPromise) {
    bucketReadyPromise = (async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.storage.getBucket(BUCKET);
      if (data) return;

      const { error } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: '2MB',
        allowedMimeTypes: ALLOWED_MIME_TYPES,
      });
      // A concurrent request may have created it first — that's fine, not a
      // real failure.
      if (error && !/already exists/i.test(error.message)) {
        throw new Error(error.message);
      }
    })();
  }
  return bucketReadyPromise;
}

const EXTENSION_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

export async function uploadLogo(buffer, { contentType }) {
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error('Logo must be a PNG, JPEG, WebP, or SVG image.');
  }

  await ensureBucket();

  const supabase = getSupabaseClient();
  const path = `${randomUUID()}.${EXTENSION_BY_MIME[contentType]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
