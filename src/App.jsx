import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import { sb } from './supabase';
import { mergeSyncData, getUnsyncedItems, formatTxnForSupabase, formatSessionForSupabase, cleanZombieSessions, findZombieSessionIds } from './lib/sync';
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
  { code:'ST3', name:'Stroller Paket 3J', emoji:'🛺', defaultImg:'https://i.ibb.co.com/fzwMy2XL/The-Edit-The-stroller-changing-the-game-banner-desktop.webp', priceHour:50000, priceOT30:10000, priceOT60:20000, isPackage:true, packageHours:3 },
  { code:'SD',  name:'Scooter Dewasa',    emoji:'🛵', defaultImg:'https://i.ibb.co.com/rG55b6ts/wp8922917.jpg',                                                           priceHour:50000, priceOT30:25000, priceOT60:50000 },
  { code:'SJ',  name:'Scooter Jumbo',     emoji:'🦽', defaultImg:'https://i.ibb.co.com/hxVgMw63/Pngtree-3d-render-of-a-black-5598024.jpg',                               priceHour:60000, priceOT30:30000, priceOT60:60000 },
  { code:'SA',  name:'Scooter Anak',      emoji:'🛴', defaultImg:'https://i.ibb.co.com/qMZ9szQQ/adad.png',                                                               priceHour:35000, priceOT30:20000, priceOT60:35000 },
];

