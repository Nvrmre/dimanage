import React, { useEffect, useState } from 'react';
import { verifyToken } from './api/client.js';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('dm_token'));
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const urlToken = url.searchParams.get('token');
      if (urlToken) {
        localStorage.setItem('dm_token', urlToken);
        setToken(urlToken);
        url.searchParams.delete('token');
        const qs = url.searchParams.toString();
        window.history.replaceState({}, '', url.pathname + (qs ? '?' + qs : ''));
      }
      const t = urlToken || localStorage.getItem('dm_token');
      if (!t) { setChecking(false); return; }
      try {
        const res = await verifyToken(t);
        setUser(res.user);
        setToken(t);
      } catch {
        localStorage.removeItem('dm_token');
        setToken(null);
        setUser(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleLogin = (t, u) => {
    localStorage.setItem('dm_token', t);
    setToken(t);
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem('dm_token');
    setToken(null);
    setUser(null);
  };

  if (checking) return <div className="loading-screen">Memuat…</div>;
  if (!token || !user) return <Login onLogin={handleLogin} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
}
