import React, { useState } from 'react';

const SHIFT_USERS = ['akbar','rani','monica','aldy','wahyu','donny','zumi','awang'];
const SHIFT_PASS = 'jayalahevren';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (!username) { setError('Pilih nama kasir!'); return; }
    if (!SHIFT_USERS.includes(username.toLowerCase())) { setError('Kasir tidak ditemukan!'); return; }
    if (password !== SHIFT_PASS) { setError('Password shift tidak sesuai!'); return; }
    setError('');
    onLogin(username);
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
        <select 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          className="login-select"
        >
          <option value="">— Pilih Nama Kasir —</option>
          <option value="akbar">Akbar</option>
          <option value="rani">Rani</option>
          <option value="monica">Monica</option>
          <option value="aldy">Aldy</option>
          <option value="wahyu">Wahyu</option>
          <option value="donny">Donny</option>
          <option value="zumi">Zumi</option>
          <option value="awang">Awang</option>
        </select>
        <input 
          type="password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="login-field" 
          placeholder="Password shift..." 
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
        <button className="btn-login" onClick={handleLogin}>
          <i className="bi bi-box-arrow-in-right"></i>Mulai Shift
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
