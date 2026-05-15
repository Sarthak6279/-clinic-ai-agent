import React, { useState } from 'react';
import { ADMIN_CREDENTIALS } from './store';

export default function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTimeout(() => {
      if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        sessionStorage.setItem('admin_auth', 'true');
        onLogin();
      } else {
        setError('Invalid username or password. Please try again.');
      }
      setLoading(false);
    }, 800);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f7f9, #e4f4f8)', fontFamily: 'Outfit, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Card */}
        <div style={{ background: 'white', borderRadius: 24, padding: '2.5rem', boxShadow: '0 20px 60px rgba(10,77,104,0.15)', border: '1px solid rgba(5,191,219,0.15)' }}>
          {/* Icon */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#0a4d68,#05bfdb)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '2rem', boxShadow: '0 8px 24px rgba(5,191,219,0.35)' }}>🩺</div>
            <div style={{ fontWeight: 800, fontSize: '1.4rem', color: '#0a4d68' }}>Doctor Admin Portal</div>
            <div style={{ color: '#6b7f8e', fontSize: '0.88rem', marginTop: '0.3rem' }}>Dr. Romesh Chawalani Clinic</div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#0a4d68', marginBottom: '0.4rem' }}>Username</label>
              <input
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="dr.romesh"
                style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid rgba(5,191,219,0.3)', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none', color: '#1a2332', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#0a4d68', marginBottom: '0.4rem' }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1.5px solid rgba(5,191,219,0.3)', fontFamily: 'inherit', fontSize: '0.95rem', outline: 'none', color: '#1a2332', boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', padding: '0.75rem 1rem', borderRadius: 10, fontSize: '0.87rem', fontWeight: 500 }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading || !username || !password}
              style={{ background: loading ? 'rgba(10,77,104,0.6)' : 'linear-gradient(135deg,#0a4d68,#0e6d8c)', color: 'white', padding: '0.95rem', borderRadius: 12, border: 'none', fontFamily: 'inherit', fontWeight: 700, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem', transition: 'all 0.2s' }}>
              {loading ? '⏳ Signing in...' : '🔐 Sign In to Dashboard'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '1.5rem', padding: '1rem', background: '#f8fbfc', borderRadius: 12, fontSize: '0.8rem', color: '#6b7f8e' }}>
            🔒 Restricted access — Authorized personnel only.<br />
            <span style={{ color: '#05bfdb', fontWeight: 600 }}>Demo: dr.romesh / clinic2025</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: '#6b7f8e', fontSize: '0.82rem' }}>
          <a href="/" style={{ color: '#05bfdb', textDecoration: 'none', fontWeight: 600 }}>← Back to Website</a>
        </div>
      </div>
    </div>
  );
}
