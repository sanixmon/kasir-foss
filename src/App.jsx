import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import { fetchAllData, addSession, editSession, claimSession, deleteSession, deleteTxn, clearAllTxns, saveSetting } from './api';
import { checkShiftExpiration, getShiftDate } from './lib/shift';
import DashboardTab from './components/DashboardTab';
import HistoryTab from './components/HistoryTab';
import SettingsTab from './components/SettingsTab';
import FooterNav from './components/FooterNav';
import RoleSelection from './components/RoleSelection';

import CalculateRentalModal from './components/CalculateRentalModal';
import PaymentModal from './components/PaymentModal';
import PasswordVerificationModal from './components/PasswordVerificationModal';
import QRCodeModal from './components/QRCodeModal';
import EditActiveSessionModal from './components/EditActiveSessionModal';
import TrackingPage from './components/TrackingPage';
import LiveClock from './components/LiveClock';

export const ITEMS = [
  { code:'ST',  name:'Stroller',          emoji:'🛺', defaultImg:'https://i.ibb.co.com/fzwMy2XL/The-Edit-The-stroller-changing-the-game-banner-desktop.webp', priceHour:20000, priceOT30:10000, priceOT60:20000 },
  { code:'SB',  name:'Stroller Paket 3J', emoji:'🛺', defaultImg:'https://i.ibb.co.com/fzwMy2XL/The-Edit-The-stroller-changing-the-game-banner-desktop.webp', priceHour:50000, priceOT30:10000, priceOT60:20000, isPackage:true, packageHours:3 },
  { code:'SD',  name:'Scooter Dewasa',    emoji:'🛵', defaultImg:'https://i.ibb.co.com/rG55b6ts/wp8922917.jpg',                                                           priceHour:50000, priceOT30:25000, priceOT60:50000 },
  { code:'SJ',  name:'Scooter Jumbo',     emoji:'🦽', defaultImg:'https://i.ibb.co.com/hxVgMw63/Pngtree-3d-render-of-a-black-5598024.jpg',                               priceHour:60000, priceOT30:30000, priceOT60:60000 },
  { code:'SA',  name:'Scooter Anak',      emoji:'🛴', defaultImg:'https://i.ibb.co.com/qMZ9szQQ/adad.png',                                                               priceHour:35000, priceOT30:20000, priceOT60:35000 },
];

export const fmtRp = n => n ? 'Rp ' + Math.round(n).toLocaleString('id-ID') : 'Rp 0';
export const generateShortId = (prefix = 's') => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
export const fmtDur = s => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError' && key !== 'kw_txns') {
      try {
        const txns = JSON.parse(localStorage.getItem('kw_txns') || '[]');
        const pruned = txns.slice(-200);
        localStorage.setItem('kw_txns', JSON.stringify(pruned));
      } catch (_) {}
      localStorage.setItem(key, value);
    } else {
      throw e;
    }
  }
}

export function normalizeItems(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(it => {
      if (!it) return null;
      if (typeof it === 'string') {
        const m = it.trim().match(/^(.+?)(?:[x\xD7](\d+))?$/i);
        return m ? { code: m[1].trim(), qty: Number(m[2] || 1) } : { code: it.trim(), qty: 1 };
      }
      if (typeof it === 'object') {
        return { code: String(it.code || 'ITEM'), qty: Number(it.qty || 1) };
      }
      return null;
    }).filter(Boolean);
  }
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return normalizeItems(parsed);
    } catch(e) {}
    return val.split(',').map(part => {
      const p = part.trim();
      const m = p.match(/^(.+?)(?:[x\xD7](\d+))?$/i);
      return m ? { code: m[1].trim(), qty: Number(m[2] || 1) } : { code: p, qty: 1 };
    }).filter(Boolean);
  }
  return [];
}

export function normalizeSession(s) {
  if (!s || typeof s !== 'object') return null;
  const startMs = Number(s.startTime);
  const validStart = (!isNaN(startMs) && startMs > 1577836800000) ? startMs : Date.now();
  return {
    ...s,
    id: String(s.id || generateShortId('s')),
    nama: String(s.nama || 'Penyewa'),
    items: normalizeItems(s.items),
    startTime: validStart,
    tanggal: String(s.tanggal || getShiftDate(validStart)),
    queueNo: Number(s.queueNo || 0),
    payAwal: String(s.payAwal || 'cash').toLowerCase(),
    _synced: s._synced !== undefined ? Boolean(s._synced) : true
  };
}

