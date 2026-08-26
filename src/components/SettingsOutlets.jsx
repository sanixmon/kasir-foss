import React, { useState } from 'react';
import { createOutlet, deleteOutlet } from '../api';
import { swalSuccess, swalError, swalWarning, swalConfirm } from '../lib/swal';

function SettingsOutlets({ outlets = [], onSyncPull }) {
  const [newOutletId, setNewOutletId] = useState('');
  const [newOutletName, setNewOutletName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveOutlet = async (e) => {
    e.preventDefault();
    const id = newOutletId.trim().toLowerCase().replace(/\s+/g, '-');
    const nama = newOutletName.trim();

    if (!id || !nama) {
      swalWarning('Form Kosong', 'Masukkan ID dan Nama Outlet!');
      return;
    }

    try {
      setIsSaving(true);
      const res = await createOutlet({ id, nama });
      if (res && !res.error) {
        swalSuccess(`Outlet "${nama}" berhasil didaftarkan!`);
        setNewOutletId('');
        setNewOutletName('');
        if (onSyncPull) onSyncPull();
      } else {
        swalError('Gagal Menyimpan', res?.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Create outlet failed:', err);
      swalError('Koneksi Gagal', 'Tidak dapat terhubung ke server.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOutlet = async (outlet) => {
    const oId = typeof outlet === 'string' ? outlet : outlet.id;
    const oName = (typeof outlet === 'object' && (outlet.nama || outlet.name)) || oId;

    if (oId === 'outlet-pusat') {
      swalWarning('Tidak Dapat Dihapus', 'Outlet Pusat adalah outlet utama default sistem.');
      return;
    }

    const ok = await swalConfirm(
      `Hapus Outlet "${oName}"?`,
      `Outlet ID "${oId}" akan dihapus dari sistem.`,
      'Ya, Hapus!'
    );
    if (!ok) return;

    try {
      const res = await deleteOutlet(oId);
      if (res && !res.error) {
        swalSuccess(`Outlet "${oName}" berhasil dihapus!`);
        if (onSyncPull) onSyncPull();
      } else {
        swalError('Gagal Menghapus', res?.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Delete outlet failed:', err);
      swalError('Koneksi Gagal', 'Tidak dapat terhubung ke server.');
    }
  };

  return (
    <div className="col-12 col-xl-6">
      <div className="panel h-100">
        <div className="panel-head">
          <i className="bi bi-shop clr-yellow"></i>
          <span>Manajemen Cabang &amp; Outlet</span>
        </div>
        <div className="panel-body">
          <form onSubmit={handleSaveOutlet} className="mb-4 p-3 border rounded-3" style={{ background: 'var(--bg3)' }}>
            <div className="fw-bold small mb-2" style={{ color: 'var(--text)' }}>
              <i className="bi bi-plus-circle-fill me-1 clr-green"></i>Tambah Outlet / Cabang Baru
            </div>
            <div className="row g-2">
              <div className="col-12 col-sm-5">
                <input
                  type="text"
                  className="cfield w-100"
                  placeholder="ID Outlet (cth: outlet-cabang)"
                  value={newOutletId}
                  onChange={(e) => setNewOutletId(e.target.value)}
                />
              </div>
              <div className="col-12 col-sm-5">
                <input
                  type="text"
                  className="cfield w-100"
                  placeholder="Nama Outlet (cth: Cabang Mall)"
                  value={newOutletName}
                  onChange={(e) => setNewOutletName(e.target.value)}
                />
              </div>
              <div className="col-12 col-sm-2">
                <button
                  type="submit"
                  className="btn btn-sm btn-success w-100 h-100 font-weight-bold"
                  disabled={isSaving}
                >
                  {isSaving ? '...' : 'Tambah'}
                </button>
              </div>
            </div>
          </form>

          <div className="fw-bold small text-secondary mb-2">Daftar Outlet Terdaftar</div>
          <div className="row row-cols-1 row-cols-sm-2 g-2">
            {outlets.map(o => {
              const isPusat = o.id === 'outlet-pusat';
              const name = o.nama || o.name || o.id;
              return (
                <div className="col" key={o.id}>
                  <div className="p-2 border rounded-3 position-relative d-flex align-items-center justify-content-between" style={{ background: 'var(--bg)' }}>
                    <div className="d-flex align-items-center gap-2">
                      <i className={`bi ${isPusat ? 'bi-building-fill-check clr-cyan' : 'bi-shop text-secondary'} fs-5`}></i>
                      <div>
                        <div className="fw-bold small" style={{ color: 'var(--text)' }}>{name}</div>
                        <div className="font-monospace text-secondary" style={{ fontSize: '0.72rem' }}>{o.id}</div>
                      </div>
                    </div>
                    <div>
                      {isPusat ? (
                        <span className="badge bg-info bg-opacity-25 text-info border border-info border-opacity-25" style={{ fontSize: '0.65rem' }}>
                          Pusat
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-sm p-1 text-danger"
                          title={`Hapus ${name}`}
                          onClick={() => handleDeleteOutlet(o)}
                        >
                          <i className="bi bi-trash3-fill"></i>
                        </button>
                      )}
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

export default SettingsOutlets;
