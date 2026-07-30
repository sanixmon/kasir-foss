import React from 'react';
import { ITEMS } from '../lib/items';
import { fmtRp } from '../lib/utils';
import { getShiftDate } from '../lib/shift';

function SettingsAnalytics({ transactions, activeSessions, currentShiftUser }) {
  const todayShift = getShiftDate();

  const todayTxns = transactions.filter(t => {
    if (!t.endTime) return false;
    return getShiftDate(t.endTime) === todayShift;
  });

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

  const itemStats = ITEMS.map(item => {
    let rentalCount = 0;
    let revenueSum = 0;
    todayTxns.forEach(t => {
      const tsItems = Array.isArray(t.items) ? t.items : [];
      const match = tsItems.find(i => i.code === item.code);
      if (match) {
        rentalCount += Number(match.qty || 1);
        revenueSum += ((t.totalBase || 0) / tsItems.reduce((s, x) => s + x.qty, 0)) * match.qty;
      }
    });
    return { ...item, rentalCount, revenueSum };
  }).sort((a, b) => b.revenueSum - a.revenueSum);

  const totalUnitsRented = itemStats.reduce((s, i) => s + i.rentalCount, 0);

  return (
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
          <div className="row g-3 mb-3">
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="p-3 rounded-3 border" style={{ background: 'var(--bg3)' }}>
                <div className="text-secondary small font-monospace mb-1">TOTAL OMZET SHIFT INI</div>
                <div className="fs-3 fw-extrabold mb-1" style={{ color: 'var(--text)' }}>{fmtRp(todayRevenue)}</div>
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
                <div className="small text-secondary">Petugas Shift: <b style={{ color: 'var(--text)' }}>{currentShiftUser || '-'}</b></div>
              </div>
            </div>
          </div>
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
                        <div className="fw-bold small" style={{ color: 'var(--text)' }}>{item.code} - {item.name}</div>
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
  );
}

export default SettingsAnalytics;
