import React, { useState } from 'react';
import { changeAdminPassword, backupDatabase } from '../api';
import { swalSuccess, swalError, swalWarning, swalConfirm } from '../lib/swal';
import SettingsAnalytics from './SettingsAnalytics';
import SettingsUsers from './SettingsUsers';
import SettingsOutlets from './SettingsOutlets';

const APP_VERSION = '1.4.0';
const DEPLOY_DATE = '27 Jul 2026';

function SettingsTab({ 
  users = [],
  outlets = [],
  transactions = [],
  activeSessions = [],
  currentShiftUser,
  theme, 
  onThemeChange, 
  onSyncPull, 
  printMulai,
  onChangePrintMulai,
  printSelesai,
  onChangePrintSelesai
}) {
  const [newPassInput, setNewPassInput] = useState('');
  const [oldPassInput, setOldPassInput] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleChangePass = async (e) => {
    if (e) e.preventDefault();
    const oldP = oldPassInput.trim();
    const newP = newPassInput.trim();
    if (!newP || !oldP) {
      swalWarning('Form Kosong', 'Masukkan password lama dan password baru!');
      return;
    }
    const ok = await swalConfirm('Ubah Password Admin?', 'Password lama akan diganti dengan password baru.', 'Ya, Ubah!', 'question');
    if (!ok) return;
    try {
      setIsChangingPass(true);
      const res = await changeAdminPassword(oldP, newP);
      if (res?.success) {
        setOldPassInput('');
        setNewPassInput('');
        swalSuccess('Password Berhasil Diperbarui!');
      } else {
        swalError('Gagal Mengubah', res?.error || 'Gagal mengubah password admin.');
      }
    } catch (err) {
      console.error('Change password failed:', err);
      swalError('Koneksi Gagal', 'Tidak dapat terhubung ke server.');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleBackup = async () => {
    try {
      setIsBackingUp(true);
      const res = await backupDatabase();
      if (res?.success) {
        swalSuccess('Backup Database Berhasil!', res.path ? `File: ${res.path}` : 'Database snapshot berhasil dibuat.');
      } else {
        swalError('Backup Gagal', res?.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Backup failed:', err);
      swalError('Koneksi Gagal', 'Tidak dapat terhubung ke server.');
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <div id="tab-pengaturan" className="tab-pane active">
      <div className="row g-3">

        {/* ─── SECTION 1: EXECUTIVE DASHBOARD ANALYTICS ───────────────────── */}
        <SettingsAnalytics
          transactions={transactions}
          activeSessions={activeSessions}
          currentShiftUser={currentShiftUser}
        />

        {/* ─── SECTION 2: USER & OUTLET MANAGEMENT ─────────────────────────── */}
        <SettingsUsers users={users} onSyncPull={onSyncPull} />
        <SettingsOutlets outlets={outlets} onSyncPull={onSyncPull} />

        {/* ─── SECTION 3: SECURITY & DISASTER RECOVERY ─────────────────────── */}
        <div className="col-12 col-xl-6">
          <div className="panel h-100">
            <div className="panel-head">
              <i className="bi bi-shield-lock-fill clr-red"></i>
              <span>Keamanan &amp; Disaster Recovery</span>
            </div>
            <div className="panel-body d-flex flex-column gap-3">
              {/* Password Admin */}
              <div className="p-3 border rounded-3" style={{ background: 'var(--bg3)' }}>
                <div className="fw-bold small mb-2" style={{ color: 'var(--text)' }}>
                  <i className="bi bi-key-fill me-1 clr-yellow"></i>Ubah Password Akun Admin
                </div>
                <form onSubmit={handleChangePass} className="d-flex flex-column gap-2">
                  <input
                    type="password"
                    value={oldPassInput}
                    onChange={(e) => setOldPassInput(e.target.value)}
                    className="cfield flex-fill"
                    placeholder="Password saat ini..."
                  />
                  <div className="d-flex gap-2">
                    <input
                      type="password"
                      value={newPassInput}
                      onChange={(e) => setNewPassInput(e.target.value)}
                      className="cfield flex-fill"
                      placeholder="Password baru..."
                    />
                    <button 
                      type="submit" 
                      className="btn btn-sm btn-primary px-3 fw-bold"
                      disabled={isChangingPass}
                    >
                      {isChangingPass ? '...' : 'Ubah'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Database Backup */}
              <div className="p-3 border rounded-3" style={{ background: 'var(--bg3)' }}>
                <div className="fw-bold small mb-2" style={{ color: 'var(--text)' }}>
                  <i className="bi bi-database-fill-check me-1 clr-green"></i>Snapshot &amp; Backup Database
                </div>
                <p className="small text-secondary mb-3">
                  Buat cadangan snapshot database SQLite/PostgreSQL secara instan untuk keamanan dan pemulihan bencana.
                </p>
                <button 
                  type="button" 
                  className="btn btn-sm btn-outline-success w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-2" 
                  onClick={handleBackup}
                  disabled={isBackingUp}
                >
                  <i className="bi bi-cloud-arrow-down-fill"></i>
                  {isBackingUp ? 'Membuat Snapshot...' : 'Backup Snapshot Database Sekarang'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── SECTION 4: HARDWARE & DISPLAY SETTINGS ────────────────────────── */}
        <div className="col-12 col-xl-6">
          <div className="panel h-100">
            <div className="panel-head">
              <i className="bi bi-sliders clr-cyan"></i>
              <span>Preferensi &amp; Perangkat Hardware</span>
            </div>
            <div className="panel-body d-flex flex-column gap-3">
              {/* Tampilan Tema */}
              <div className="p-3 border rounded-3 d-flex justify-content-between align-items-center" style={{ background: 'var(--bg3)' }}>
                <div>
                  <div className="fw-bold small" style={{ color: 'var(--text)' }}>
                    <i className="bi bi-palette-fill me-1 clr-yellow"></i>Mode Tampilan
                  </div>
                  <div className="small text-secondary">{theme === 'dark' ? 'Tema Gelap Aktif' : 'Tema Terang Aktif'}</div>
                </div>
                <div className="d-flex border rounded overflow-hidden">
                  <button 
                    type="button"
                    className={`btn btn-sm py-1 px-3 border-0 rounded-0 ${theme === 'light' ? 'btn-primary text-white' : 'btn-outline-secondary'}`} 
                    onClick={() => onThemeChange && onThemeChange('light')}
                  >
                    <i className="bi bi-sun-fill me-1"></i>Light
                  </button>
                  <button 
                    type="button"
                    className={`btn btn-sm py-1 px-3 border-0 rounded-0 ${theme === 'dark' ? 'btn-primary text-white' : 'btn-outline-secondary'}`} 
                    onClick={() => onThemeChange && onThemeChange('dark')}
                  >
                    <i className="bi bi-moon-stars-fill me-1"></i>Dark
                  </button>
                </div>
              </div>

              {/* Auto Print Thermal Receipt */}
              <div className="p-3 border rounded-3" style={{ background: 'var(--bg3)' }}>
                <div className="fw-bold small mb-2" style={{ color: 'var(--text)' }}>
                  <i className="bi bi-printer-fill me-1 clr-cyan"></i>Auto Print Struk Thermal
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom border-secondary border-opacity-25">
                  <div className="small text-secondary">Cetak struk saat <b>mulai sewa</b></div>
                  <div className="form-check form-switch mb-0">
                    <input 
                      className="form-check-input ctoggle" 
                      type="checkbox" 
                      checked={!!printMulai}
                      onChange={(e) => onChangePrintMulai && onChangePrintMulai(e.target.checked)}
                    />
                  </div>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="small text-secondary">Cetak struk saat <b>selesai bayar</b></div>
                  <div className="form-check form-switch mb-0">
                    <input 
                      className="form-check-input ctoggle" 
                      type="checkbox" 
                      checked={!!printSelesai}
                      onChange={(e) => onChangePrintSelesai && onChangePrintSelesai(e.target.checked)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Footer */}
        <div className="col-12 mt-3 border-top pt-3 text-secondary d-flex justify-content-between small">
          <span><i className="bi bi-terminal-fill me-1"></i>POS Engine v{APP_VERSION}</span>
          <span><i className="bi bi-calendar-check me-1"></i>Build Date: {DEPLOY_DATE}</span>
        </div>

      </div>
    </div>
  );
}

export default SettingsTab;