export function normalizeTxn(t) {
  if (!t || typeof t !== 'object') return null;
  const startMs = Number(t.startTime);
  const validStart = (!isNaN(startMs) && startMs > 1577836800000) ? startMs : Date.now();
  const endMs = Number(t.endTime);
  const validEnd = (!isNaN(endMs) && endMs > 1577836800000) ? endMs : validStart;
  return {
    ...t,
    id: String(t.id || generateShortId('t')),
    no: Number(t.no || Date.now()),
    queueNo: Number(t.queueNo || 0),
    nama: String(t.nama || 'Penyewa'),
    tanggal: String(t.tanggal || getShiftDate(validStart)),
    startTime: validStart,
    endTime: validEnd,
    items: typeof t.items === 'string' ? t.items : normalizeItems(t.items),
    ot: String(t.ot || '-'),
    otDur: String(t.otDur || '-'),
    totalBase: Number(t.totalBase || 0),
    totalOT: Number(t.totalOT || 0),
    totalTol: Number(t.totalTol || 0),
    grandTotal: Number(t.grandTotal || 0),
    totalAll: Number(t.totalAll || 0),
    payAwal: String(t.payAwal || 'cash').toLowerCase(),
    cash: Number(t.cash || 0),
    qris: Number(t.qris || 0),
    shift: String(t.shift || '-'),
    _synced: t._synced !== undefined ? Boolean(t._synced) : true
  };
}

// No localStorage data caching — SQLite server is source of truth

