import React, { useState, useEffect } from 'react';
import { loginCashier, loginAdmin, setAuthToken, fetchOutlets, setActiveOutletId } from '../../../api';

function LoginPage({ onLogin, onAdminLogin, activeOutletId: initialOutletId }) {
  const [mode, setMode] = useState('cashier'); // 'cashier' | 'admin'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(() => {
    return initialOutletId || localStorage.getItem('kw_activeOutletId') || 'outlet-pusat';
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadOutlets = async () => {
      try {
        if (typeof fetchOutlets === 'function') {
          const res = await fetchOutlets();
          if (isMounted) {
            const list = Array.isArray(res) ? res : Array.isArray(res?.outlets) ? res.outlets : [];
            if (list.length > 0) {
              setOutlets(list);
              if (!selectedOutlet || !list.some(o => o.id === selectedOutlet)) {
                setSelectedOutlet(list[0].id);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load outlets list:', err);
      }
    };
    loadOutlets();
    return () => { isMounted = false; };
  }, []);

  const handleCashierLogin = async (e) => {
    if (e) e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Ketik nama kasir terlebih dahulu!');
      return;
    }
    if (!password) {
      setError('Password shift harus diisi!');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const res = await loginCashier(trimmed, password, selectedOutlet);
      if (res && res.success) {
        if (res.token) setAuthToken(res.token);
        if (selectedOutlet) {
          setActiveOutletId(selectedOutlet);
        }
        if (typeof onLogin === 'function') {
          onLogin(res.user?.username || trimmed);
        }
      } else {
        setError(res?.error || 'Nama kasir atau password salah.');
      }
    } catch (e) {
      setError('Tidak dapat terhubung ke server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!adminPassword) {
      setError('Masukkan password admin!');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      if (typeof onAdminLogin === 'function') {
        const res = await onAdminLogin(adminPassword);
        if (res && !res.success) {
          setError(res?.error || 'Password admin tidak sesuai.');
        }
      } else {
        const res = await loginAdmin(adminPassword);
        if (res && res.success) {
          if (res.token) setAuthToken(res.token);
        } else {
          setError(res?.error || 'Password admin tidak sesuai.');
        }
      }
    } catch (e) {
      setError('Tidak dapat terhubung ke server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
  };

  return (
    <div id="loginPage">
      <div className="login-card">
        <div style={{ marginBottom: '20px' }}>
          <div className="login-brand">EVREN HOUSE</div>
          <div className="login-sub">Rental Management POS</div>
        </div>

        <div className="login-tabs" role="tablist" aria-label="Tipe Login">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'cashier'}
            className={`login-tab ${mode === 'cashier' ? 'active' : ''}`}
            onClick={() => switchMode('cashier')}
          >
            <i className="bi bi-person-badge"></i>
            <span>Portal Kasir</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'admin'}
            className={`login-tab ${mode === 'admin' ? 'active' : ''}`}
            onClick={() => switchMode('admin')}
          >
            <i className="bi bi-shield-lock"></i>
            <span>Portal Admin</span>
          </button>
        </div>

        {mode === 'cashier' ? (
          <form onSubmit={handleCashierLogin} noValidate>
            {outlets.length > 0 && (
              <div className="mb-2 text-start">
                <select
                  className="login-field login-select"
                  style={{ minHeight: '44px' }}
                  value={selectedOutlet}
                  onChange={(e) => setSelectedOutlet(e.target.value)}
                  aria-label="Pilih Outlet"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nama || o.name || o.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-2">
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                className="login-field"
                style={{ minHeight: '44px' }}
                placeholder="Ketik nama kasir..."
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </div>

            <div className="mb-2">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                className="login-field"
                style={{ minHeight: '44px' }}
                placeholder="Password shift..."
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <button
              type="submit"
              className="btn-login"
              style={{ minHeight: '44px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right"></i>
                  <span>Mulai Shift</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminSubmit} noValidate>
            <div className="mb-2">
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => { setAdminPassword(e.target.value); setError(''); }}
                className="login-field"
                style={{ minHeight: '44px' }}
                placeholder="Masukkan Password Admin..."
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn-login"
              style={{ minHeight: '44px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <i className="bi bi-shield-lock-fill"></i>
                  <span>Masuk Portal Admin</span>
                </>
              )}
            </button>
          </form>
        )}

        <div className="login-err d-flex align-items-center justify-content-center gap-2">
          {error && (
            <>
              <i className="bi bi-exclamation-triangle-fill"></i>
              <span>{error}</span>
            </>
          )}
        </div>

        <div style={{ marginTop: '14px', fontSize: '.72rem', color: 'var(--text2)', textAlign: 'center' }}>
          <i className="bi bi-shield-check me-1"></i>
          {mode === 'cashier' ? 'Akses shift kasir Evren House' : 'Akses penuh kontrol & manajemen sistem'}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
