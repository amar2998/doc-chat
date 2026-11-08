'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || 'Something went wrong');
      else router.replace('/');
    } catch { setError('Network error'); }
    setBusy(false);
  }

  return (
    <div className="auth">
      <form onSubmit={submit} className="card">
        <h1>Dockside</h1>
        <p className="mute">{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</p>
        <input placeholder="username" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        <input type="password" placeholder="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <div className="error">{error}</div>}
        <button disabled={busy}>{busy ? '…' : mode === 'login' ? 'Sign in' : 'Sign up'}</button>
        <button type="button" className="ghost" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
