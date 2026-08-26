import React, { useEffect } from 'react';
import { fmtRp } from '../../../lib/utils';

function DeletionLogTab({ deletionLogs = [], onLoadDeletionLogs }) {
  // Auto-load log saat tab pertama dibuka
  useEffect(() => {
    if (onLoadDeletionLogs) onLoadDeletionLogs();
  }, []);

  return (
    <div id="tab-deletion-log" className="tab-pane active">
      <div className="panel">
        <div className="panel-head flex-wrap gap-2">
          <i className="bi bi-shield-exclamation clr-red"></i>
          <span>Log Penghapusan Riwayat</span>
          <span className="ms-1 aktif-count" style={{ background: 'var(--red)' }}>{deletionLogs.length}</span>
          <button
            className="btn btn-sm btn-outline-secondary ms-auto"
            onClick={onLoadDeletionLogs}
            title="Muat ulang log"
          >
            <i className="bi bi-arrow-clockwise me-1"></i>Refresh
          </button>
        </div>
        <div className="panel-body">
          {deletionLogs.length === 0 ? (
            <div className="empty-box">
              <i className="bi bi-check-circle-fill" style={{ fontSize: '3.5rem', opacity: 0.3, color: 'var(--green)' }}></i>
              <p>Belum ada riwayat penghapusan</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="ctable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ID Transaksi</th>
                    <th>Nama Penyewa</th>
                    <th>Tanggal Sewa</th>
                    <th>Grand Total</th>
                    <th>Dihapus Oleh</th>
                    <th>Waktu Hapus</th>
                  </tr>
                </thead>
                <tbody>
                  {deletionLogs.map((log, idx) => (
                    <tr key={log.id || idx}>
                      <td data-label="#">{idx + 1}</td>
                      <td data-label="ID" style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text2)' }}>
                        {log.txnId || (log.txnNo ? `No.${log.txnNo}` : '-')}
                      </td>
                      <td data-label="Nama"><strong>{log.txnNama || '-'}</strong></td>
                      <td data-label="Tanggal">{log.txnTanggal || '-'}</td>
                      <td data-label="Grand Total">
                        <span style={{ color: 'var(--red)', fontWeight: 800 }}>
                          {log.txnTotalAll ? fmtRp(log.txnTotalAll) : '-'}
                        </span>
                      </td>
                      <td data-label="Dihapus Oleh">
                        <span className="badge-shift" style={{
                          background: 'rgba(249,115,22,.15)',
                          color: 'var(--orange)',
                          border: '1px solid rgba(249,115,22,.3)'
                        }}>
                          {log.deletedBy || 'admin'}
                        </span>
                      </td>
                      <td data-label="Waktu Hapus" style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--text2)' }}>
                        {log.deletedAt
                          ? new Date(log.deletedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DeletionLogTab;
