import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import { fetchAllData, addSession, editSession, claimSession, deleteSession } from './api';
import { checkShiftExpiration } from './lib/shift';
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

// localStorage guard — catches QuotaExceededError, prunes kw_txns if full
export const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn('localStorage quota exceeded, pruning old transactions...');
      try {
        const txns = JSON.parse(localStorage.getItem('kw_txns') || '[]');
        const unsynced = txns.filter(t => !t._synced);
        const synced = txns.filter(t => t._synced);
        
        let pruned;
        if (unsynced.length >= 200) {
          pruned = unsynced;
        } else {
          const needed = 200 - unsynced.length;
          pruned = [...unsynced, ...synced.slice(-needed)].sort((a, b) => (a.no || 0) - (b.no || 0));
        }
        
        safeSetItem('kw_txns', JSON.stringify(pruned));
        localStorage.setItem(key, value);
      } catch (e2) {
        console.error('localStorage full even after pruning:', e2);
      }
    } else {
      console.error('localStorage setItem failed:', e);
    }
  }
};

function App() {
  const [activeSessions, setActiveSessions] = useState([]);
  const [transactions, setTransactions] = useState([]);
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

  // Settings states
  const [printMulai, setPrintMulai] = useState(false);
  const [printSelesai, setPrintSelesai] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [imageUpdateTrigger, setImageUpdateTrigger] = useState(0);

  const handleLogin = (user) => {
    const cName = user.charAt(0).toUpperCase() + user.slice(1);
    setCurrentShiftUser(cName);
    localStorage.setItem('kw_currentUser', cName);
    
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('kw_shiftDate', today);
  };

  const handleLogout = () => {
    if (window.confirm(`Akhiri sesi / shift saat ini?`)) {
      localStorage.removeItem('kw_currentUser');
      localStorage.removeItem('kw_shiftQNo');
      localStorage.removeItem('kw_userRole');
      setShiftQueueNo(0);
      setCurrentShiftUser(null);
      setCurrentUserRole(null);
    }
  };

  const loadData = async () => {
    try {
      setIsSyncing(true);
      const data = await fetchAllData();
      if (data && !data.error) {
        if (Array.isArray(data.sessions)) {
          setActiveSessions(data.sessions);
          safeSetItem('kw_sessions', JSON.stringify(data.sessions));
        }
        if (Array.isArray(data.transactions)) {
          const sorted = [...data.transactions].sort((a, b) => (a.no || 0) - (b.no || 0));
          setTransactions(sorted);
          safeSetItem('kw_txns', JSON.stringify(sorted));
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
    // Load initial localstorage cache
    try {
      const s = localStorage.getItem('kw_sessions');
      if (s) setActiveSessions(JSON.parse(s));
    } catch(e) {}
    try {
      const t = localStorage.getItem('kw_txns');
      if (t) setTransactions(JSON.parse(t));
    } catch(e) {}
    
    setAdminPassword(localStorage.getItem('kw_pass') || 'admin');
    setShiftQueueNo(parseInt(localStorage.getItem('kw_shiftQNo') || '0'));
    setPrintMulai(localStorage.getItem('kw_printMulai') === 'true');
    setPrintSelesai(localStorage.getItem('kw_printSelesai') === 'true');

    const savedTheme = localStorage.getItem('kw_theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Check saved user
    const savedUser = localStorage.getItem('kw_currentUser');
    if (savedUser) setCurrentShiftUser(savedUser);
    const savedRole = localStorage.getItem('kw_userRole');
    if (savedRole) setCurrentUserRole(savedRole);

    // Check hash route
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

    // Check shift expiration on mount
    const savedUserForShift = localStorage.getItem('kw_currentUser');
    if (savedUserForShift) {
      const now = new Date();
      let shiftDate = localStorage.getItem('kw_shiftDate');
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      if (!shiftDate) {
        shiftDate = today;
        localStorage.setItem('kw_shiftDate', shiftDate);
      }

      if (checkShiftExpiration(shiftDate, today)) {
        localStorage.removeItem('kw_currentUser');
        localStorage.removeItem('kw_shiftDate');
        localStorage.removeItem('kw_shiftQNo');
        setShiftQueueNo(0);
        setCurrentShiftUser(null);
      }
    }

    // Initial load & 5-second polling interval
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
    const today = todayStr();
    const sessionData = {
      id: generateShortId('s'),
      nama,
      items,
      startTime: Date.now(),
      tanggal: today,
      payAwal
    };

    try {
      const res = await addSession(sessionData);
      if (res && res.session) {
        setActiveSessions(prev => {
          const updated = [...prev, res.session];
          safeSetItem('kw_sessions', JSON.stringify(updated));
          return updated;
        });
        if (printMulai) handlePrintMulai(res.session);
      }
    } catch (e) {
      console.error('Failed to start session:', e);
      alert('Gagal membuat sesi sewa. Periksa koneksi internet.');
    }
  };

  if (isTrackingMode) {
    return <TrackingPage trackingId={trackingId} />;
  }

  const getImgUrl = (code) => {
    imageUpdateTrigger; // dependency tracking
    return localStorage.getItem('kw_img_' + code);
  };

  const handleVerifySuccess = () => {
    if (!pendingAction) return;

    if (pendingAction.type === 'editSession') {
      setActiveEditSession(pendingAction.session);
      setPendingAction(null);
    } else if (pendingAction.type === 'deleteTxn') {
      if (window.confirm('Hapus transaksi ini?')) {
        const id = pendingAction.id;
        setTransactions(prev => {
          const updated = prev.filter(t => t.id !== id);
          safeSetItem('kw_txns', JSON.stringify(updated));
          return updated;
        });
      }
      setPendingAction(null);
    }
  };

  const handleSaveEditedSession = async (updatedSession) => {
    try {
      await editSession(updatedSession);
      setActiveSessions(prev => {
        const updatedSessions = prev.map(s => s.id === updatedSession.id ? updatedSession : s);
        safeSetItem('kw_sessions', JSON.stringify(updatedSessions));
        return updatedSessions;
      });
      setActiveEditSession(null);
      alert('Sesi diperbarui!');
    } catch (e) {
      console.error('Failed to edit session:', e);
      alert('Gagal memperbarui sesi. Periksa koneksi internet.');
    }
  };

  const handleFinalizePayment = async (cash, qris) => {
    if (!activePaymentData) return;
    const { session, itemsCalc, base, ot, tol, grand, otStr, otDurStr, endTime } = activePaymentData;
    
    // Calculate items checked out in this transaction
    const itemStr = itemsCalc
      .filter(it => it.returnQty > 0)
      .map(it => `${it.code}×${it.returnQty}`)
      .join(', ');

    // Calculate items remaining in the active session
    const remainingItems = session.items.map(orig => {
      const calc = itemsCalc.find(it => it.code === orig.code);
      const returned = calc ? calc.returnQty : 0;
      return {
        code: orig.code,
        qty: orig.qty - returned
      };
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
        // Build a local transaction object immediately so the history tab
        // updates instantly without waiting for the next 5-second poll
        const localTxn = res.transaction || {
          id: claimPayload.sessionId ? `t-${Math.random().toString(36).slice(2,8)}` : claimPayload.sessionId,
          no: Date.now(),
          queueNo: claimPayload.queueNo || 0,
          nama: claimPayload.nama,
          tanggal: claimPayload.tanggal || todayStr(),
          startTime: claimPayload.startTime,
          endTime: claimPayload.endTime,
          items: claimPayload.items,
          ot: claimPayload.ot,
          otDur: claimPayload.otDur,
          totalBase: claimPayload.totalBase,
          totalOT: claimPayload.totalOT,
          totalTol: claimPayload.totalTol,
          grandTotal: claimPayload.grandTotal,
          totalAll: claimPayload.totalAll,
          payAwal: claimPayload.payAwal,
          cash: claimPayload.cash,
          qris: claimPayload.qris,
          shift: claimPayload.shift
        };

        setTransactions(prev => {
          const without = prev.filter(t => t.id !== localTxn.id);
          const newTxns = [...without, localTxn];
          safeSetItem('kw_txns', JSON.stringify(newTxns));
          return newTxns;
        });

        setActiveSessions(prev => {
          let newSessions;
          if (remainingItems.length > 0) {
            newSessions = prev.map(s => s.id === session.id ? { ...s, items: remainingItems } : s);
          } else {
            newSessions = prev.filter(s => s.id !== session.id);
          }
          safeSetItem('kw_sessions', JSON.stringify(newSessions));
          return newSessions;
        });

        if (printSelesai) {
          handlePrintSelesai(localTxn);
        }
      } else {
        throw new Error(res && res.error ? res.error : 'Unknown error');
      }
    } catch (e) {
      console.error('Failed to finalize payment:', e);
      alert('Gagal memproses pembayaran. Periksa koneksi internet.');
    } finally {
      setActivePaymentData(null);
    }
  };

  const todayStr = () => {
    const d = new Date();
    d.setHours(d.getHours() - 6); // Shift rollover at 6 AM
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleUpdateAdminPassword = (newPass) => {
    setAdminPassword(newPass);
    localStorage.setItem('kw_pass', newPass);
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
        <LoginPage onLogin={handleLogin} />
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
              
              {/* Profile Dropdown */}
              <div className="dropdown">
                <div 
                  className="shift-indicator d-flex align-items-center dropdown-toggle" 
                  data-bs-toggle="dropdown"
                  style={{ cursor: 'pointer' }}
                >
                  <i className="bi bi-person-fill" style={{ color: 'var(--green)', fontSize: '1rem', marginRight: '4px' }}></i>
                  <span>{currentShiftUser}</span>
                </div>
                <ul className="dropdown-menu dropdown-menu-end dropdown-menu-dark shadow border-0" style={{ backgroundColor: 'var(--card-bg)' }}>
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
                if (window.confirm('Hapus bill / riwayat transaksi ini?')) {
                  setTransactions(prev => {
                    const updated = prev.filter(t => t.id !== id);
                    safeSetItem('kw_txns', JSON.stringify(updated));
                    return updated;
                  });
                }
              } else {
                setPendingAction({ type: 'deleteTxn', id });
              }
            }}
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
    </div>
  );
}

export default App;
