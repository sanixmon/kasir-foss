import React, { useState } from 'react';
import { fmtRp } from '../App';
import { aggregateHistory } from '../lib/history';

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

const timeStr = ts => new Date(ts).toTimeString().slice(0,5);

function HistoryTab({ transactions, onPrintTxn, onDeleteTxn }) {
  const getLocalDateString = () => {
    const d = new Date();
    d.setHours(d.getHours() - 6); // Shift rollover at 6 AM
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [filterMode, setFilterMode] = useState('daily');
  const [filterDate, setFilterDate] = useState(getLocalDateString());
  const [filterMonth, setFilterMonth] = useState(getLocalDateString().slice(0, 7));
  const [filterYear, setFilterYear] = useState(getLocalDateString().slice(0, 4));

  const filterValue = filterMode === 'daily' ? filterDate : filterMode === 'monthly' ? filterMonth : filterYear;

  const {
    filtered, totalPokok, totalPokokCash, totalPokokQris, 
    totalTambahan, totalOTCash, totalOTQris, 
    totalCashAll, totalQrisAll, grandTotal
  } = aggregateHistory(transactions, filterMode, filterValue);

  const handleExport = () => {
    if (filtered.length === 0) { 
      alert('Tidak ada data untuk diexport'); 
      return; 
    }
    const dataRows = filtered.map(t => ({
      No: t.no, 
      Nama: t.nama, 
      Shift: t.shift, 
      Tanggal: t.tanggal,
      Mulai: timeStr(t.startTime),
      Selesai: timeStr(t.endTime),
      Items: t.items, 
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
        <div className="panel-head flex-wrap gap-2">
          <i className="bi bi-clock-history clr-green"></i><span>Riwayat Transaksi</span>
          <div className="ms-auto d-flex gap-2 flex-wrap align-items-center">
            <select className="cfield-sm" value={filterMode} onChange={e => setFilterMode(e.target.value)}>
              <option value="daily">Harian</option>
              <option value="monthly">Bulanan</option>
              <option value="yearly">Tahunan</option>
            </select>
            {filterMode === 'daily' && <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="cfield-sm" />}
            {filterMode === 'monthly' && <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="cfield-sm" />}
            {filterMode === 'yearly' && <input type="number" min="2024" max="2099" value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="cfield-sm" style={{width:'80px'}} />}
            <button className="btn-export" onClick={handleExport}><i className="bi bi-download me-1"></i>Export</button>
          </div>
        </div>
        <div className="panel-body">
          <div className="row g-2 mb-3">
            <div className="col-12 col-md-4 col-xl-2"><div className="sum-card"><div className="sum-label">Transaksi</div><div className="sum-val">{filtered.length}</div></div></div>
            <div className="col-12 col-md-4 col-xl-2">
              <div className="sum-card">
                <div className="sum-label">Total Pokok</div>
                <div className="sum-val" style={{ color: 'var(--text)' }}>{fmtRp(totalPokok)}</div>
                <div className="sum-pokok-breakdown d-flex justify-content-between small text-secondary px-1" style={{ fontSize: '0.65rem' }}>
                  <span className="sum-pokok-item text-secondary" style={{ background: 'transparent', border: 'none', padding: 0 }}>C: {fmtRp(totalPokokCash)}</span>
                  <span className="sum-pokok-item text-secondary" style={{ background: 'transparent', border: 'none', padding: 0 }}>Q: {fmtRp(totalPokokQris)}</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4 col-xl-2">
              <div className="sum-card">
                <div className="sum-label">Total Tambahan</div>
                <div className="sum-val" style={{ color: 'var(--text)' }}>{fmtRp(totalTambahan)}</div>
                <div className="sum-pokok-breakdown d-flex justify-content-between small text-secondary px-1" style={{ fontSize: '0.65rem' }}>
                  <span className="sum-pokok-item text-secondary" style={{ background: 'transparent', border: 'none', padding: 0 }}>C: {fmtRp(totalOTCash)}</span>
                  <span className="sum-pokok-item text-secondary" style={{ background: 'transparent', border: 'none', padding: 0 }}>Q: {fmtRp(totalOTQris)}</span>
                </div>
              </div>
            </div>
            <div className="col-12 col-md-4 col-xl-2"><div className="sum-card"><div className="sum-label">Total Cash</div><div className="sum-val" style={{ color: 'var(--text)' }}>{fmtRp(totalCashAll)}</div></div></div>
            <div className="col-12 col-md-4 col-xl-2"><div className="sum-card"><div className="sum-label">Total QRIS</div><div className="sum-val" style={{ color: 'var(--text)' }}>{fmtRp(totalQrisAll)}</div></div></div>
            <div className="col-12 col-md-4 col-xl-2"><div className="sum-card" style={{ borderColor: 'var(--cyan)', background: 'rgba(88,166,255,0.05)' }}><div className="sum-label clr-cyan">Grand Total</div><div className="sum-val clr-cyan">{fmtRp(grandTotal)}</div></div></div>
          </div>
          
          <div className="table-responsive">
            <table className="ctable">
              <thead>
                <tr>
                  <th>No</th><th>Nama</th><th>Shift</th><th>Tgl</th><th>Waktu</th>
                  <th>Item</th><th>Tambahan</th><th>Dur OT</th>
                  <th className="th-pokok-cash"><i className="bi bi-cash-stack me-1"></i>Pokok (C)</th>
                  <th className="th-pokok-qris"><i className="bi bi-qr-code-scan me-1"></i>Pokok (QR)</th>
                  <th style={{ color: 'var(--green)' }}>Tambahan (C)</th>
                  <th style={{ color: 'var(--cyan)' }}>Tambahan (QR)</th>
                  <th style={{ color: 'var(--green)' }}>Total Cash</th>
                  <th style={{ color: 'var(--cyan)' }}>Total QRIS</th>
                  <th>Grand Total</th><th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="16"><div className="empty-box"><i className="bi bi-receipt" style={{fontSize:'3.5rem', opacity:0.5}}></i><p>Tidak ada transaksi di tanggal ini</p></div></td></tr>
                ) : (
                  filtered.map((t, idx) => {
                    const isCash = (t.payAwal || 'cash') === 'cash';
                    const isQris = (t.payAwal || 'cash') === 'qris';
                    const pokokCash = isCash ? (t.totalBase || 0) : 0;
                    const pokokQris = isQris ? (t.totalBase || 0) : 0;

                    return (
                      <tr key={t.id}>
                        <td>{idx + 1}</td>
                        <td><strong>{t.nama}</strong></td>
                        <td><span className="badge-shift">{shiftCode(t.shift)}</span></td>
                        <td>{dateStr(t.startTime)}</td>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{timeStr(t.startTime)} - {timeStr(t.endTime)}</td>
                        <td style={{ fontSize: '0.78rem' }}>{t.items}</td>
                        <td style={{ fontSize: '0.78rem' }}>{t.ot || '-'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--orange)' }}>{t.otDur || '-'}</td>
                        <td>{isCash ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>{fmtRp(t.totalBase || 0)}</span> : '—'}</td>
                        <td>{isQris ? <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{fmtRp(t.totalBase || 0)}</span> : '—'}</td>
                        <td>{(t.cash || 0) > 0 ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>{fmtRp(t.cash)}</span> : '—'}</td>
                        <td>{(t.qris || 0) > 0 ? <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{fmtRp(t.qris)}</span> : '—'}</td>
                        <td><span style={{ fontWeight: 800, color: 'var(--green)' }}>{fmtRp(pokokCash + (t.cash || 0))}</span></td>
                        <td><span style={{ fontWeight: 800, color: 'var(--cyan)' }}>{fmtRp(pokokQris + (t.qris || 0))}</span></td>
                        <td><span style={{ fontWeight: 800, color: 'var(--yellow)' }}>{fmtRp(t.totalAll || ((t.totalBase || 0) + (t.grandTotal || 0)))}</span></td>
                        <td>
                          <button className="act-btn me-2" onClick={() => onPrintTxn(t)} title="Print Struk"><i className="bi bi-printer-fill text-secondary"></i></button>
                          <button className="act-btn" onClick={() => onDeleteTxn(t.id)} title="Hapus"><i className="bi bi-trash3-fill clr-red"></i></button>
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
