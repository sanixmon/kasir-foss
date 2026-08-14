import React, { useState } from 'react';
import { loginCashier, setAuthToken } from '../api';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (isSubmitting) return;
    const trimmed = username.trim();
    if (!trimmed) { setError('Ketik nama kasir terlebih dahulu!'); return; }
    if (!password) { setError('Password shift harus diisi!'); return; }

    setError('');
    setIsSubmitting(true);
    try {
      const res = await loginCashier(trimmed, password);
      if (res && res.success) {
        setAuthToken(res.token);
        onLogin(res.user.username);
      } else {
        setError(res?.error || 'Login gagal');
      }
    } catch (e) {
      setError('Tidak dapat terhubung ke server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div id="loginPage">
      <div className="login-card">
        <div style={{ marginBottom: '24px' }}>
          <div className="login-brand">EVREN HOUSE</div>
          <div className="login-sub">Scooter &amp; Stroller</div>
        </div>
        <hr className="login-divider" style={{ marginTop: 0, marginBottom: '20px' }} />
        <div className="login-shift-title"><i className="bi bi-person-badge-fill me-1"></i>Login Shift Kasir</div>
        <input
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setError(''); }}
          className="login-field"
          placeholder="Ketik nama kasir..."
          autoComplete="off"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="login-field"
          placeholder="Password shift..."
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        <button className="btn-login" onClick={handleLogin} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Memproses...
            </>
          ) : (
            <>
              <i className="bi bi-box-arrow-in-right"></i>Mulai Shift
            </>
          )}
        </button>
        <div className="login-err d-flex align-items-center justify-content-center gap-2">
          {error && (
            <>
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{error}</span>
            </>
          )}
        </div>
        <div style={{ marginTop: '18px', fontSize: '.72rem', color: 'var(--text2)', textAlign: 'center' }}>
          <i className="bi bi-shield-lock me-1"></i>Akses terbatas untuk kasir Evren House
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
