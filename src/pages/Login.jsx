import React, { useState } from 'react';
import { verifyToken } from '../api/client.js';

export default function Login({ onLogin }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const token = input.trim();
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await verifyToken(token);
      onLogin(token, res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo" aria-hidden="true">D</div>
        <h1>Dimanage</h1>
        <p className="login-sub">Finance Tracker — catat jualan, lihat laba bersih.</p>

        <ol className="login-steps">
          <li>Buka bot Telegram <b>Dimanage</b></li>
          <li>Ketik <code>/token</code></li>
          <li>Klik link yang dikirim bot</li>
        </ol>

        <form onSubmit={submit}>
          <label className="field-label" htmlFor="token">Punya token? Tempel di sini</label>
          <input
            id="token"
            className="field-input"
            type="text"
            placeholder="tempel token…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
          />
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || !input.trim()}>
            {busy ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
