import React, { useState } from 'react';
import { ITEMS, fmtRp } from '../App';
import { getShiftDate } from '../lib/shift';
import { saveUser, deleteUser, changeAdminPassword, backupDatabase } from '../api';

const APP_VERSION = '1.4.0';
const DEPLOY_DATE = '27 Jul 2026';

function SettingsTab({ 
  users = [],
  transactions = [],
  activeSessions = [],
  currentShiftUser,
  theme, 
  onThemeChange, 
  onUpdateAdminPassword, 
  sbConnected, 
  lastSyncTime, 
  onSyncPull, 
  onSyncPush,
  printMulai,
  onChangePrintMulai,
  printSelesai,
  onChangePrintSelesai,
  onUpdateItemImg,
  onResetItemImg,
  getImgUrl
}) {
  const [newPassInput, setNewPassInput] = useState('');
  const [oldPassInput, setOldPassInput] = useState('');

  // User management state
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('cashier');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Delete user handler
  const handleDeleteUser = async (username) => {
    if (!window.confirm(`Hapus akun "${username}"?`)) return;
    try {
      const res = await deleteUser(username);
      if (res && !res.error) {
        alert(`Akun "${username}" berhasil dihapus!`);
        if (onSyncPull) onSyncPull();
      } else {
        alert('Gagal menghapus akun: ' + (res?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Delete user failed:', err);
      alert('Gagal terhubung ke server untuk menghapus akun.');
    }
  };

  const todayShift = getShiftDate();

  // Filter today's transactions based on shift date
  const todayTxns = transactions.filter(t => {
    if (!t) return false;
    if (t.tanggal && t.tanggal.startsWith(todayShift)) return true;
    const startShift = getShiftDate(t.startTime);
    return startShift && startShift.startsWith(todayShift);
  });

  // Financial calculations
  const todayRevenue = todayTxns.reduce((s, t) => s + (t.totalAll || 0), 0);
  const todayPokok = todayTxns.reduce((s, t) => s + (t.totalBase || 0), 0);
  const todayOT = todayTxns.reduce((s, t) => s + (t.totalOT || 0), 0);
  
  const todayPokokCash = todayTxns.reduce((s, t) => s + ((t.payAwal || 'cash') === 'cash' ? (t.totalBase || 0) : 0), 0);
  const todayPokokQris = todayTxns.reduce((s, t) => s + ((t.payAwal || 'cash') === 'qris' ? (t.totalBase || 0) : 0), 0);
  const todayOTCash = todayTxns.reduce((s, t) => s + (t.cash || 0), 0);
  const todayOTQris = todayTxns.reduce((s, t) => s + (t.qris || 0), 0);

  const totalCashAll = todayPokokCash + todayOTCash;
  const totalQrisAll = todayPokokQris + todayOTQris;
  const cashPct = todayRevenue > 0 ? Math.round((totalCashAll / todayRevenue) * 100) : 50;
  const qrisPct = todayRevenue > 0 ? 100 - cashPct : 50;

  // Item Rental Analytics
  const itemStats = ITEMS.map(item => {
    let rentalCount = 0;
    let revenueSum = 0;

    todayTxns.forEach(t => {
      let itemsList = [];
      if (Array.isArray(t.items)) {
        itemsList = t.items;
      } else if (typeof t.items === 'string') {
        const parts = t.items.split(',');
        parts.forEach(p => {
          const m = p.trim().match(/^(.+?)(?:[x\xD7](\d+))?$/i);
          if (m) itemsList.push({ code: m[1].trim(), qty: Number(m[2] || 1) });
        });
      }

      itemsList.forEach(it => {
        if (it && it.code === item.code) {
          const q = Number(it.qty || 1);
          rentalCount += q;
          revenueSum += (item.priceHour * q);
        }
      });
    });

    return { ...item, rentalCount, revenueSum };
  });

  const totalUnitsRented = itemStats.reduce((s, i) => s + i.rentalCount, 0);

  const handleChangePass = async () => {
    const oldP = oldPassInput.trim();
    const newP = newPassInput.trim();
    if (!newP || !oldP) {
      alert('Masukkan password lama dan baru!');
      return;
    }
    if (!window.confirm('Ubah password admin?')) return;
    try {
      const res = await changeAdminPassword(oldP, newP);
      if (res?.success) {
        setOldPassInput('');
        setNewPassInput('');
        alert('Password Admin berhasil diperbarui!');
      } else {
        alert(res?.error || 'Gagal mengubah password admin.');
      }
    } catch (err) {
      console.error('Change password failed:', err);
      alert('Gagal terhubung ke server.');
    }
  };

  const handleBackup = async () => {
    try {
      const res = await backupDatabase();
      if (res?.success) {
        alert(`Backup berhasil!\n${res.path}`);
      } else {
        alert('Backup gagal: ' + (res?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Backup failed:', err);
      alert('Gagal terhubung ke server.');
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    const uname = newUserUsername.trim();
    const pwd = newUserPassword.trim();

    if (!uname || !pwd) {
      alert('Masukkan username dan password kasir!');
      return;
    }

    try {
      setIsSavingUser(true);
      const res = await saveUser(uname, pwd, newUserRole);
      if (res && !res.error) {
        alert(`Pengguna / Kasir "${uname}" berhasil disimpan di Cloud!`);
        setNewUserUsername('');
        setNewUserPassword('');
        if (onSyncPull) onSyncPull();
      } else {
        alert('Gagal menyimpan kasir: ' + (res?.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Save user failed:', err);
      alert('Gagal terhubung ke server untuk menyimpan pengguna.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleUploadImg = (code) => {
    const url = prompt('Masukkan URL gambar baru:');
    if (url) {
      onUpdateItemImg(code, url);
    }
  };

  const handleResetImg = (code) => {
    if (window.confirm('Reset ke gambar default?')) {
      onResetItemImg(code);
    }
  };

  return (
    <div id="tab-pengaturan" className="tab-pane active">
      <div className="row g-3">

        {/* ─── SECTION 1: EXECUTIVE DASHBOARD ANALYTICS ───────────────────── */}
        <div className="col-12">
          <div className="panel" style={{ borderLeft: '4px solid var(--yellow)' }}>
            <div className="panel-head d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-speedometer2 fs-5 clr-yellow"></i>
                <span className="fw-bold fs-5">Dashboard Analytics Admin</span>
              </div>
              <div className="badge bg-dark border border-secondary text-secondary px-3 py-1 font-monospace">
                Shift Date: <span className="text-warning fw-bold">{todayShift}</span>
              </div>
            </div>
            <div className="panel-body">
              
              {/* Financial Metric Cards */}
              <div className="row g-3 mb-3">
                <div className="col-12 col-sm-6 col-xl-3">
                  <div className="p-3 rounded-3 border" style={{ background: 'var(--bg3)' }}>
                    <div className="text-secondary small font-monospace mb-1">TOTAL OMZET SHIFT INI</div>
                    <div className="fs-3 fw-extrabold text-light mb-1">{fmtRp(todayRevenue)}</div>
                    <div className="small text-muted">{todayTxns.length} Transaksi Selesai</div>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                  <div className="p-3 rounded-3 border" style={{ background: 'var(--bg3)' }}>
                    <div className="text-secondary small font-monospace mb-1">SEWA POKOK</div>
                    <div className="fs-3 fw-bold clr-cyan mb-1">{fmtRp(todayPokok)}</div>
                    <div className="small text-secondary">C: {fmtRp(todayPokokCash)} | Q: {fmtRp(todayPokokQris)}</div>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                  <div className="p-3 rounded-3 border" style={{ background: 'var(--bg3)' }}>
                    <div className="text-secondary small font-monospace mb-1">OVERTIME (OVERSTAY)</div>
                    <div className="fs-3 fw-bold clr-yellow mb-1">{fmtRp(todayOT)}</div>
                    <div className="small text-secondary">Denda OT Terkumpul</div>
                  </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                  <div className="p-3 rounded-3 border" style={{ background: 'var(--bg3)' }}>
                    <div className="text-secondary small font-monospace mb-1">ARMADA AKTIF BEKERJA</div>
                    <div className="fs-3 fw-bold text-success mb-1">{activeSessions.length} Sesi</div>
                    <div className="small text-secondary">Petugas Shift: <b className="text-light">{currentShiftUser || '-'}</b></div>
                  </div>
                </div>
              </div>

              {/* Payment Ratio Progress Bar */}
              <div className="p-3 rounded-3 border mb-3" style={{ background: 'var(--bg3)' }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold small text-secondary">DISTRIBUSI PEMBAYARAN SHIFT</span>
                  <span className="small text-secondary">
                    Cash: <b className="clr-green">{fmtRp(totalCashAll)} ({cashPct}%)</b> | QRIS: <b className="clr-cyan">{fmtRp(totalQrisAll)} ({qrisPct}%)</b>
                  </span>
                </div>
                <div className="progress" style={{ height: '10px', backgroundColor: 'var(--bg)' }}>
                  <div className="progress-bar bg-success" role="progressbar" style={{ width: `${cashPct}%` }} title={`Cash: ${cashPct}%`}></div>
                  <div className="progress-bar bg-info" role="progressbar" style={{ width: `${qrisPct}%` }} title={`QRIS: ${qrisPct}%`}></div>
                </div>
              </div>

              {/* Vehicle Popularity & Revenue Share */}
              <div className="row g-2">
                <div className="col-12"><div className="fw-bold small text-secondary mb-2"><i className="bi bi-bar-chart-line-fill me-1 clr-cyan"></i>Performa Sewa Kendaraan Shift Ini</div></div>
                {itemStats.map(item => {
                  const sharePct = totalUnitsRented > 0 ? Math.round((item.rentalCount / totalUnitsRented) * 100) : 0;
                  return (
                    <div className="col-12 col-md-6 col-xl-4" key={item.code}>
                      <div className="p-2 border rounded-3 d-flex align-items-center justify-content-between gap-2" style={{ background: 'var(--bg)' }}>
                        <div className="d-flex align-items-center gap-2">
                          <span style={{ fontSize: '1.5rem' }}>{item.emoji}</span>
                          <div>
                            <div className="fw-bold small text-light">{item.code} - {item.name}</div>
                            <div className="small text-secondary">{item.rentalCount} Unit Disewa ({sharePct}%)</div>
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="fw-bold small clr-yellow">{fmtRp(item.revenueSum)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>

        {/* ─── SECTION 2: USER & CASHIER MANAGEMENT ─────────────────────────── */}
        <div className="col-12 col-xl-6">
          <div className="panel h-100">
            <div className="panel-head"><i className="bi bi-people-fill clr-cyan"></i><span>Manajemen Kasir &amp; Pengguna</span></div>
            <div className="panel-body">
              <form onSubmit={handleSaveUser} className="mb-4 p-3 border rounded-3" style={{ background: 'var(--bg3)' }}>
                <div className="fw-bold small mb-2 text-light"><i className="bi bi-person-plus-fill me-1 clr-green"></i>Tambah / Reset Password Kasir</div>
                <div className="row g-2">
                  <div className="col-12 col-sm-5">
                    <input 
                      type="text" 
                      className="cfield w-100" 
                      placeholder="Username kasir (cth: akbar)" 
                      value={newUserUsername}
                      onChange={(e) => setNewUserUsername(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-sm-4">
                    <input 
                      type="password" 
                      className="cfield w-100" 
                      placeholder="Password baru" 
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                    />
                  </div>
                  <div className="col-12 col-sm-3">
                    <select 
                      className="cfield w-100" 
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value)}
                    >
                      <option value="cashier">Kasir</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="col-12 mt-2">
                    <button 
                      type="submit" 
                      className="btn btn-sm btn-success w-100 font-weight-bold" 
                      disabled={isSavingUser}
                    >
                      {isSavingUser ? 'Menyimpan...' : 'Simpan User ke Cloud Backend'}
                    </button>
                  </div>
                </div>
              </form>

              <div className="fw-bold small text-secondary mb-2">Daftar Akun Kasir Terdaftar</div>
              <div className="row row-cols-2 row-cols-sm-4 g-2">
                {users.map(u => (
                  <div className="col" key={u.username}>
                    <div className="p-2 border rounded-3 text-center position-relative" style={{ background: 'var(--bg)' }}>
                      <div className="position-absolute top-0 end-0 d-flex gap-1" style={{ margin: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-sm p-0"
                          style={{ color: 'var(--yellow)', fontSize: '0.8rem', lineHeight: 1 }}
                          title="Edit / Reset Password Kasir Ini"
                          onClick={() => {
                            setNewUserUsername(u.username);
                            setNewUserRole(u.role || 'cashier');
                            setNewUserPassword(u.password || '');
                          }}
                        >
                          <i className="bi bi-pencil-square"></i>
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm p-0"
                          style={{ color: 'var(--red)', fontSize: '0.8rem', lineHeight: 1 }}
                          title="Hapus akun"
                          onClick={() => handleDeleteUser(u.username)}
                        >
                          <i className="bi bi-x-circle-fill"></i>
                        </button>
                      </div>
                      <i className="bi bi-person-circle fs-5 clr-cyan d-block mb-1"></i>
                      <div className="fw-bold small text-light">{u.username}</div>
                      <span className={`badge ${u.role === 'admin' ? 'bg-danger' : 'bg-secondary'} opacity-75`} style={{ fontSize: '0.65rem' }}>{u.role || 'cashier'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── SECTION 3: SYSTEM SYNC & CLOUD CONTROLS ───────────────────────── */}
        <div className="col-12 col-xl-6">
          <div className="panel h-100">
            <div className="panel-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: '8px' }}>
                <path d="M3.89 15.672L6.255.461A.542.542 0 017.27.288l2.543 4.771 2.39-4.52a.542.542 0 01.96 0L22.073 22H3.89z" fill="#FFA000"/>
                <path d="M17.656 18.281L13.84 3.326a.545.545 0 00-1.05-.021L9.274 10.52 17.656 18.281z" fill="#F57F17"/>
                <path d="M3.89 15.672l.924-8.684 4.46 12.992zM22.073 22l-4.417-3.719L13.83 22z" fill="#FFCA28"/>
              </svg>
              <span>Koneksi Google Sheets Cloud API</span>
              <span className="ms-auto">
                {sbConnected ? (
                  <span className="fb-badge fb-badge-connected" style={{ color: 'var(--green)', fontSize: '0.85rem' }}>
                    <span className="fb-status-dot fb-dot-connected" style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--green)', borderRadius: '50%', marginRight: '6px' }}></span>
                    Terhubung
                  </span>
                ) : (
                  <span className="fb-badge fb-badge-connecting" style={{ color: 'var(--orange)', fontSize: '0.85rem' }}>
                    <span className="fb-status-dot fb-dot-connecting" style={{ display: 'inline-block', width: '8px', height: '8px', background: 'var(--orange)', borderRadius: '50%', marginRight: '6px' }}></span>
                    Terputus
                  </span>
                )}
              </span>
            </div>
            <div className="panel-body d-flex flex-column justify-content-between">
              <div className="fb-auto-card p-3 border rounded mb-3" style={{ background: 'var(--bg3)' }}>
                <div className="fa-title font-weight-bold mb-2"><i className="bi bi-lightning-charge-fill me-1 clr-yellow"></i>Real-time Multi-Device Synchronization</div>
                <div className="fa-desc small text-secondary mb-3">Data sesi aktif, transaksi, dan QR tracking tersimpan di cloud. Semua perubahan antar device akan tersinkronisasi otomatis setiap 5 detik.</div>
                <div className="d-flex gap-2 flex-wrap">
                  <button className="btn btn-sm btn-outline-info" onClick={onSyncPull}><i className="bi bi-arrow-down-circle-fill me-1"></i>Tarik Data Cloud</button>
                  <button className="btn btn-sm btn-info text-white" onClick={onSyncPush} style={{ background: 'linear-gradient(135deg,#58a6ff,#1f6feb)', borderColor: '#388bfd' }}><i className="bi bi-arrow-up-circle-fill me-1"></i>Kirim Data Cloud</button>
                </div>
                <div className="mt-3 small text-secondary">Terakhir sinkron: <span>{lastSyncTime || '—'}</span></div>
              </div>

              {/* Password Admin Change */}
              <div className="p-3 border rounded mb-3" style={{ background: 'var(--bg3)' }}>
                <div className="fw-bold small text-light mb-2"><i className="bi bi-shield-lock-fill me-1 clr-red"></i>Password Akun Admin</div>
                <div className="d-flex flex-column gap-2">
                  <input
                    type="password"
                    value={oldPassInput}
                    onChange={(e) => setOldPassInput(e.target.value)}
                    className="cfield flex-fill"
                    placeholder="Password lama..."
                    style={{ paddingLeft: '12px' }}
                  />
                  <div className="input-group">
                    <input
                      type="password"
                      value={newPassInput}
                      onChange={(e) => setNewPassInput(e.target.value)}
                      className="cfield flex-fill"
                      placeholder="Password baru..."
                      style={{ paddingLeft: '12px' }}
                    />
                    <button className="btn-sec ms-2 py-2 px-3 border rounded text-white" style={{ background: 'var(--bg-sec)' }} onClick={handleChangePass}>Ubah</button>
                  </div>
                </div>
              </div>

              {/* Backup Database */}
              <div className="p-3 border rounded" style={{ background: 'var(--bg3)' }}>
                <div className="fw-bold small text-light mb-2"><i className="bi bi-database-fill me-1 clr-green"></i>Backup Database</div>
                <p className="small text-secondary mb-2">Backup otomatis setiap jam. Backup manual juga tersedia.</p>
                <button className="btn btn-sm btn-outline-success w-100" onClick={handleBackup}>
                  <i className="bi bi-cloud-arrow-down-fill me-1"></i>Backup Manual Sekarang
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── SECTION 4: HARDWARE & DISPLAY SETTINGS ────────────────────────── */}
        <div className="col-12 col-xl-7">
          <div className="panel h-100">
            <div className="panel-head"><i className="bi bi-image-fill clr-yellow"></i><span>Custom Gambar Item Rental</span></div>
            <div className="panel-body">
              <div className="row row-cols-2 row-cols-sm-3 g-2">
                {ITEMS.map(item => {
                  const img = getImgUrl(item.code) || item.defaultImg;
                  return (
                    <div className="col" key={item.code}>
                      <div className="setting-card p-2 border rounded text-center" style={{ background: 'var(--bg3)' }}>
                        <div className="setting-img-box mb-2" style={{ height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', borderRadius: '8px', overflow: 'hidden' }}>
                          <img 
                            src={img} 
                            alt={item.name}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover' }}
                            onError={(e) => { e.target.parentElement.innerHTML = `<div style="font-size:2rem">${item.emoji}</div>` }} 
                          />
                        </div>
                        <div className="setting-code small font-weight-bold" style={{ color: 'var(--yellow)' }}>{item.code}</div>
                        <div className="setting-name small text-truncate mb-2">{item.name}</div>
                        <div className="d-flex gap-1">
                          <button className="btn btn-sm btn-outline-secondary w-50" style={{ fontSize: '0.72rem' }} onClick={() => handleUploadImg(item.code)}>Ubah</button>
                          <button className="btn btn-sm btn-outline-danger w-50" style={{ fontSize: '0.72rem' }} onClick={() => handleResetImg(item.code)}>Reset</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-5">
          <div className="row g-3">
            <div className="col-12">
              <div className="panel">
                <div className="panel-head"><i className="bi bi-palette-fill clr-yellow"></i><span>Tampilan Tema</span></div>
                <div className="panel-body">
                  <div className="toggle-row d-flex justify-content-between align-items-center">
                    <div>
                      <div style={{ fontWeight: 700 }}>Mode Tampilan</div>
                      <div className="small text-secondary">{theme === 'dark' ? 'Mode Gelap aktif' : 'Mode Terang aktif'}</div>
                    </div>
                    <div className="theme-seg d-flex border rounded overflow-hidden">
                      <button className={`theme-seg-btn btn btn-sm py-2 px-3 border-0 rounded-0 ${theme === 'light' ? 'active bg-primary text-white' : 'btn-dark'}`} onClick={() => onThemeChange('light')}><i className="bi bi-sun-fill me-1"></i>Light</button>
                      <button className={`theme-seg-btn btn btn-sm py-2 px-3 border-0 rounded-0 ${theme === 'dark' ? 'active bg-primary text-white' : 'btn-dark'}`} onClick={() => onThemeChange('dark')}><i className="bi bi-moon-stars-fill me-1"></i>Dark</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12">
              <div className="panel">
                <div className="panel-head"><i className="bi bi-printer-fill clr-cyan"></i><span>Auto Print Struk Thermal</span></div>
                <div className="panel-body">
                  <div className="toggle-row d-flex justify-content-between align-items-center mb-2">
                    <div>Print saat <b>mulai sewa</b></div>
                    <div className="form-check form-switch mb-0">
                      <input 
                        className="form-check-input ctoggle" 
                        type="checkbox" 
                        checked={printMulai}
                        onChange={(e) => onChangePrintMulai(e.target.checked)}
                      />
                    </div>
                  </div>
                  <div className="toggle-row d-flex justify-content-between align-items-center">
                    <div>Print saat <b>selesai bayar</b></div>
                    <div className="form-check form-switch mb-0">
                      <input 
                        className="form-check-input ctoggle" 
                        type="checkbox" 
                        checked={printSelesai}
                        onChange={(e) => onChangePrintSelesai(e.target.checked)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 mt-3 border-top pt-3 text-secondary d-flex justify-content-between small">
          <span><i className="bi bi-code-slash me-1"></i>System Version: v{APP_VERSION}</span>
          <span><i className="bi bi-clock-history me-1"></i>Last deploy: {DEPLOY_DATE}</span>
        </div>

      </div>
    </div>
  );
}

export default SettingsTab;
