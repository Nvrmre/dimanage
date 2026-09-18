// Handler Vercel-style (export default async (req, res)) + helper response.

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function ok(res, body) { json(res, 200, body); }
export function badRequest(res, msg) { json(res, 400, { error: msg }); }
export function unauthorized(res, msg = 'Unauthorized') { json(res, 401, { error: msg }); }
export function notFound(res, msg = 'Not found') { json(res, 404, { error: msg }); }
export function serverError(res, err) {
  const code = err && err.code === 'SUPABASE_NOT_CONFIGURED' ? 503 : 500;
  const msg = code === 503
    ? 'Database belum dikonfigurasi (set SUPABASE_URL & SERVICE_ROLE_KEY di Vercel)'
    : (err && err.message) || 'Internal error';
  if (code === 500) console.error('[api-error]', err);
  json(res, code, { error: msg });
}

/** Baca body JSON aman (works di Node http & Vercel dev) */
export function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

/** Cek Authorization: Bearer <token> → return user row atau null */
export async function authenticateUser(req, supabase) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_token', token)
    .gte('token_expires_at', now)
    .single();
  if (error) return null;
  return data;
}
