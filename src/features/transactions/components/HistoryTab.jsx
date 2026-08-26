import React, { useState, useMemo } from 'react';
import { fmtRp } from '../../../lib/utils';
import { aggregateHistory } from '../../../lib/history';
import { swalWarning } from '../../../lib/swal';
import { getShiftDate } from '../../../lib/shift';

const SHIFT_CODE_MAP = { 
  'Akbar':'AK', 'Rani':'RN', 'Monica':'MO', 'Aldy':'AL', 
  'Wahyu':'WH', 'Donny':'DN', 'Zumi':'ZM', 'Awang':'AW' 
};

function shiftCode(n) { 
  if (!n || n === '-') return '-'; 
  if (SHIFT_CODE_MAP[n]) return SHIFT_CODE_MAP[n]; 
  const k = Object.keys(SHIFT_CODE_MAP).find(x => x.toLowerCase() === n.toLowerCase()); 
  return k ? SHIFT_CODE_MAP[k] : n.slice(0,2).toUpperCase(); 
}

const dateStr = ts => { 
  const d = new Date(ts); 
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`; 
};

const formatItemsCell = (items) => {
  if (!items) return '-';
  if (typeof items === 'string') return items;
  if (Array.isArray(items)) {
    return items.map(it => typeof it === 'object' ? `${it.code || ''}×${it.qty || 1}` : String(it)).join(', ');
  }
  return String(items);
};

const formatTimeStr = (val) => {
  if (!val) return '-';
  if (typeof val === 'string' && val.indexOf(':') !== -1) return val.slice(0, 5);
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toTimeString().slice(0, 5);
};

function HistoryTab({
  transactions = [],
  onPrintTxn,
  onDeleteTxn,
  onClearHistory,
  currentUserRole,
  outlets = [],
  selectedOutletFilter,
  onSelectOutletFilter
}) {
  const isCashier = currentUserRole === 'cashier';
  const [filterMode, setFilterMode] = useState('daily');
  const [filterDate, setFilterDate] = useState(() => getShiftDate());
  const [filterMonth, setFilterMonth] = useState(() => getShiftDate().slice(0, 7));
  const [filterYear, setFilterYear] = useState(() => getShiftDate().slice(0, 4));
  const [sortOrder, setSortOrder] = useState('desc');
  const [localOutletFilter, setLocalOutletFilter] = useState('all');

  const effectiveOutletFilter = selectedOutletFilter !== undefined ? selectedOutletFilter : localOutletFilter;
  const handleOutletFilterChange = (val) => {
    setLocalOutletFilter(val);
    if (typeof onSelectOutletFilter === 'function') {
      onSelectOutletFilter(val);
    }
  };

  const effectiveMode = isCashier ? 'daily' : filterMode;
  const filterValue = isCashier ? getShiftDate() : (filterMode === 'daily' ? filterDate : filterMode === 'monthly' ? filterMonth : filterYear);

  // Scoped transactions based on admin outlet filter
  const scopedTransactions = useMemo(() => {
    if (isCashier || !effectiveOutletFilter || effectiveOutletFilter === 'all') {
      return transactions;
    }
    return transactions.filter(t => (t.outletId || 'outlet-pusat') === effectiveOutletFilter);
  }, [transactions, isCashier, effectiveOutletFilter]);

  const {
    filtered, totalPokok, totalPokokCash, totalPokokQris, 
    totalTambahan, totalOTCash, totalOTQris, 
    totalCashAll, totalQrisAll, grandTotal
  } = aggregateHistory(scopedTransactions, effectiveMode, filterValue, sortOrder);

  // Revenue breakdown per outlet when admin selects "Semua Outlet"
  const outletBreakdown = useMemo(() => {
    if (isCashier || effectiveOutletFilter !== 'all') return [];
    const map = {};
    (filtered || []).forEach(t => {
      const oId = t.outletId || 'outlet-pusat';
      if (!map[oId]) {
        map[oId] = { outletId: oId, count: 0, total: 0 };
      }
      map[oId].count += 1;
      map[oId].total += Number(t.totalAll || ((t.totalBase || 0) + (t.grandTotal || 0))) || 0;
    });
    return Object.values(map);
  }, [filtered, isCashier, effectiveOutletFilter]);

  const handleExport = () => {
    if (filtered.length === 0) {
      swalWarning('Data Kosong', 'Tidak ada data untuk diexport');
      return;
    }
    if (!window.XLSX || !window.XLSX.utils) {
      swalWarning('Library Belum Dimuat', 'Library Excel (XLSX) belum dimuat. Mohon muat ulang halaman.');
      return;
    }
    const dataRows = filtered.map(t => ({
      No: t.no, 
      Nama: t.nama, 
      Outlet: t.outletId || 'outlet-pusat',
      Shift: t.shift, 
      Tanggal: t.tanggal || dateStr(t.startTime),
      Mulai: formatTimeStr(t.startTime),
      Selesai: formatTimeStr(t.endTime),
      Items: formatItemsCell(t.items), 
      OT: t.ot, 
      'Durasi OT': t.otDur,
      Pokok: t.totalBase, 
      'OT Cost': t.totalOT, 
      Toleransi: t.totalTol,
      'Grand Total': t.totalAll, 
      'Metode Pokok': t.payAwal, 
      'Bayar Cash': t.cash, 
      'Bayar QRIS': t.qris
    }));
    const ws = window.XLSX.utils.json_to_sheet(dataRows);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
    window.XLSX.writeFile(wb, `EvrenHouse_History_${filterValue}.xlsx`);
  };

  return (
    <div id="tab-riwayat" className="tab-pane active">
      <div className="panel">
        <div className="panel-head flex-wrap gap-2 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-clock-history clr-green fs-5"></i>
            <span className="fw-bold">Riwayat Transaksi</span>
          </div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            {isCashier ? (
              <div className="badge-shift bg-transparent border border-secondary text-secondary d-flex align-items-center gap-2 px-3 py-1 rounded-3 font-monospace" style={{ fontSize: '0.85rem' }}>
                <i className="bi bi-calendar2-check clr-cyan fs-6"></i>
                <span className="fw-bold" style={{ color: 'var(--text)' }}>Hari Ini ({getShiftDate()})</span>
                <span className="badge bg-secondary opacity-75 ms-1">Mode Kasir</span>
              </div>
            ) : (
              <>
                <select
                  className="cfield-sm font-monospace"
                  value={effectiveOutletFilter}
                  onChange={e => handleOutletFilterChange(e.target.value)}
                  aria-label="Filter Outlet"
                >
                  <option value="all">Semua Outlet</option>
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>{o.nama || o.name || o.id}</option>
                  ))}
                </select>

                <select className="cfield-sm" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
                  <option value="daily">Harian</option>
                  <option value="monthly">Bulanan</option>
                  <option value="yearly">Tahunan</option>
                </select>
                {filterMode === 'daily' && <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="cfield-sm font-monospace" />}
                {filterMode === 'monthly' && <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="cfield-sm font-monospace" />}
                {filterMode === 'yearly' && <input type="number" min="2024" max="2099" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="cfield-sm font-monospace" style={{width:'80px'}} />}
              </>
            )}
            
            <div className="d-flex align-items-center gap-1 ms-1">
              <i className="bi bi-sort-down-alt clr-cyan" title="Urutkan menurut waktu close bill" style={{ fontSize: '1.1rem' }}></i>
              <select 
                className="cfield-sm" 
                value={sortOrder} 
                onChange={e => setSortOrder(e.target.value)}
                aria-label="Urutkan Waktu Close Bill"
              >
                <option value="desc">Close: Terbaru (Desc)</option>
                <option value="asc">Close: Terlama (Asc)</option>
              </select>
            </div>

            {!isCashier && (
              <div className="d-flex gap-1 align-items-center">
                <button className="btn-export ms-1" onClick={handleExport}>
                  <i className="bi bi-download me-1"></i>Export
                </button>
                {onClearHistory && (
                  <button className="btn btn-sm btn-outline-danger ms-1" onClick={onClearHistory} title="Bersihkan Semua Riwayat">
                    <i className="bi bi-trash-fill me-1"></i>Bersihkan Riwayat
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="panel-body">
          {/* Summary Metric Cards */}
          <div className="row g-2 mb-3">
            <div className="col-12 col-md-4 col-xl-2">
              <div className="sum-card">
                <div className="sum-label">Transaksi</div>
                <div className="sum-val font-monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>{filtered.length}</div>
              </div>
            </div>
            <div className="col-12 col-md-4 col-xl-2">
              <div className="sum-card">
                <div className="sum-label">Total Pokok</div>
                <div className="sum-val font-monospace" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtRp(totalPokok)}</div>
                <div className="sum-pokok-breakdown d-flex justify-content-between small text-secondary px-1 font-monospace" style={{ fontSize: '0.65rem', fontVariantNumeric: 'tabular-nums' }}>
                  <span className="sum-pokok-item text-secondary" style={{ background: 'transparent', border: 'none', padding: 0 }}>C: {fmtRp(totalPokokCash)}</span>
                  <span className="sum-pokok-item text-secondary" style={{ background: 'transparent', border: 'none', padding: 0 }}>Q: {fmtRp(totalPokokQris)}</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4 col-xl-2">
              <div className="sum-card">
                <div className="sum-label">Total Tambahan</div>
                <div className="sum-val font-monospace" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtRp(totalTambahan)}</div>
                <div className="sum-pokok-breakdown d-flex justify-content-between small text-secondary px-1 font-monospace" style={{ fontSize: '0.65rem', fontVariantNumeric: 'tabular-nums' }}>
                  <span className="sum-pokok-item text-secondary" style={{ background: 'transparent', border: 'none', padding: 0 }}>C: {fmtRp(totalOTCash)}</span>
                  <span className="sum-pokok-item text-secondary" style={{ background: 'transparent', border: 'none', padding: 0 }}>Q: {fmtRp(totalOTQris)}</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4 col-xl-2">
              <div className="sum-card">
                <div className="sum-label">Total Cash</div>
                <div className="sum-val font-monospace" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtRp(totalCashAll)}</div>
              </div>
            </div>
            <div className="col-12 col-md-4 col-xl-2">
              <div className="sum-card">
                <div className="sum-label">Total QRIS</div>
                <div className="sum-val font-monospace" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmtRp(totalQrisAll)}</div>
              </div>
            </div>
            <div className="col-12 col-md-4 col-xl-2">
              <div className="sum-card" style={{ borderColor: 'var(--cyan)', background: 'rgba(88,166,255,0.05)' }}>
                <div className="sum-label clr-cyan">Grand Total</div>
                <div className="sum-val clr-cyan font-monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtRp(grandTotal)}</div>
              </div>
            </div>
          </div>

          {/* Revenue Breakdown per Outlet (Admin Mode) */}
          {outletBreakdown.length > 0 && (
            <div className="mb-3 p-2 rounded-3 border border-secondary bg-dark d-flex gap-2 flex-wrap align-items-center">
              <span className="small text-secondary fw-bold"><i className="bi bi-diagram-3-fill me-1 text-info"></i>Breakdown Pendapatan per Outlet:</span>
              {outletBreakdown.map(b => {
                const outletObj = outlets.find(o => o.id === b.outletId);
                const outletName = outletObj ? (outletObj.nama || outletObj.name) : b.outletId;
                return (
                  <div key={b.outletId} className="badge bg-secondary bg-opacity-25 border border-secondary text-light px-2 py-1 d-flex gap-2 align-items-center">
                    <span className="fw-bold text-info">{outletName}:</span>
                    <span className="font-monospace text-warning" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtRp(b.total)}</span>
                    <span className="text-secondary small">({b.count} txn)</span>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Transactions Table with Clean Typography & Tabular Numbers */}
          <div className="table-responsive">
            <table className="ctable">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>No</th>
                  {!isCashier && effectiveOutletFilter === 'all' && <th>Outlet</th>}
                  <th>Nama</th>
                  <th>Shift</th>
                  <th>Tgl</th>
                  <th style={{ whiteSpace: 'nowrap' }}>Waktu (Close)</th>
                  <th>Item</th>
                  <th>Tambahan</th>
                  <th>Dur OT</th>
                  <th className="th-pokok-cash"><i className="bi bi-cash-stack me-1"></i>Pokok (C)</th>
                  <th className="th-pokok-qris"><i className="bi bi-qr-code-scan me-1"></i>Pokok (QR)</th>
                  <th style={{ color: 'var(--green)' }}>Tambahan (C)</th>
                  <th style={{ color: 'var(--cyan)' }}>Tambahan (QR)</th>
                  <th style={{ color: 'var(--green)' }}>Total Cash</th>
                  <th style={{ color: 'var(--cyan)' }}>Total QRIS</th>
                  <th>Grand Total</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={!isCashier && effectiveOutletFilter === 'all' ? 17 : 16}>
                      <div className="empty-box py-5 text-center text-secondary">
                        <i className="bi bi-receipt" style={{ fontSize: '3rem', opacity: 0.4 }}></i>
                        <p className="mt-2 mb-0 small">Tidak ada transaksi di periode tanggal ini</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((t, idx) => {
                    const isCash = (t.payAwal || 'cash') === 'cash';
                    const isQris = (t.payAwal || 'cash') === 'qris';
                    const pokokCash = isCash ? (t.totalBase || 0) : 0;
                    const pokokQris = isQris ? (t.totalBase || 0) : 0;

                    const otEmpty    = !t.ot || t.ot === '-';
                    const otDurEmpty = !t.otDur || t.otDur === '-';
                    const cashExtra  = (t.cash || 0) > 0;
                    const qrisExtra  = (t.qris || 0) > 0;

                    return (
                      <tr key={t.id}>
                        <td data-label="No" className="font-monospace text-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</td>
                        {!isCashier && effectiveOutletFilter === 'all' && (
                          <td data-label="Outlet">
                            <span className="badge bg-secondary bg-opacity-50 text-white font-monospace" style={{ fontSize: '0.72rem' }}>
                              {t.outletId || 'outlet-pusat'}
                            </span>
                          </td>
                        )}
                        <td data-label="Nama"><strong style={{ color: 'var(--text)' }}>{t.nama}</strong></td>
                        <td data-label="Shift"><span className="badge-shift">{shiftCode(t.shift)}</span></td>
                        <td data-label="Tgl" className="font-monospace small" style={{ fontVariantNumeric: 'tabular-nums' }}>{t.tanggal || dateStr(t.startTime)}</td>
                        <td data-label="Waktu" className="font-monospace" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums' }}>
                          <span>{formatTimeStr(t.startTime)}</span> <i className="bi bi-arrow-right text-secondary mx-1"></i> <strong className="clr-cyan" title="Waktu Close Bill">{formatTimeStr(t.endTime)}</strong>
                        </td>
                        <td data-label="Item" style={{ fontSize: '0.78rem' }}>{formatItemsCell(t.items)}</td>
                        <td data-label="OT" data-empty={otEmpty || undefined} style={{ fontSize: '0.78rem' }}>{t.ot || '-'}</td>
                        <td data-label="Dur OT" data-empty={otDurEmpty || undefined} className="font-monospace" style={{ fontSize: '0.75rem', color: 'var(--orange)', fontVariantNumeric: 'tabular-nums' }}>{t.otDur || '-'}</td>
                        <td data-label="Pokok (C)" data-empty={!isCash || undefined} className="font-monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {isCash ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>{fmtRp(t.totalBase || 0)}</span> : '—'}
                        </td>
                        <td data-label="Pokok (QR)" data-empty={!isQris || undefined} className="font-monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {isQris ? <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{fmtRp(t.totalBase || 0)}</span> : '—'}
                        </td>
                        <td data-label="Tamb (C)" data-empty={!cashExtra || undefined} className="font-monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {cashExtra ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>{fmtRp(t.cash)}</span> : '—'}
                        </td>
                        <td data-label="Tamb (QR)" data-empty={!qrisExtra || undefined} className="font-monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {qrisExtra ? <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{fmtRp(t.qris)}</span> : '—'}
                        </td>
                        <td data-label="Total Cash" data-empty={(pokokCash + (t.cash || 0)) === 0 || undefined} className="font-monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ fontWeight: 800, color: 'var(--green)' }}>{fmtRp(pokokCash + (t.cash || 0))}</span>
                        </td>
                        <td data-label="Total QRIS" data-empty={(pokokQris + (t.qris || 0)) === 0 || undefined} className="font-monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ fontWeight: 800, color: 'var(--cyan)' }}>{fmtRp(pokokQris + (t.qris || 0))}</span>
                        </td>
                        <td data-label="Grand Total" className="font-monospace" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{ fontWeight: 800, color: 'var(--yellow)' }}>{fmtRp(t.totalAll || ((t.totalBase || 0) + (t.grandTotal || 0)))}</span>
                        </td>
                        <td data-label="Aksi" style={{ textAlign: 'center' }}>
                          <div className="d-flex align-items-center justify-content-center gap-1">
                            <button className="act-btn" onClick={() => onPrintTxn(t)} title="Print Struk">
                              <i className="bi bi-printer-fill text-secondary"></i>
                            </button>
                            {!isCashier && (
                              <button className="act-btn" onClick={() => onDeleteTxn(t)} title="Hapus Bill">
                                <i className="bi bi-trash3-fill clr-red"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HistoryTab;
