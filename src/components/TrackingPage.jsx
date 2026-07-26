import React, { useState, useEffect } from 'react';
import { sb } from '../supabase';
import { fmtDur, fmtRp } from '../App';
import { calcOTCost } from '../lib/ot';
import { ITEMS } from '../App';

function TrackingPage({ trackingId }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [txn, setTxn] = useState(null);
  const [error, setError] = useState('');
  
  // For live timer
  const [now, setNow] = useState(Date.now());
  const [retryCount, setRetryCount] = useState(0);

  const cleanId = (trackingId || '').split('?')[0].split('&')[0].replace(/\/+$/, '').trim();

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  useEffect(() => {
    if (!cleanId) {
      setError('ID sesi tidak valid.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchStatus = async (attempts = 3) => {
      setLoading(true);
      setError('');

      // 1. Cek langsung di localStorage (krusial saat offline atau jeda sinkronisasi cloud)
      try {
        const localSessions = JSON.parse(localStorage.getItem('kw_sessions') || '[]');
        const localSess = localSessions.find(s => s.id === cleanId);
        if (localSess && isMounted) {
          setSession({
            id: localSess.id,
            nama: localSess.nama,
            items: localSess.items || [],
            startTime: localSess.startTime || localSess.start_time,
            payAwal: localSess.payAwal || localSess.pay_awal || 'cash',
            queueNo: localSess.queueNo || localSess.queue_no || 0
          });
          setLoading(false);
          // Kita tetap cek ke cloud secara diam-diam di bawah jika memungkinkan, 
          // tapi karena data lokal sudah ada, kita langsung return
          return;
        }

        const localTxns = JSON.parse(localStorage.getItem('kw_txns') || '[]');
        const localTxn = localTxns.find(t => t.id === cleanId);
        if (localTxn && isMounted) {
          setTxn({
            ...localTxn,
            start_time: localTxn.start_time || localTxn.startTime,
            end_time: localTxn.end_time || localTxn.endTime,
            ot_dur: localTxn.ot_dur || localTxn.otDur || '-',
            total_ot: localTxn.total_ot !== undefined ? localTxn.total_ot : (localTxn.totalOT || 0),
            total_all: localTxn.total_all !== undefined ? localTxn.total_all : (localTxn.totalAll || 0),
            pay_awal: localTxn.pay_awal || localTxn.payAwal || 'cash',
            queue_no: localTxn.queue_no || localTxn.queueNo || 0
          });
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Gagal membaca localStorage tracking:', e);
      }

      // 2. Cek di Supabase dengan mekanisme auto-retry (mengatasi latensi sinkronisasi cloud)
      for (let i = 0; i < attempts; i++) {
        try {
          const { data: activeData, error: activeErr } = await sb
            .from('active_sessions')
            .select('*')
            .eq('id', cleanId)
            .maybeSingle();

          if (activeData && isMounted) {
            setSession({
              id: activeData.id,
              nama: activeData.nama,
              items: activeData.items || [],
              startTime: activeData.start_time || activeData.startTime,
              payAwal: activeData.pay_awal || activeData.payAwal || 'cash',
              queueNo: activeData.queue_no || activeData.queueNo || 0
            });
            setLoading(false);
            return;
          }

          const { data: txnData, error: txnErr } = await sb
            .from('transactions')
            .select('*')
            .eq('id', cleanId)
            .maybeSingle();

          if (txnData && isMounted) {
            setTxn({
              ...txnData,
              start_time: txnData.start_time || txnData.startTime,
              end_time: txnData.end_time || txnData.endTime,
              ot_dur: txnData.ot_dur || txnData.otDur || '-',
              total_ot: txnData.total_ot !== undefined ? txnData.total_ot : (txnData.totalOT || 0),
              total_all: txnData.total_all !== undefined ? txnData.total_all : (txnData.totalAll || 0),
              pay_awal: txnData.pay_awal || txnData.payAwal || 'cash',
              queue_no: txnData.queue_no || txnData.queueNo || 0
            });
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Tracking fetch attempt error:', err);
        }

        // Tunda 400 miliseconds sebelum mencoba lagi bila data belum muncul di cloud
        if (i < attempts - 1) {
          await new Promise(res => setTimeout(res, 400));
        }
      }

      if (isMounted) {
        setError('Sesi tidak ditemukan atau sudah dihapus.');
        setLoading(false);
      }
    };

    fetchStatus(3);
    return () => { isMounted = false; };
  }, [cleanId, retryCount]);

  // Live timer tick
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div className="spinner-border text-info" role="status" style={{ color: 'var(--cyan)' }}>
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center p-4 text-center" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
        <i className="bi bi-exclamation-triangle-fill mb-3" style={{ fontSize: '3rem', color: 'var(--red)' }}></i>
        <h4 className="mb-2">Oops!</h4>
        <p className="mb-4" style={{ color: 'var(--text2)' }}>{error}</p>
        <button className="btn btn-sm text-white px-4 py-2" style={{ background: 'var(--primary)', borderRadius: '6px', border: 'none', fontWeight: 600 }} onClick={handleRetry}>
          <i className="bi bi-arrow-repeat me-2"></i>Coba Lagi / Refresh
        </button>
      </div>
    );
  }

  // --- Render Finished Transaction ---
  if (txn) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '20px' }}>
        <div className="card mx-auto" style={{ maxWidth: '400px', background: 'var(--bg2)', borderColor: 'var(--border)' }}>
          <div className="card-header text-center py-3" style={{ background: 'var(--green)', color: '#fff', borderColor: 'var(--border)' }}>
            <i className="bi bi-check-circle-fill d-block mb-2" style={{ fontSize: '2.5rem' }}></i>
            <h5 className="mb-0">Sewa Selesai</h5>
          </div>
          <div className="card-body p-4">
            <div className="text-center mb-4">
              <h3 className="mb-1">{txn.nama}</h3>
              <span className="badge" style={{ background: 'var(--bg4)', color: 'var(--text)' }}>Txn: #{txn.no}</span>
            </div>
            
            <div className="d-flex justify-content-between mb-2">
              <span style={{ color: 'var(--text2)' }}>Tanggal</span>
              <span>{txn.tanggal}</span>
            </div>
            <div className="d-flex justify-content-between mb-2">
              <span style={{ color: 'var(--text2)' }}>Waktu</span>
              <span>
                {new Date(txn.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - 
                {new Date(txn.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="d-flex justify-content-between mb-3">
              <span style={{ color: 'var(--text2)' }}>Item</span>
              <span className="text-end" style={{ maxWidth: '60%' }}>{txn.items}</span>
            </div>
            
            <hr style={{ borderColor: 'var(--border)', opacity: 1 }} />
            
            <div className="d-flex justify-content-between mb-2">
              <span style={{ color: 'var(--text2)' }}>Overtime</span>
              <span style={{ color: txn.ot_dur === '-' ? 'var(--text)' : 'var(--orange)' }}>{txn.ot_dur}</span>
            </div>
            <div className="d-flex justify-content-between mb-2">
              <span style={{ color: 'var(--text2)' }}>Denda OT</span>
              <span>{fmtRp(txn.total_ot)}</span>
            </div>
            
            <hr style={{ borderColor: 'var(--border)', opacity: 1 }} />
            
            <div className="d-flex justify-content-between fw-bold fs-5">
              <span>Total Akhir</span>
              <span style={{ color: 'var(--cyan)' }}>{fmtRp(txn.total_all)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Render Active Session ---
  const elapsedSec = Math.floor((now - session.startTime) / 1000);
  const elapsedMin = elapsedSec / 60;
  
  // Calculate OT status
  let isOvertime = false;
  let estimatedOT = 0;
  
  session.items.forEach(it => {
    const def = ITEMS.find(item => item.code === it.code);
    if (!def) return;
    const limitMin = def.isPackage ? def.packageHours * 60 : 60;
    const otCost = calcOTCost(elapsedMin, limitMin, def, it.qty);
    if (otCost > 0) {
      isOvertime = true;
      estimatedOT += otCost;
    }
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '20px' }}>
      <div className="card mx-auto" style={{ maxWidth: '400px', background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        
        <div className="card-header text-center py-3" style={{ background: isOvertime ? 'var(--red)' : 'var(--primary)', color: '#fff', borderColor: 'var(--border)' }}>
          <i className={`bi ${isOvertime ? 'bi-alarm-fill' : 'bi-stopwatch'} d-block mb-2`} style={{ fontSize: '2.5rem' }}></i>
          <h5 className="mb-0">{isOvertime ? 'Waktu Habis (Overtime)' : 'Sewa Sedang Berjalan'}</h5>
        </div>
        
        <div className="card-body p-4 text-center">
          <h2 className="mb-1" style={{ color: 'var(--cyan)' }}>{session.nama}</h2>
          <div className="mb-4 small" style={{ color: 'var(--text2)' }}>
            Mulai: {new Date(session.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </div>
          
          <div className="timer-display mb-4 p-3 rounded" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
            <div className="mb-1 small" style={{ color: 'var(--text2)' }}>Waktu Berjalan</div>
            <div className="display-3 fw-bold font-monospace" style={{ color: isOvertime ? 'var(--orange)' : 'var(--green)', letterSpacing: '-2px' }}>
              {fmtDur(elapsedSec)}
            </div>
          </div>
          
          <div className="text-start mb-4">
            <div className="small mb-2 pb-1" style={{ color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>Item yang Disewa</div>
            {session.items.map((it, idx) => {
              const def = ITEMS.find(item => item.code === it.code);
              return (
                <div key={idx} className="d-flex justify-content-between align-items-center mb-2">
                  <span>{def ? def.emoji : ''} {def ? def.name : it.code}</span>
                  <span className="badge rounded-pill" style={{ background: 'var(--bg4)', color: 'var(--text)' }}>x{it.qty}</span>
                </div>
              );
            })}
          </div>
          
          {isOvertime && (
            <div className="alert text-start py-2 px-3 mb-0" style={{ background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)', border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)' }}>
              <div className="d-flex justify-content-between align-items-center fw-bold">
                <span><i className="bi bi-exclamation-triangle-fill me-2"></i>Estimasi Denda:</span>
                <span>{fmtRp(estimatedOT)}</span>
              </div>
            </div>
          )}
          
        </div>
      </div>
      
      <div className="text-center mt-4 small" style={{ color: 'var(--text2)' }}>
        &copy; {new Date().getFullYear()} Evren House
      </div>
    </div>
  );
}

export default TrackingPage;