export const fmtRp = n => n ? 'Rp ' + Math.round(n).toLocaleString('id-ID') : 'Rp 0';
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
  const [sbConnected, setSbConnected] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING');
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

  useEffect(() => {
    // Load initial localstorage
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

    // Supabase Auto-Connect
    const testConnection = async () => {
      try {
        const { error } = await sb.from('settings').select('*').limit(1).abortSignal(AbortSignal.timeout(5000));
        if (error) throw error;
        setSbConnected(true);
        // Load data from Supabase silently on start
        const { data: txns } = await sb.from('transactions').select('*').order('no', { ascending: true }).limit(5000);
        if (txns) {
          const ct = txns.map(row => ({
            id: row.id,
            no: row.no || 0,
            nama: row.nama,
            tanggal: row.tanggal,
            startTime: row.start_time || 0,
            endTime: row.end_time || 0,
            items: row.items,
            ot: row.ot || '-',
            otDur: row.ot_dur || '-',
            totalBase: row.total_base || 0,
            totalOT: row.total_ot || 0,
            totalTol: row.total_tol || 0,
            grandTotal: row.grand_total || 0,
            totalAll: row.total_all || ((row.total_base || 0) + (row.grand_total || 0)),
            payAwal: row.pay_awal || 'cash',
            cash: row.cash || 0,
            qris: row.qris || 0,
            shift: row.shift || '-',
            _synced: true
          }));

          // Merge local offline-only transactions
          const localTxns = JSON.parse(localStorage.getItem('kw_txns') || '[]');
          const mergedTxns = mergeSyncData(ct, localTxns).sort((a, b) => (a.no || 0) - (b.no || 0));

          setTransactions(mergedTxns);
          safeSetItem('kw_txns', JSON.stringify(mergedTxns));
        }

        const { data: sess } = await sb.from('active_sessions').select('*');
        if (sess) {
          const cs = sess.map(row => ({
            id: row.id,
            nama: row.nama,
            items: row.items || [],
            startTime: row.start_time || Date.now(),
            tanggal: row.tanggal || '',
            payAwal: row.pay_awal || 'cash',
            queueNo: row.queue_no || 0,
            _synced: true
          }));

          // Merge local offline-only active sessions and clean any zombie sessions (sessions already completed in transactions)
          const localSessions = JSON.parse(localStorage.getItem('kw_sessions') || '[]');
          const rawMergedSessions = mergeSyncData(cs, localSessions, (s) => !mergedTxns.some(t => t.id === s.id));
          const mergedSessions = cleanZombieSessions(rawMergedSessions, mergedTxns);

          setActiveSessions(mergedSessions);
          safeSetItem('kw_sessions', JSON.stringify(mergedSessions));

          // Clean up zombie sessions from Supabase active_sessions table if any exist
          const zombieIds = findZombieSessionIds(cs, mergedTxns);
          if (zombieIds.length > 0) {
            console.log(`[Zombie Purge] Membersihkan ${zombieIds.length} sesi zombie dari Supabase active_sessions...`);
            sb.from('active_sessions').delete().in('id', zombieIds).then(({ error: zErr }) => {
              if (zErr) console.error('Gagal hapus sesi zombie di Supabase:', zErr);
              else console.log('[Zombie Purge] Sesi zombie berhasil dihapus dari cloud.');
            });
          }

          // Auto-push unsynced local records to cloud upon refresh or connection
          const unsyncedTxns = getUnsyncedItems(mergedTxns);
          const unsyncedSessions = getUnsyncedItems(mergedSessions);

          if (unsyncedTxns.length > 0) {
            console.log(`[Auto-Push] Mendorong ${unsyncedTxns.length} transaksi offline ke cloud saat refresh...`);
            const rows = formatTxnForSupabase(unsyncedTxns);
            sb.from('transactions').upsert(rows).then(({ error: txErr }) => {
              if (!txErr) {
                console.log('[Auto-Push] Transaksi berhasil didorong ke cloud.');
                setTransactions(prev => {
                  const next = prev.map(t => ({ ...t, _synced: true }));
                  safeSetItem('kw_txns', JSON.stringify(next));
                  return next;
                });
                setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
              } else {
                console.error('[Auto-Push] Gagal push transaksi:', txErr);
              }
            });
          }

          if (unsyncedSessions.length > 0) {
            console.log(`[Auto-Push] Mendorong ${unsyncedSessions.length} sesi sewa offline ke cloud saat refresh...`);
            const rows = formatSessionForSupabase(unsyncedSessions);
            sb.from('active_sessions').upsert(rows).then(({ error: sessErr }) => {
              if (!sessErr) {
                console.log('[Auto-Push] Sesi aktif berhasil didorong ke cloud.');
                setActiveSessions(prev => {
                  const next = prev.map(s => ({ ...s, _synced: true }));
                  safeSetItem('kw_sessions', JSON.stringify(next));
                  return next;
                });
                setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
              } else {
                console.error('[Auto-Push] Gagal push sesi:', sessErr);
              }
            });
          }
        }
      } catch (err) {
        console.error('Supabase auto connect failed:', err);
        setSbConnected(false);
      }
    };
    testConnection();

    const handleOnline = () => {
      console.log('Internet pulih: menjalankan auto-push ke cloud...');
      testConnection();
    };
    window.addEventListener('online', handleOnline);

    const sub = sb.channel('app-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions' }, payload => {
        if (payload.eventType === 'INSERT') {
          const s = {
            id: payload.new.id,
            nama: payload.new.nama,
            items: payload.new.items || [],
            startTime: payload.new.start_time || Date.now(),
            tanggal: payload.new.tanggal || '',
            payAwal: payload.new.pay_awal || 'cash',
            queueNo: payload.new.queue_no || 0,
            _synced: true
          };
          setActiveSessions(prev => {
            const next = prev.some(x => x.id === s.id) ? prev.map(x => x.id === s.id ? s : x) : [...prev, s];
            safeSetItem('kw_sessions', JSON.stringify(next));
            return next;
          });
        } else if (payload.eventType === 'UPDATE') {
          const s = {
            id: payload.new.id,
            nama: payload.new.nama,
            items: payload.new.items || [],
            startTime: payload.new.start_time || Date.now(),
            tanggal: payload.new.tanggal || '',
            payAwal: payload.new.pay_awal || 'cash',
            queueNo: payload.new.queue_no || 0
          };
          setActiveSessions(prev => {
            const next = prev.some(x => x.id === s.id) ? prev.map(x => x.id === s.id ? s : x) : [...prev, s];
            safeSetItem('kw_sessions', JSON.stringify(next));
            return next;
          });
        } else if (payload.eventType === 'DELETE') {
          setActiveSessions(prev => {
            const next = prev.filter(x => x.id !== payload.old.id);
            safeSetItem('kw_sessions', JSON.stringify(next));
            return next;
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, payload => {
        if (payload.eventType === 'INSERT') {
          const t = {
            id: payload.new.id,
            no: payload.new.no || 0,
            nama: payload.new.nama,
            tanggal: payload.new.tanggal,
            startTime: payload.new.start_time || 0,
            endTime: payload.new.end_time || 0,
            items: payload.new.items,
            ot: payload.new.ot || '-',
            otDur: payload.new.ot_dur || '-',
            totalBase: payload.new.total_base || 0,
            totalOT: payload.new.total_ot || 0,
            totalTol: payload.new.total_tol || 0,
            grandTotal: payload.new.grand_total || 0,
            totalAll: payload.new.total_all || ((payload.new.total_base || 0) + (payload.new.grand_total || 0)),
            payAwal: payload.new.pay_awal || 'cash',
            cash: payload.new.cash || 0,
            qris: payload.new.qris || 0,
            shift: payload.new.shift || '-',
            _synced: true
          };
          setTransactions(prev => {
            const next = prev.some(x => x.id === t.id) ? prev.map(x => x.id === t.id ? t : x) : [...prev, t];
            next.sort((a, b) => (a.no || 0) - (b.no || 0));
            safeSetItem('kw_txns', JSON.stringify(next));
            return next;
          });

          // Hapus sesi aktif lokal jika transaksi dengan ID tersebut telah diselesaikan oleh terminal lain
          setActiveSessions(prev => {
            const next = prev.filter(x => x.id !== t.id);
            safeSetItem('kw_sessions', JSON.stringify(next));
            return next;
          });
        } else if (payload.eventType === 'UPDATE') {
          const t = {
            id: payload.new.id,
            no: payload.new.no || 0,
            nama: payload.new.nama,
            tanggal: payload.new.tanggal,
            startTime: payload.new.start_time || 0,
            endTime: payload.new.end_time || 0,
            items: payload.new.items,
            ot: payload.new.ot || '-',
            otDur: payload.new.ot_dur || '-',
            totalBase: payload.new.total_base || 0,
            totalOT: payload.new.total_ot || 0,
            totalTol: payload.new.total_tol || 0,
            grandTotal: payload.new.grand_total || 0,
            totalAll: payload.new.total_all || ((payload.new.total_base || 0) + (payload.new.grand_total || 0)),
            payAwal: payload.new.pay_awal || 'cash',
            cash: payload.new.cash || 0,
            qris: payload.new.qris || 0,
            shift: payload.new.shift || '-',
            _synced: true
          };
          setTransactions(prev => {
            const next = prev.some(x => x.id === t.id) ? prev.map(x => x.id === t.id ? t : x) : [...prev, t];
            const sorted = next.sort((a, b) => (a.no || 0) - (b.no || 0));
            safeSetItem('kw_txns', JSON.stringify(sorted));
            return sorted;
          });
        } else if (payload.eventType === 'DELETE') {
          setTransactions(prev => {
            const next = prev.filter(x => x.id !== payload.old.id);
            safeSetItem('kw_txns', JSON.stringify(next));
            return next;
          });
        }
      })
      .subscribe((status) => {
        setRealtimeStatus(status); // 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'
      });

    return () => {
      window.removeEventListener('hashchange', checkHash);
      window.removeEventListener('online', handleOnline);
      sb.removeChannel(sub);
    };
  }, []);

  const handleSyncPull = async () => {
    try {
      // Pull transactions
      const { data: txns, error: errT } = await sb.from('transactions').select('*').order('no', { ascending: true }).limit(5000);
      if (errT) throw errT;
      if (txns) {
        const ct = txns.map(row => ({
          id: row.id,
          no: row.no || 0,
          nama: row.nama,
          tanggal: row.tanggal,
          startTime: row.start_time || 0,
          endTime: row.end_time || 0,
          items: row.items,
          ot: row.ot || '-',
          otDur: row.ot_dur || '-',
          totalBase: row.total_base || 0,
          totalOT: row.total_ot || 0,
          totalTol: row.total_tol || 0,
          grandTotal: row.grand_total || 0,
          totalAll: row.total_all || ((row.total_base || 0) + (row.grand_total || 0)),
          payAwal: row.pay_awal || 'cash',
          cash: row.cash || 0,
          qris: row.qris || 0,
          shift: row.shift || '-',
          _synced: true
        }));

        setTransactions(prev => {
          const finalTxns = mergeSyncData(ct, prev).sort((a, b) => (a.no || 0) - (b.no || 0));
          safeSetItem('kw_txns', JSON.stringify(finalTxns));
          return finalTxns;
        });
      }

      // Pull active sessions
      const { data: sess, error: errS } = await sb.from('active_sessions').select('*');
      if (errS) throw errS;
      if (sess) {
        const cs = sess.map(row => ({
          id: row.id,
          nama: row.nama,
          items: row.items || [],
          startTime: row.start_time || Date.now(),
          tanggal: row.tanggal || '',
          payAwal: row.pay_awal || 'cash',
          queueNo: row.queue_no || 0,
          _synced: true
        }));

        // Merge offline-only active sessions and filter zombie sessions
        const currentTxns = JSON.parse(localStorage.getItem('kw_txns') || '[]');
        setActiveSessions(prev => {
          const rawMerged = mergeSyncData(cs, prev, (s) => !currentTxns.some(t => t.id === s.id));
          const finalSessions = cleanZombieSessions(rawMerged, currentTxns);
          safeSetItem('kw_sessions', JSON.stringify(finalSessions));
          return finalSessions;
        });
      }

      // Pull settings
      const { data: sett, error: errSet } = await sb.from('settings').select('*');
      if (errSet) throw errSet;
      if (sett) {
        sett.forEach(s => {
          if (s.key === 'adminPassword') {
            setAdminPassword(s.value);
            localStorage.setItem('kw_pass', s.value);
          }
          if (s.key === 'theme') {
            setTheme(s.value);
            localStorage.setItem('kw_theme', s.value);
            document.documentElement.setAttribute('data-theme', s.value);
          }
          if (s.key === 'printMulai') {
            setPrintMulai(s.value === 'true');
            localStorage.setItem('kw_printMulai', s.value);
          }
          if (s.key === 'printSelesai') {
            setPrintSelesai(s.value === 'true');
            localStorage.setItem('kw_printSelesai', s.value);
          }
        });
      }

      // Pull images
      const { data: imgs, error: errI } = await sb.from('item_images').select('*');
      if (errI) throw errI;
      if (imgs) {
        imgs.forEach(doc => {
          if (doc.code && doc.image_data) {
            localStorage.setItem('kw_img_' + doc.code, doc.image_data);
          }
        });
      }

      setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
      alert('Data ditarik dari cloud!');
    } catch (err) {
      console.error(err);
      alert('Gagal tarik data: ' + err.message);
    }
  };

  const handleSyncPush = async () => {
    if (!sbConnected) {
      alert('Tidak terhubung ke Supabase!');
      return;
    }
    try {
      if (transactions.length > 0) {
        const rows = transactions.map(t => ({
          id: t.id,
          no: t.no || 0,
          queue_no: t.queueNo || 0,
          nama: t.nama,
          tanggal: t.tanggal,
          start_time: t.startTime,
          end_time: t.endTime,
          items: t.items,
          ot: t.ot || '-',
          ot_dur: t.otDur || '-',
          total_base: t.totalBase || 0,
          total_ot: t.totalOT || 0,
          total_tol: t.totalTol || 0,
          grand_total: t.grandTotal || 0,
          total_all: t.totalAll || ((t.totalBase || 0) + (t.grandTotal || 0)),
          pay_awal: t.payAwal || 'cash',
          cash: t.cash || 0,
          qris: t.qris || 0,
          shift: t.shift || '-'
        }));
        await sb.from('transactions').upsert(rows);
        setTransactions(prev => {
          const next = prev.map(t => ({...t, _synced: true}));
          safeSetItem('kw_txns', JSON.stringify(next));
          return next;
        });
      }

      if (activeSessions.length > 0) {
        const rows = activeSessions.map(s => ({
          id: s.id,
          nama: s.nama,
          items: s.items,
          start_time: s.startTime,
          tanggal: s.tanggal,
          queue_no: s.queueNo || 0,
          pay_awal: s.payAwal || 'cash'
        }));
        await sb.from('active_sessions').upsert(rows);
        setActiveSessions(prev => {
          const next = prev.map(s => ({...s, _synced: true}));
          safeSetItem('kw_sessions', JSON.stringify(next));
          return next;
        });
      }

      await sb.from('settings').upsert([
        { key: 'adminPassword', value: adminPassword },
        { key: 'theme', value: theme },
        { key: 'printMulai', value: String(printMulai) },
        { key: 'printSelesai', value: String(printSelesai) }
      ]);

      const imgData = [];
      ITEMS.forEach(item => {
        const img = localStorage.getItem('kw_img_' + item.code);
        if (img) {
          imgData.push({ code: item.code, image_data: img });
        }
      });
      if (imgData.length > 0) {
        await sb.from('item_images').upsert(imgData);
      }

      setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
      alert('Data didorong ke cloud!');
    } catch (err) {
      console.error(err);
      alert('Gagal dorong data: ' + err.message);
    }
  };

  const handleUpdateItemImg = (code, url) => {
    localStorage.setItem('kw_img_' + code, url);
    setImageUpdateTrigger(prev => prev + 1);
    if (sbConnected) {
      sb.from('item_images').upsert({ code, image_data: url }).then(() => {
        console.log('Image synced to Supabase');
      });
    }
  };

  const handleResetItemImg = (code) => {
    localStorage.removeItem('kw_img_' + code);
    setImageUpdateTrigger(prev => prev + 1);
    if (sbConnected) {
      sb.from('item_images').delete().eq('code', code).then(() => {
        console.log('Image deleted from Supabase');
      });
    }
  };

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

  const handleStartSewa = (nama, items, payAwal) => {
    const today = todayStr();
    let maxQueue = 0;
    
    activeSessions.forEach(s => {
      if (s.tanggal === today && s.queueNo > maxQueue) maxQueue = s.queueNo;
    });
    transactions.forEach(t => {
      if (t.tanggal === today && t.queueNo > maxQueue) maxQueue = t.queueNo;
    });
    
    const newQueueNo = maxQueue + 1;
    setShiftQueueNo(newQueueNo);
    localStorage.setItem('kw_shiftQNo', newQueueNo);

    const session = {
      id: crypto.randomUUID(),
      nama,
      items,
      startTime: Date.now(),
      tanggal: today,   // Locked at start — survives midnight rollover
      payAwal,
      queueNo: newQueueNo
    };

    setActiveSessions(prev => {
      const updated = [...prev, session];
      safeSetItem('kw_sessions', JSON.stringify(updated));
      return updated;
    });

    if (printMulai) {
      handlePrintMulai(session);
    }

    if (sbConnected) {
      sb.from('active_sessions').upsert({
        id: session.id,
        nama: session.nama,
        items: session.items,
        start_time: session.startTime,
        tanggal: session.tanggal,
        pay_awal: session.payAwal,
        queue_no: session.queueNo
      }).then(({ error }) => {
        if (error) console.error('Supabase upsert session error:', error);
        else {
          console.log('Sewa saved to Supabase');
          setActiveSessions(prev => {
            const next = prev.map(x => x.id === session.id ? { ...x, _synced: true } : x);
            safeSetItem('kw_sessions', JSON.stringify(next));
            return next;
          });
        }
      });
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
        
        if (sbConnected) {
          sb.from('transactions').delete().eq('id', id).then(() => {
            console.log('Deleted from Supabase');
          });
        }
      }
      setPendingAction(null);
    }
  };

  const handleSaveEditedSession = (updatedSession) => {
    setActiveSessions(prev => {
      const updatedSessions = prev.map(s => s.id === updatedSession.id ? updatedSession : s);
      safeSetItem('kw_sessions', JSON.stringify(updatedSessions));
      return updatedSessions;
    });

    if (sbConnected) {
      sb.from('active_sessions')
        .update({
          nama: updatedSession.nama,
          items: updatedSession.items,
          pay_awal: updatedSession.payAwal
        })
        .eq('id', updatedSession.id)
        .then(() => {
          console.log('Updated active session in Supabase');
        });
    }

    setActiveEditSession(null);
    alert('Sesi diperbarui!');
  };

  const handleFinalizePayment = async (cash, qris) => {
    if (!activePaymentData) return;
    const { session, itemsCalc, base, ot, tol, grand, otStr, otDurStr, elapsed, endTime } = activePaymentData;
    
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

    // ── Atomic claim: prevent double-checkout race condition ──────────────
    // When online, atomically delete or update session in DB. If another terminal
    // already modified/deleted it (returned false), abort and show error.
    if (sbConnected) {
      try {
        const { data: claimed, error: claimErr } = await sb.rpc('claim_and_update_session', { 
          p_id: session.id,
          p_expected_items: session.items,
          p_new_items: remainingItems
        });
        if (claimErr) throw claimErr;
        if (!claimed) {
          alert('⚠️ Sesi ini sudah diselesaikan atau diubah oleh terminal lain.\nPembayaran dibatalkan.');
          setActivePaymentData(null);
          return;
        }
      } catch (e) {
        console.warn('claim_and_update_session failed, proceeding offline:', e);
        // Network error → fall through to local-only mode
      }
    }

    // ── Get collision-proof txn number from DB sequence ───────────────────
    let txnNo = transactions.length + 1;
    if (sbConnected) {
      try {
        const { data, error } = await sb.rpc('next_txn_no');
        if (!error && data) txnNo = data;
      } catch (e) {
        console.warn('next_txn_no RPC failed, using local count:', e);
      }
    }

    const txn = {
      id: remainingItems.length > 0 ? crypto.randomUUID() : session.id, // Keep session ID only on final return
      no: txnNo,
      queueNo: session.queueNo || 0,
      nama: session.nama,
      tanggal: session.tanggal || todayStr(), // Use start-day, fallback for old sessions
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

    // Update local state (use functional updates to prevent stale closure data loss)
    setTransactions(prev => {
      const newTxns = [...prev, txn];
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
      handlePrintSelesai(txn);
    }

    if (sbConnected) {
      // Session already deleted/updated by claim_and_update_session above — upsert txn to avoid duplicates/conflicts
      const rows = formatTxnForSupabase([txn]);
      sb.from('transactions').upsert(rows).then(({ error }) => {
        if (error) console.error('Supabase upsert txn error:', error);
        else {
          console.log('Transaction logged to Supabase, no:', txn.no);
          setTransactions(prev => {
            const next = prev.map(x => x.id === txn.id ? { ...x, _synced: true } : x);
            safeSetItem('kw_txns', JSON.stringify(next));
            return next;
          });
        }
      });
    } else {
      // Offline: session already updated/deleted locally — no DB action
      console.warn('Offline: transaction saved to localStorage only');
    }

    setActivePaymentData(null);
  };

  const todayStr = () => {
    const d = new Date();
    d.setHours(d.getHours() - 6); // Shift rollover at 6 AM
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleUpdateAdminPassword = (newPass) => {
    setAdminPassword(newPass);
    localStorage.setItem('kw_pass', newPass);
    if (sbConnected) {
      sb.from('settings').upsert({ key: 'adminPassword', value: newPass }).then(() => {
        console.log('Admin password saved to Supabase');
      });
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('kw_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    if (sbConnected) {
      sb.from('settings').upsert({ key: 'theme', value: newTheme }).then(() => {
        console.log('Theme setting saved to Supabase');
      });
    }
  };

  const handlePrintMulaiToggle = (val) => {
    setPrintMulai(val);
    localStorage.setItem('kw_printMulai', String(val));
    if (sbConnected) {
      sb.from('settings').upsert({ key: 'printMulai', value: String(val) }).then(() => {
        console.log('printMulai setting saved to Supabase');
      });
    }
  };

  const handlePrintSelesaiToggle = (val) => {
    setPrintSelesai(val);
    localStorage.setItem('kw_printSelesai', String(val));
    if (sbConnected) {
      sb.from('settings').upsert({ key: 'printSelesai', value: String(val) }).then(() => {
        console.log('printSelesai setting saved to Supabase');
      });
    }
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

              {/* Status Badge & Auto Push Refresh */}
              <div className="d-flex align-items-center gap-2">
                <div title={`Realtime: ${realtimeStatus}`} style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '.65rem', fontWeight: 700, letterSpacing: '.5px',
                  padding: '3px 6px', borderRadius: '4px', cursor: 'default',
                  background: realtimeStatus === 'SUBSCRIBED'
                    ? 'rgba(63,185,80,.15)' : realtimeStatus === 'CONNECTING'
                    ? 'rgba(227,179,65,.15)' : 'rgba(249,115,22,.15)',
                  color: realtimeStatus === 'SUBSCRIBED'
                    ? 'var(--green)' : realtimeStatus === 'CONNECTING'
                    ? 'var(--yellow)' : 'var(--orange)',
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', display: 'inline-block',
                    background: 'currentColor',
                    animation: realtimeStatus === 'SUBSCRIBED' ? 'none' : 'pulse 1.2s infinite',
                  }}/>
                  <span className="d-none d-sm-inline">
                    {realtimeStatus === 'SUBSCRIBED' ? 'LIVE' : realtimeStatus === 'CONNECTING' ? 'SYNC…' : 'OFFLINE'}
                  </span>
                </div>

                <button
                  className="bg-transparent border-0 text-secondary p-1 d-flex align-items-center justify-content-center"
                  title="Refresh & Auto Push Data ke Cloud"
                  onClick={() => {
                    handleSyncPull();
                    if (sbConnected) {
                      handleSyncPush();
                    }
                  }}
                  style={{ cursor: 'pointer', fontSize: '1.1rem', color: 'var(--cyan)' }}
                  aria-label="Refresh & Auto Push ke Cloud"
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
                  if (sbConnected) {
                    sb.from('transactions').delete().eq('id', id).then(() => {
                      console.log('Deleted transaction from Supabase');
                    });
                  }
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
            sbConnected={sbConnected}
            lastSyncTime={lastSyncTime}
            onSyncPull={handleSyncPull}
            onSyncPush={handleSyncPush}
            printMulai={printMulai}
            onChangePrintMulai={handlePrintMulaiToggle}
            printSelesai={printSelesai}
            onChangePrintSelesai={handlePrintSelesaiToggle}
            onUpdateItemImg={handleUpdateItemImg}
            onResetItemImg={handleResetItemImg}
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
