import React, { useState, useEffect } from 'react';
import { ITEMS, fmtRp, fmtDur } from '../App';
import { calcOT } from '../lib/ot';

function CalculateRentalModal({ session, onClose, onProceedPayment, currentUserRole }) {
  const isAdmin = currentUserRole === 'admin';
  // Guard: if startTime is 0 / epoch 1970 (backend NaN bug), default to now
  // Only clamp if before year 2020 — old-but-valid sessions are still valid
  const safeStart = (session.startTime && session.startTime > 1577836800000)
    ? session.startTime
    : Date.now();
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - safeStart) / 1000));
  const [elapsedMin, setElapsedMin] = useState(() => Math.floor((Date.now() - safeStart) / 1000) / 60);
  const [itemsCalc, setItemsCalc] = useState([]);

  useEffect(() => {
    const safeStart = (session.startTime && session.startTime > 1577836800000)
      ? session.startTime
      : Date.now();
    const el = Math.floor((Date.now() - safeStart) / 1000);
    const elMin = el / 60;
    setElapsed(el);
    setElapsedMin(elMin);

    const initial = (Array.isArray(session?.items) ? session.items : []).map(it => {
      if (!it) return null;
      const def = ITEMS.find(item => item.code === it.code) || { priceHour: 0, priceOT30: 0, priceOT60: 0 };
      const limitMin = def && def.isPackage ? def.packageHours * 60 : 60;
      
      const price60 = def.priceOT60 || def.priceOT50 || def.priceHour || 0;
      const price30 = def.priceOT30 || 0;
      const { otFull, otHalf } = calcOT(elMin, limitMin);
      const otCost = (otFull * price60 + otHalf * price30) * (it.qty || 1);

      return {
        ...it,
        def,
        limitMin,
        returnQty: it.qty || 1,
        baseCost: (def.priceHour || 0) * (it.qty || 1),
        otFullCount: otFull,
        otHalfCount: otHalf,
        otCost: otCost
      };
    }).filter(Boolean);
    setItemsCalc(initial);
  }, [session]);

  const handleReturnQtyChange = (idx, delta) => {
    setItemsCalc(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const newReturnQty = Math.max(0, Math.min(it.qty || 1, (it.returnQty || 1) + delta));
      const price60 = it.def?.priceOT60 || it.def?.priceOT50 || it.def?.priceHour || 0;
      const price30 = it.def?.priceOT30 || 0;
      const baseCost = (it.def?.priceHour || 0) * newReturnQty;
      const otCost = (it.otFullCount * price60 + it.otHalfCount * price30) * newReturnQty;
      return {
        ...it,
        returnQty: newReturnQty,
        baseCost,
        otCost
      };
    }));
  };

  const baseSum = itemsCalc.reduce((sum, it) => sum + it.baseCost, 0);
  const otSum = itemsCalc.reduce((sum, it) => sum + it.otCost, 0);
  const grandOT = Math.max(0, otSum);

  const isOT = itemsCalc.some(it => it.returnQty > 0 && Math.floor(elapsedMin - it.limitMin) >= 11);
  const maxOver = Math.max(...itemsCalc.map(it => {
    const o = elapsedMin - it.limitMin;
    return it.returnQty > 0 && Math.floor(o) >= 11 ? o : 0;
  }));

  const isMultiItem = session.items.length > 1 || session.items.some(i => i.qty > 1);
  const totalReturnQty = itemsCalc.reduce((sum, it) => sum + it.returnQty, 0);
  const canProceed = totalReturnQty > 0;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleProceed = () => {
    if (isSubmitting || !canProceed) return;
    setIsSubmitting(true);
    const otStr = itemsCalc
      .filter(it => it.returnQty > 0 && (it.otFullCount > 0 || it.otHalfCount > 0))
      .map(it => `${it.code}(${it.otFullCount > 0 ? it.otFullCount + '×1j' : ''}${it.otHalfCount > 0 ? (it.otFullCount > 0 ? '+' : '') + it.otHalfCount + '×½j' : ''})`)
      .join(', ');
    
    const otDurStr = itemsCalc
      .filter(it => it.returnQty > 0 && (it.otFullCount > 0 || it.otHalfCount > 0))
      .map(it => `${it.code}:${it.otFullCount * 60 + it.otHalfCount * 30}m`)
      .join(', ');

    const calculatedData = {
      session,
      itemsCalc,
      base: baseSum,
      ot: otSum,
      tol: 0,
      grand: grandOT,
      otStr: otStr || '-',
      otDurStr: otDurStr || '-',
      elapsed,
      endTime: Date.now()
    };
    onProceedPayment(calculatedData);
  };

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content cmodal">
          <div className="modal-header cmodal-head">
            <h5 className="modal-title"><i className="bi bi-calculator-fill me-2 clr-yellow"></i>Hitung Sewa</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-0">
            <div className="hitung-wrap" style={{ padding: '20px' }}>
              <div className="info-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
                <div className="info-box"><div className="lbl">Nama</div><div className="val name">{session.nama}</div></div>
                <div className="info-box"><div className="lbl">Mulai Sewa</div><div className="val">{new Date(session.startTime).toTimeString().slice(0,5)}</div></div>
                <div className="info-box"><div className="lbl">Sekarang</div><div className="val">{new Date().toTimeString().slice(0,5)}</div></div>
              </div>
              
              <div className="pokok-lunas-box mb-3">
                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                  <i className="bi bi-check-circle-fill clr-green"></i>
                  <span style={{ fontWeight: 800, color: 'var(--green)' }}>Tarif Sewa Pokok — Sudah Dibayar</span>
                  <span className="ms-auto" style={{ fontWeight: 800 }}>{fmtRp(baseSum)}</span>
                </div>
              </div>

              {isOT ? (
                <div className="ot-alert mb-3">
                  <i className="bi bi-exclamation-triangle-fill clr-orange me-1"></i>
                  Ada item melewati batas! ({Math.floor(maxOver)} menit overtime)
                </div>
              ) : (
                <div className="ot-alert mb-3" style={{ background: 'rgba(63,185,80,.1)', borderColor: 'var(--green)' }}>
                  <i className="bi bi-check-circle-fill clr-green me-1"></i>
                  Durasi dalam batas normal.
                </div>
              )}

              <div className="ot-section-title"><i className="bi bi-lightning-charge-fill clr-orange me-1"></i><span>Biaya Overtime</span></div>
              
              <div className="mb-3">
                {itemsCalc.map((it, idx) => {
                  const overMin = elapsedMin - it.limitMin;
                  const isReturned = it.returnQty > 0;
                  const otLabel = [];
                  if (it.otFullCount > 0) otLabel.push(`${it.otFullCount}× 1Jam (${fmtRp(it.def.priceOT60 * it.returnQty * it.otFullCount)})`);
                  if (it.otHalfCount > 0) otLabel.push(`${it.otHalfCount}× ½Jam (${fmtRp(it.def.priceOT30 * it.returnQty * it.otHalfCount)})`);
                  
                  let overStatus = '';
                  if (overMin <= 0) overStatus = 'Normal';
                  else if (Math.floor(overMin) < 11) overStatus = `Over ${Math.floor(overMin)}m — toleransi`;
                  else overStatus = `Over ${Math.floor(overMin)}m`;

                  return (
                    <div className={`breakdown-item ${!isReturned ? 'opacity-75' : ''}`} key={it.code}>
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div className="flex-fill">
                          <div className="bi-name">{it.code} - {it.def.name} ×{it.qty}</div>
                          <div className="small text-secondary mb-1">{overStatus}</div>
                          
                          {isMultiItem && (
                            <div className="d-flex align-items-center gap-2 mt-1 mb-2 p-1 px-2 rounded" style={{ background: 'var(--bg-sec)', width: 'fit-content' }}>
                              <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>Kembalikan:</span>
                              <button className="ot-count-btn" onClick={() => handleReturnQtyChange(idx, -1)}>−</button>
                              <span className="fw-bold" style={{ minWidth: '15px', textAlign: 'center', fontSize: '0.8rem' }}>{it.returnQty}</span>
                              <button className="ot-count-btn" onClick={() => handleReturnQtyChange(idx, 1)}>+</button>
                              <span className="small text-secondary" style={{ fontSize: '0.72rem' }}>/ {it.qty}</span>
                            </div>
                          )}

                          {!isReturned ? (
                            <span className="badge bg-secondary mt-1" style={{ fontSize: '0.65rem' }}>TETAP DISEWA (Belum Dikembalikan)</span>
                          ) : (
                            <div className="ot-auto-detail">
                              {otLabel.length > 0 ? otLabel.join(' + ') : 'Tidak ada overtime'}
                            </div>
                          )}
                        </div>
                        <div className="text-end">
                          {!isReturned ? (
                            <span className="text-secondary small">—</span>
                          ) : (
                            <span className="bi-price">{fmtRp(it.otCost)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isMultiItem && (
                <div className="mb-3 p-2 rounded border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.1)' }}>
                  <div className="small text-secondary mb-1" style={{ fontSize: '0.75rem' }}><i className="bi bi-info-circle-fill me-1 text-info"></i>Status Sisa Sewa Aktif (Akan Terus Berjalan):</div>
                  <div className="d-flex gap-2 flex-wrap mt-1">
                    {itemsCalc.map(it => {
                      const rem = it.qty - it.returnQty;
                      if (rem <= 0) return null;
                      return (
                        <span key={it.code} className="badge bg-dark border text-warning" style={{ borderColor: 'rgba(249,115,22,.3)', fontSize: '0.72rem' }}>
                          {it.code} ×{rem}
                        </span>
                      );
                    })}
                    {itemsCalc.every(it => it.qty - it.returnQty === 0) && (
                      <span className="text-success small" style={{ fontSize: '0.72rem' }}><i className="bi bi-check-circle-fill me-1"></i>Semua item dikembalikan (Sesi akan ditutup)</span>
                    )}
                  </div>
                </div>
              )}

              <div className="grand-total-box mt-3">
                <div className="gt-label">Total Tagihan Overtime</div>
                <div className="gt-val">{fmtRp(grandOT)}</div>
              </div>

              <div className="total-all-box mt-2">
                <div className="total-all-label">Total Biaya Keseluruhan</div>
                <div className="total-all-val">{fmtRp(baseSum + grandOT)}</div>
              </div>

              <div className="d-flex gap-2 mt-4">
                <button className="btn-sec flex-fill" onClick={onClose}>Batal</button>
                <button className="btn-start flex-fill" onClick={handleProceed} disabled={!canProceed || isSubmitting} style={{ opacity: canProceed && !isSubmitting ? 1 : 0.5, cursor: canProceed && !isSubmitting ? 'pointer' : 'not-allowed' }}>
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-credit-card-fill me-2"></i>Lanjut ke Pembayaran
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CalculateRentalModal;