function App() {
  const [activeSessions, setActiveSessions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [adminPassword, setAdminPassword] = useState('admin');
  const [shiftQueueNo, setShiftQueueNo] = useState(0);
  const [currentShiftUser, setCurrentShiftUser] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [apiConnected, setApiConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTrackingMode, setIsTrackingMode] = useState(false);
  const [trackingId, setTrackingId] = useState('');

  // Modals Visibility
  const [activeCheckoutSession, setActiveCheckoutSession] = useState(null);
  const [activePaymentData, setActivePaymentData] = useState(null);
  const [activeQRModalSession, setActiveQRModalSession] = useState(null);
  const [activeEditSession, setActiveEditSession] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutConfirmName, setLogoutConfirmName] = useState('');

  // Settings states
  const [printMulai, setPrintMulai] = useState(false);
  const [printSelesai, setPrintSelesai] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [imageUpdateTrigger, setImageUpdateTrigger] = useState(0);

  const todayStr = (ts) => getShiftDate(ts);

  const handleLogin = (user) => {
    const cName = user.charAt(0).toUpperCase() + user.slice(1);
    setCurrentShiftUser(cName);
    localStorage.setItem('kw_currentUser', cName);
    
    const shiftDate = getShiftDate();
    localStorage.setItem('kw_shiftDate', shiftDate);
  };

  const handleLogout = () => {
    setLogoutConfirmName('');
    setShowLogoutConfirm(true);
  };

  const doLogout = () => {
    if (logoutConfirmName.trim().toLowerCase() !== (currentShiftUser || '').toLowerCase()) {
      return;
    }
    localStorage.removeItem('kw_currentUser');
    localStorage.removeItem('kw_shiftQNo');
    localStorage.removeItem('kw_userRole');
    setShiftQueueNo(0);
    setCurrentShiftUser(null);
    setCurrentUserRole(null);
    setShowLogoutConfirm(false);
  };



  const loadData = async () => {
    try {
      setIsSyncing(true);
      const data = await fetchAllData();
      if (data && !data.error) {
        const sessions = Array.isArray(data.sessions)
          ? data.sessions.map(normalizeSession).filter(Boolean)
          : [];
        const txns = Array.isArray(data.transactions)
          ? data.transactions.map(normalizeTxn).filter(Boolean).sort((a, b) => (a.no || 0) - (b.no || 0))
          : [];

        setActiveSessions(sessions);
        setTransactions(txns);

        if (Array.isArray(data.users)) {
          setUsers(data.users);
        }

        if (data.settings && typeof data.settings === 'object') {
          if (data.settings.admin_pass) {
            setAdminPassword(data.settings.admin_pass);
          }
        }

        setApiConnected(true);
        setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
      }
    } catch (err) {
      console.error('API polling error:', err);
      setApiConnected(false);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Load preferences and session state from localStorage (by design)
    setShiftQueueNo(parseInt(localStorage.getItem('kw_shiftQNo') || '0'));
    setPrintMulai(localStorage.getItem('kw_printMulai') === 'true');
    setPrintSelesai(localStorage.getItem('kw_printSelesai') === 'true');

    const savedTheme = localStorage.getItem('kw_theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    const savedUser = localStorage.getItem('kw_currentUser');
    if (savedUser) setCurrentShiftUser(savedUser);
    const savedRole = localStorage.getItem('kw_userRole');
    if (savedRole) setCurrentUserRole(savedRole);

    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#track/')) {
        setIsTrackingMode(true);
        const cleanId = hash.replace('#track/', '').split('?')[0].split('&')[0].replace(/\/+$/, '').trim();
        setTrackingId(cleanId);
      } else {
        setIsTrackingMode(false);
        setTrackingId('');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);

    const savedUserForShift = localStorage.getItem('kw_currentUser');
    if (savedUserForShift) {
      let shiftDate = localStorage.getItem('kw_shiftDate');
      const currentShiftDate = getShiftDate();
      if (!shiftDate) {
        shiftDate = currentShiftDate;
        localStorage.setItem('kw_shiftDate', shiftDate);
      }
      if (checkShiftExpiration(shiftDate, currentShiftDate)) {
        localStorage.removeItem('kw_currentUser');
        localStorage.removeItem('kw_shiftDate');
        localStorage.removeItem('kw_shiftQNo');
        setShiftQueueNo(0);
        setCurrentShiftUser(null);
      }
    }

    loadData();
    const interval = setInterval(loadData, 5000);

    return () => {
      window.removeEventListener('hashchange', checkHash);
      clearInterval(interval);
    };
  }, []);



  const triggerPrintReceipt = (html, qrText) => {
    const area = document.getElementById('printArea');
    if (!area) return;
    area.innerHTML = html;
    area.style.display = 'block';

    setTimeout(() => {
      const qrEl = area.querySelector('#printQrCode');
      if (qrEl && qrText && typeof window.QRCode !== 'undefined') {
        new window.QRCode(qrEl, { text: qrText, width: 120, height: 120, colorDark: '#000000', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
      }
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          area.style.display = 'none';
        }, 100);
      }, 500);
    }, 100);
  };

  const handlePrintMulai = (session) => {
    const itemsText = session.items.map(i => { 
      const d = ITEMS.find(item => item.code === i.code); 
      if (!d) return `${i.code} x${i.qty}`;
      return `${i.code} - ${d.name} x${i.qty}  ${fmtRp(d.priceHour * i.qty)}`; 
    }).join('\n');

    const total = session.items.reduce((s, i) => {
      const d = ITEMS.find(item => item.code === i.code);
      return s + (d ? d.priceHour * i.qty : 0);
    }, 0);

    const trackUrl = window.location.href.split('#')[0] + '#track/' + session.id;

    const dateStr = ts => { 
      const d = new Date(ts); 
      return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`; 
    };
    const timeStr = ts => new Date(ts).toTimeString().slice(0,5);

    const html = `
      <div class="receipt-mono">
        <div class="rc rb" style="font-size:13px">EVREN HOUSE</div>
        <div class="rc">Scooter &amp; Stroller</div>
        <div class="rc">Struk Mulai Sewa</div>
        <hr>
        <div>Queue Number: ${session.queueNo || 0}</div>
        <div>Tgl: ${dateStr(session.startTime)} | ${timeStr(session.startTime)}</div>
        <div>Nama: ${session.nama}</div>
        <div>Shift: ${currentShiftUser || '-'}</div>
        <hr>
        <pre style="font-size:11px;margin:0">${itemsText}</pre>
        <hr>
        <div class="rr rb"><span>Total Pokok:</span><span>${fmtRp(total)}</span></div>
        <hr>
        <div class="rc" style="margin:5px 0">
          <div id="printQrCode" style="display:inline-block;background:#fff;padding:5px"></div>
          <div style="font-size:9px;margin-top:4px">Scan QR untuk Cek Sisa Waktu</div>
        </div>
        <hr>
        <div class="rc" style="font-size:10px">Terima kasih!</div>
      </div>`;

    triggerPrintReceipt(html, trackUrl);
  };

  const handlePrintSelesai = (txn) => {
    const trackUrl = window.location.href.split('#')[0] + '#track/' + txn.id;
    const durSec = Math.floor((txn.endTime - txn.startTime) / 1000);

    const dateStr = ts => { 
      const d = new Date(ts); 
      return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`; 
    };
    const timeStr = ts => new Date(ts).toTimeString().slice(0,5);

    const html = `
      <div class="receipt-mono">
        <div class="rc rb" style="font-size:13px">EVREN HOUSE</div>
        <div class="rc">Scooter &amp; Stroller</div>
        <div class="rc">Struk Selesai Sewa</div>
        <hr>
        <div>Queue Number: ${txn.queueNo || 0}</div>
        <div>No: ${txn.no} | ${dateStr(txn.endTime)}</div>
        <div>Nama: ${txn.nama}</div>
        <div>Shift: ${txn.shift || '-'}</div>
        <div style="font-size:11px">Mulai: ${timeStr(txn.startTime)} | Selesai: ${timeStr(txn.endTime)}</div>
        <div style="font-size:11px">Durasi: ${fmtDur(durSec)}</div>
        <hr>
        <div style="font-size:11px">Item: ${txn.items}</div>
        ${txn.ot !== '-' ? `<div style="font-size:11px">OT: ${txn.ot}</div>` : ''}
        <hr>
        <div class="rr"><span>Sewa Pokok:</span><span>${fmtRp(txn.totalBase)} (${txn.payAwal.toUpperCase()})</span></div>
        ${txn.totalOT > 0 ? `<div class="rr"><span>Overtime:</span><span>${fmtRp(txn.totalOT)}</span></div>` : ''}
        <hr>
        <div class="rr rb"><span>TOTAL:</span><span>${fmtRp(txn.totalAll)}</span></div>
        ${txn.cash > 0 ? `<div class="rr"><span>Cash:</span><span>${fmtRp(txn.cash)}</span></div>` : ''}
        ${txn.qris > 0 ? `<div class="rr"><span>QRIS:</span><span>${fmtRp(txn.qris)}</span></div>` : ''}
        <hr>
        <div class="rc" style="margin:5px 0">
          <div id="printQrCode" style="display:inline-block;background:#fff;padding:5px"></div>
          <div style="font-size:9px;margin-top:4px">Scan QR untuk Struk Digital</div>
        </div>
        <hr>
        <div class="rc" style="font-size:10px">Terima kasih telah berkunjung!</div>
      </div>`;

    triggerPrintReceipt(html, trackUrl);
  };

  const handleStartSewa = async (nama, items, payAwal) => {
    const sessionData = {
      id: generateShortId('s'),
      nama,
      items,
      startTime: Date.now(),
      tanggal: todayStr(),
      payAwal
    };

    try {
      const res = await addSession(sessionData);
      if (res && res.session) {
        const newSess = normalizeSession(res.session);
        setActiveSessions(prev => [...prev.filter(s => s.id !== newSess.id), newSess]);
        if (printMulai) handlePrintMulai(newSess);
      } else {
        throw new Error(res?.error || 'Gagal menyimpan sesi ke server');
      }
    } catch (e) {
      console.error('Failed to start session:', e);
      alert('Gagal memulai sesi sewa. Periksa koneksi ke server.');
    }
  };

  if (isTrackingMode) {
    return <TrackingPage trackingId={trackingId} />;
  }

  const getImgUrl = (code) => {
    imageUpdateTrigger; // dependency tracking
    return localStorage.getItem('kw_img_' + code);
  };

  const handleDeleteTxn = async (txn) => {
    const txnObj = typeof txn === 'object' ? txn : { id: txn };
    if (window.confirm('Hapus bill / riwayat transaksi ini?')) {
      // Optimistic UI update
      setTransactions(prev => prev.filter(t => t.id !== txnObj.id && String(t.no) !== String(txnObj.no)));
      try {
        await deleteTxn({ id: txnObj.id, no: txnObj.no });
      } catch (e) {
        console.error('Failed to delete transaction on server:', e);
        // Rollback on error
        await loadData();
      }
    }
  };

  const handleClearHistory = async () => {
    if (transactions.length === 0) {
      alert('Tidak ada riwayat transaksi untuk dibersihkan.');
      return;
    }
    if (window.confirm('APAKAH ANDA YAKIN INGIN MEMBERSIHKAN SELURUH RIWAYAT TRANSAKSI? Data riwayat akan dihapus secara permanen.')) {
      setTransactions([]);
      try {
        await clearAllTxns();
      } catch (e) {
        console.error('Failed to clear history on server:', e);
        await loadData();
      }
    }
  };

  const handleVerifySuccess = () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'editSession') {
      setActiveEditSession(pendingAction.session);
      setPendingAction(null);
    } else if (pendingAction.type === 'deleteTxn') {
      handleDeleteTxn(pendingAction.id);
      setPendingAction(null);
    }
  };

  const handleSaveEditedSession = async (updatedSession) => {
    try {
      await editSession(updatedSession);
      setActiveSessions(prev => prev.map(s => s.id === updatedSession.id ? normalizeSession(updatedSession) : s));
      setActiveEditSession(null);
      alert('Sesi diperbarui!');
    } catch (e) {
      console.error('Failed to edit session:', e);
      alert('Gagal memperbarui sesi. Periksa koneksi ke server.');
    }
  };

  const handleFinalizePayment = async (cash, qris) => {
    if (!activePaymentData) return;
    const { session, itemsCalc, base, ot, tol, grand, otStr, otDurStr, endTime } = activePaymentData;

    const itemStr = itemsCalc
      .filter(it => it.returnQty > 0)
      .map(it => `${it.code}\u00d7${it.returnQty}`)
      .join(', ');

    const remainingItems = session.items.map(orig => {
      const calc = itemsCalc.find(it => it.code === orig.code);
      const returned = calc ? calc.returnQty : 0;
      return { code: orig.code, qty: orig.qty - returned };
    }).filter(it => it.qty > 0);

    const claimPayload = {
      sessionId: session.id,
      queueNo: session.queueNo || 0,
      nama: session.nama,
      tanggal: session.tanggal || todayStr(),
      startTime: session.startTime,
      endTime,
      items: itemStr,
      ot: otStr || '-',
      otDur: otDurStr || '-',
      totalBase: base,
      totalOT: ot,
      totalTol: tol,
      grandTotal: grand,
      totalAll: base + grand,
      payAwal: session.payAwal || 'cash',
      cash,
      qris,
      shift: currentShiftUser || '-'
    };

    try {
      const res = await claimSession(claimPayload);
      if (res && !res.error) {
        const newTxn = normalizeTxn(res.transaction || { ...claimPayload, id: `t-${session.id}` });
        setTransactions(prev => [...prev.filter(t => t.id !== newTxn.id), newTxn].sort((a, b) => (a.no || 0) - (b.no || 0)));
        if (remainingItems.length > 0) {
          setActiveSessions(prev => prev.map(s => s.id === session.id ? { ...s, items: remainingItems } : s));
        } else {
          setActiveSessions(prev => prev.filter(s => s.id !== session.id));
        }
        if (printSelesai) handlePrintSelesai(newTxn);
      } else {
        throw new Error(res?.error || 'Gagal memproses pembayaran');
      }
    } catch (e) {
      console.error('Failed to finalize payment:', e);
      alert('Gagal memproses pembayaran. Periksa koneksi ke server.');
    } finally {
      setActivePaymentData(null);
    }
  };

  const handleUpdateAdminPassword = async (newPass) => {
    setAdminPassword(newPass);
    try {
      await saveSetting('admin_pass', newPass);
    } catch (e) {
      console.warn('Failed to save admin password to server:', e);
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('kw_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handlePrintMulaiToggle = (val) => {
    setPrintMulai(val);
    localStorage.setItem('kw_printMulai', String(val));
  };

  const handlePrintSelesaiToggle = (val) => {
    setPrintSelesai(val);
    localStorage.setItem('kw_printSelesai', String(val));
  };

  if (!currentUserRole) {
    return (
      <RoleSelection 
        onSelectCashier={() => {
          setCurrentUserRole('cashier');
          localStorage.setItem('kw_userRole', 'cashier');
        }}
        onSelectAdmin={(pwd) => {
          if (pwd === adminPassword) {
            setCurrentUserRole('admin');
            localStorage.setItem('kw_userRole', 'admin');
          } else {
            alert('Password salah!');
          }
        }}
      />
    );
  }

  if (currentUserRole === 'cashier' && !currentShiftUser) {
    return (
      <div>
        <div className="p-2"><button className="btn btn-sm btn-outline-secondary" onClick={() => { setCurrentUserRole(null); localStorage.removeItem('kw_userRole'); }}>&larr; Ganti Role</button></div>
        <LoginPage users={users} onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div id="mainApp">
      <header className="app-header sticky-top">
        <div className="container-fluid px-3 px-md-4">
          <div className="d-flex align-items-center justify-content-between py-2 gap-2">
            <div>
              <div className="brand-title">EVREN HOUSE</div>
              <div className="brand-sub">Scooter &amp; Stroller</div>
            </div>
            <div className="d-flex align-items-center gap-2 gap-md-3">
              
              {/* Profile - Akhiri Shift */}
              <div className="dropdown">
                <div
                  className="shift-indicator d-flex align-items-center dropdown-toggle"
                  data-bs-toggle="dropdown"
                  style={{ cursor: 'pointer' }}
                >
                  <i className="bi bi-person-fill" style={{ color: 'var(--green)', fontSize: '1rem', marginRight: '4px' }}></i>
                  <span>{currentShiftUser}</span>
                </div>
                <ul className="dropdown-menu dropdown-menu-end dropdown-menu-dark shadow border-0" style={{ backgroundColor: 'var(--card-bg)', minWidth: '180px' }}>
                  <li>
                    <button className="dropdown-item text-danger d-flex align-items-center gap-2 py-2" onClick={handleLogout}>
                      <i className="bi bi-box-arrow-right"></i>
                      <span>Akhiri Shift</span>
                    </button>
                  </li>
                </ul>
              </div>

              {/* Status Badge & Refresh */}
              <div className="d-flex align-items-center gap-2">
                <div title={`API Connection: ${apiConnected ? 'Online' : 'Offline'}`} style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '.65rem', fontWeight: 700, letterSpacing: '.5px',
                  padding: '3px 6px', borderRadius: '4px', cursor: 'default',
                  background: apiConnected
                    ? 'rgba(63,185,80,.15)' : 'rgba(249,115,22,.15)',
                  color: apiConnected
                    ? 'var(--green)' : 'var(--orange)',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                    background: 'currentColor',
                    animation: isSyncing ? 'pulse 1.2s infinite' : 'none',
                  }}/>
                  <span className="d-none d-sm-inline">
                    {isSyncing ? 'SYNC…' : apiConnected ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                <button
                  className="bg-transparent border-0 text-secondary p-1 d-flex align-items-center justify-content-center"
                  title="Refresh Data dari Server"
                  onClick={loadData}
                  style={{ cursor: 'pointer', fontSize: '1.1rem', color: 'var(--cyan)' }}
                  aria-label="Refresh Data dari Server"
                >
                  <i className="bi bi-arrow-repeat clr-cyan" style={{ transition: 'transform 0.3s ease' }}></i>
                </button>
              </div>

              <div className="vr d-none d-sm-block" style={{ opacity: 0.15, height: '24px' }}></div>

              <LiveClock />
            </div>
          </div>
        </div>
      </header>
      <div className="container-fluid px-2 px-md-3 py-3" style={{ paddingBottom: '80px' }}>
        {activeTab === 'dashboard' && (
          <DashboardTab
            activeSessions={activeSessions}
            onStartSewa={handleStartSewa}
            getImgUrl={getImgUrl}
            onSelesaiSewa={(session) => setActiveCheckoutSession(session)}
            onShowQR={(session) => setActiveQRModalSession(session)}
            onPrintSesi={handlePrintMulai}
            onEditSesi={(session) => {
              setPendingAction({ type: 'editSession', session });
            }}
          />
        )}
        {activeTab === 'riwayat' && (
          <HistoryTab
            transactions={transactions}
            onPrintTxn={handlePrintSelesai}
            onDeleteTxn={(id) => {
              if (currentUserRole === 'admin') {
                handleDeleteTxn(id);
              } else {
                setPendingAction({ type: 'deleteTxn', id });
              }
            }}
            onClearHistory={currentUserRole === 'admin' ? handleClearHistory : null}
            currentUserRole={currentUserRole}
          />
        )}
        {activeTab === 'pengaturan' && currentUserRole === 'cashier' && (
          <div className="text-center mt-5">
            <h4>Akses Ditolak</h4>
            <p>Hanya Admin yang dapat mengakses Pengaturan.</p>
          </div>
        )}
        {activeTab === 'pengaturan' && currentUserRole === 'admin' && (
          <SettingsTab
            users={users}
            transactions={transactions}
            activeSessions={activeSessions}
            currentShiftUser={currentShiftUser}
            theme={theme}
            onThemeChange={handleThemeChange}
            adminPassword={adminPassword}
            onUpdateAdminPassword={handleUpdateAdminPassword}
            sbConnected={apiConnected}
            lastSyncTime={lastSyncTime}
            onSyncPull={loadData}
            onSyncPush={loadData}
            printMulai={printMulai}
            onChangePrintMulai={handlePrintMulaiToggle}
            printSelesai={printSelesai}
            onChangePrintSelesai={handlePrintSelesaiToggle}
            onUpdateItemImg={(code, url) => {
              localStorage.setItem('kw_img_' + code, url);
              setImageUpdateTrigger(prev => prev + 1);
            }}
            onResetItemImg={(code) => {
              localStorage.removeItem('kw_img_' + code);
              setImageUpdateTrigger(prev => prev + 1);
            }}
            getImgUrl={getImgUrl}
          />
        )}
      </div>

      <FooterNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeCount={activeSessions.length}
        currentUserRole={currentUserRole}
      />

      {activeCheckoutSession && (
        <CalculateRentalModal
          session={activeCheckoutSession}
          onClose={() => setActiveCheckoutSession(null)}
          onProceedPayment={(data) => {
            setActiveCheckoutSession(null);
            setActivePaymentData(data);
          }}
          currentUserRole={currentUserRole}
        />
      )}

      {activePaymentData && (
        <PaymentModal
          bayarData={activePaymentData}
          onClose={() => setActivePaymentData(null)}
          onFinalize={handleFinalizePayment}
        />
      )}

      {pendingAction && (
        <PasswordVerificationModal
          adminPassword={adminPassword}
          onClose={() => setPendingAction(null)}
          onVerifySuccess={handleVerifySuccess}
        />
      )}

      {activeQRModalSession && (
        <QRCodeModal
          session={activeQRModalSession}
          onClose={() => setActiveQRModalSession(null)}
        />
      )}

      {activeEditSession && (
        <EditActiveSessionModal
          session={activeEditSession}
          onClose={() => setActiveEditSession(null)}
          onSave={handleSaveEditedSession}
        />
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowLogoutConfirm(false); }}
        >
          <div style={{
            background: 'var(--bg2)', border: '1.5px solid var(--border)',
            borderRadius: '24px 24px 0 0', padding: '28px 24px 36px',
            width: '100%', maxWidth: '480px',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
            animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'color-mix(in srgb, var(--red) 15%, transparent)',
                border: '1.5px solid color-mix(in srgb, var(--red) 35%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem', color: 'var(--red)', flexShrink: 0,
              }}>
                <i className="bi bi-box-arrow-right"></i>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Akhiri Shift</div>
                <div style={{ fontSize: '.8rem', color: 'var(--text2)', marginTop: '2px' }}>Sesi {currentShiftUser} akan berakhir</div>
              </div>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text2)', fontSize: '1.4rem', cursor: 'pointer', padding: '4px', lineHeight: 1 }}
              >×</button>
            </div>

            <div style={{ fontSize: '.82rem', color: 'var(--text2)', marginBottom: '12px', fontWeight: 600 }}>
              Ketik nama <strong style={{ color: 'var(--text)' }}>{currentShiftUser}</strong> untuk konfirmasi:
            </div>
            <input
              type="text"
              className="login-field"
              style={{ marginBottom: '16px' }}
              placeholder={`Ketik "${currentShiftUser}"...`}
              value={logoutConfirmName}
              onChange={(e) => setLogoutConfirmName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doLogout()}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-sec"
                style={{ flex: 1 }}
                onClick={() => setShowLogoutConfirm(false)}
              >
                Batal
              </button>
              <button
                onClick={doLogout}
                disabled={logoutConfirmName.trim().toLowerCase() !== (currentShiftUser || '').toLowerCase()}
                style={{
                  flex: 2, background: 'linear-gradient(135deg, var(--red), #c0392b)',
                  color: '#fff', border: 'none', borderRadius: '12px', padding: '13px',
                  fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: '1rem',
                  cursor: 'pointer', opacity: logoutConfirmName.trim().toLowerCase() !== (currentShiftUser || '').toLowerCase() ? 0.45 : 1,
                  transition: 'opacity .15s',
                }}
              >
                <i className="bi bi-box-arrow-right me-2"></i>Akhiri Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
