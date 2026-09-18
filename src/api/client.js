// Wrapper API dashboard — Bearer token dari localStorage.
const BASE = '/api';

function authHeaders() {
  const t = localStorage.getItem('dm_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(opts.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || 'Terjadi kesalahan');
    e.status = res.status;
    throw e;
  }
  return data;
}

export async function verifyToken(token) {
  const res = await fetch(`${BASE}/auth/verify?token=${encodeURIComponent(token)}`);
  const data = await res.json();
  if (!res.ok || !data.valid) throw new Error(data.error || 'Token tidak valid');
  return data;
}

export const getSummary = (view, params = {}) =>
  req(`/summary?view=${view}&${new URLSearchParams(params)}`);

export const getTransactions = (params = {}) =>
  req(`/transactions?${new URLSearchParams(params)}`);

export const saveTransaction = (body, id = null) =>
  req(id ? `/transactions/${id}` : '/transactions', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(body)
  });

export const deleteTransaction = (id) =>
  req(`/transactions/${id}`, { method: 'DELETE' });
