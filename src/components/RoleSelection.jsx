// src/components/RoleSelection.jsx
import React, { useState } from 'react';

export default function RoleSelection({ onSelectCashier, onSelectAdmin }) {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [password, setPassword] = useState('');

  return (
    <div className="login-container d-flex align-items-center justify-content-center" style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
      <div className="card p-4 shadow-sm" style={{ maxWidth: '400px', width: '100%', background: 'var(--surface-color)' }}>
        <h3 className="text-center mb-4">EVREN HOUSE</h3>
        
        {!showAdminLogin ? (
          <div className="d-flex flex-column gap-3">
            <button className="btn btn-primary btn-lg w-100" onClick={onSelectCashier}>
              🛍️ Portal Kasir
            </button>
            <button className="btn btn-outline-secondary btn-lg w-100" onClick={() => setShowAdminLogin(true)}>
              🛡️ Portal Admin
            </button>
          </div>
        ) : (
          <div>
            <h5 className="mb-3">Login Admin</h5>
            <input 
              type="password" 
              className="form-control mb-3" 
              placeholder="Masukkan Password Admin"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSelectAdmin(password)}
              autoFocus
            />
            <div className="d-flex gap-2">
              <button className="btn btn-secondary w-50" onClick={() => setShowAdminLogin(false)}>Kembali</button>
              <button className="btn btn-primary w-50" onClick={() => onSelectAdmin(password)}>Masuk</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
