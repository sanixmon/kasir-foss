import React, { useEffect, useRef } from 'react';
import { swalSuccess } from '../lib/swal';
import { ITEMS } from '../lib/items';
import { fmtRp } from '../lib/utils';

function QRCodeModal({ session, onClose }) {
  const qrRef = useRef(null);

  const trackUrl = window.location.href.split('#')[0] + '#track/' + session.id;
  const payAwal = session.payAwal || 'cash';

  const totalBase = (session.items || []).reduce((sum, it) => {
    const d = ITEMS.find(item => item.code === it.code);
    return sum + (d ? d.priceHour * it.qty : 0);
  }, 0);

  const timeStr = (ms) => {
    const d = new Date(ms);
    return d.toTimeString().slice(0, 5);
  };

  useEffect(() => {
    if (qrRef.current && window.QRCode) {
      qrRef.current.innerHTML = '';
      new window.QRCode(qrRef.current, {
        text: trackUrl,
        width: 210,
        height: 210,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M
      });
    }
  }, [trackUrl]);

  const copyTrackUrl = () => {
    navigator.clipboard.writeText(trackUrl)
      .then(() => swalSuccess('Link Disalin!', 'Link tracking berhasil disalin ke clipboard.'))
      .catch(() => {
        const el = document.createElement('textarea');
        el.value = trackUrl;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        swalSuccess('Link Disalin!');
      });
  };

  return (
    <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px' }}>
        <div className="modal-content cmodal border border-slate-700 shadow-xl">
          <div className="modal-header cmodal-head border-bottom border-slate-800 d-flex justify-content-between align-items-center">
            <h5 className="modal-title fs-6 fw-bold mb-0">
              <i className="bi bi-qr-code-scan me-2 text-info"></i>QR Tracking Sewa
            </h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className="modal-body p-3">
            <div className="qr-header-card p-3 mb-3 border rounded-3" style={{ background: 'var(--bg3)' }}>
              <div className="qr-header-name fw-bold mb-2 text-light fs-6">
                <i className="bi bi-person-fill me-2 text-info"></i>{session.nama}
              </div>
              <div className="qr-header-meta d-flex gap-2 align-items-center flex-wrap mb-2">
                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 font-monospace">
                  <i className="bi bi-clock me-1"></i>Mulai {timeStr(session.startTime)}
                </span>
                <span className={`aktif-pay-badge ${payAwal}`}>
                  <i className={`bi ${payAwal === 'qris' ? 'bi-qr-code-scan' : 'bi-cash-stack'}`}></i>
                  {' ' + payAwal.toUpperCase()}
                </span>
                <span className="badge bg-dark border border-secondary text-warning font-monospace">
                  {fmtRp(totalBase)}
                </span>
              </div>
              <div className="qr-items-preview d-flex gap-1 flex-wrap">
                {(session.items || []).map(it => {
                  const d = ITEMS.find(item => item.code === it.code);
                  return (
                    <span className="badge bg-secondary bg-opacity-50 text-light" key={it.code}>
                      {d ? d.name : it.code} ×{it.qty}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="qr-canvas-wrap d-flex flex-column align-items-center mb-3">
              <div className="mb-2 text-center small text-secondary fw-semibold">
                <i className="bi bi-qr-code me-1 text-info"></i>
                Berikan QR ini ke penyewa untuk tracking waktu real-time
              </div>
              <div className="qr-canvas-bg p-3 bg-white rounded-3 shadow-sm mb-2" id="qrCanvasBox" ref={qrRef} style={{ width: '226px', height: '226px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#666', fontSize: '.75rem' }}>Generating QR...</div>
              </div>
              <div className="qr-scan-hint text-center small text-secondary mt-1">
                Penyewa scan QR → timer otomatis aktif → struk digital saat selesai
              </div>
            </div>

            <div className="qr-url-box p-2 border rounded-3 text-truncate text-center mb-3 font-monospace small" style={{ background: 'var(--bg)', cursor: 'pointer' }} onClick={copyTrackUrl} title="Klik untuk salin">
              <i className="bi bi-link-45deg me-1"></i>{trackUrl}
            </div>

            <div className="d-flex gap-2 mb-2">
              <button className="btn btn-outline-secondary flex-fill py-2 d-flex align-items-center justify-content-center gap-1" onClick={copyTrackUrl}>
                <i className="bi bi-clipboard"></i>Salin Link
              </button>
              <button className="btn btn-primary flex-fill py-2 d-flex align-items-center justify-content-center gap-1" onClick={() => window.open(trackUrl, '_blank')}>
                <i className="bi bi-box-arrow-up-right"></i>Preview
              </button>
            </div>
            <button className="btn btn-secondary w-100 py-2" onClick={onClose}>Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default QRCodeModal;
