import React from 'react';

function FooterNav({ activeTab, onTabChange, activeCount, currentUserRole }) {
  return (
    <nav className="footer-nav">
      <button 
        className={`fnav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} 
        onClick={() => onTabChange('dashboard')}
      >
        <div className="fnav-ico-wrap">
          <i className="bi bi-grid-1x2-fill"></i>
          <span className={`fnav-badge ${activeCount === 0 ? 'd-none' : ''}`}>{activeCount}</span>
        </div>
        <span className="fnav-label">Sewa &amp; Aktif</span>
      </button>
      
      <button 
        className={`fnav-btn ${activeTab === 'riwayat' ? 'active' : ''}`} 
        onClick={() => onTabChange('riwayat')}
      >
        <div className="fnav-ico-wrap">
          <i className="bi bi-clock-history"></i>
        </div>
        <span className="fnav-label">Riwayat</span>
      </button>

      {currentUserRole !== 'cashier' && (
        <button
          className={`fnav-btn ${activeTab === 'log-hapus' ? 'active' : ''}`}
          onClick={() => onTabChange('log-hapus')}
        >
          <div className="fnav-ico-wrap">
            <i className="bi bi-shield-exclamation" style={{ color: activeTab === 'log-hapus' ? 'var(--red)' : undefined }}></i>
          </div>
          <span className="fnav-label">Log Hapus</span>
        </button>
      )}

      {currentUserRole !== 'cashier' && (
        <button 
          className={`fnav-btn ${activeTab === 'pengaturan' ? 'active' : ''}`} 
          onClick={() => onTabChange('pengaturan')}
        >
          <div className="fnav-ico-wrap">
            <i className="bi bi-speedometer2"></i>
          </div>
          <span className="fnav-label">Dashboard Admin</span>
        </button>
      )}
    </nav>
  );
}

export default FooterNav;
