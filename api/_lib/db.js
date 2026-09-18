import { createClient } from '@supabase/supabase-js';

let cached = null;

/**
 * Supabase client dengan service role (server-side only).
 * Fallback ke REST-mock untuk test (SUPABASE_URL belum diset).
 */
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes('YOUR-PROJECT')) {
    const err = new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi');
    err.code = 'SUPABASE_NOT_CONFIGURED';
    throw err;
  }
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}
