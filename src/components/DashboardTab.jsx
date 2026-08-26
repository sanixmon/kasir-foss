import React, { useState, useEffect } from 'react';
import { ITEMS } from '../lib/items';
import { fmtRp, fmtDur } from '../lib/utils';
import { swalWarning } from '../lib/swal';

function ItemImage({ src, alt, emoji }) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className="item-img-fallback d-flex align-items-center justify-content-center w-100 h-100"
        style={{ fontSize: '2rem', background: 'var(--bg2)' }}
        aria-hidden="true"
      >
        <span>{emoji || '📦'}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || 'Rental Item'}
      loading="lazy"
      onError={() => setHasError(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}

function LiveSessionTimer({ session, onSelesaiSewa, onShowQR, onPrintSesi, onEditSesi, showOutletBadge }) {
  const safeStart = (session.startTime && Number(session.startTime) > 1577836800000) ? Number(session.startTime) : Date.now();
  const [elapsedSec, setElapsedSec] = useState(() => Math.max(0, Math.floor((Date.now() - safeStart) / 1000)));

  useEffect(() => {
    const update = () => {
      const sec = Math.max(0, Math.floor((Date.now() - safeStart) / 1000));
      setElapsedSec(sec);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [safeStart]);

  const itemsList = Array.isArray(session.items) ? session.items : [];
  const pkgItem = itemsList.find(it => {
    if (!it || !it.code) return false;
    const d = ITEMS.find(item => item.code === it.code);
    return d && d.isPackage;
  });
  const pkgHours = pkgItem ? (ITEMS.find(item => item.code === pkgItem.code)?.packageHours || 1) : 1;
  const limitMin = pkgItem ? pkgHours * 60 : 60;
  const overMin = (elapsedSec / 60) - limitMin;
  const payAwalStr = String(session.payAwal || 'cash').toLowerCase();

  // Clean status computation
  let status = 'normal';
  let statusLabel = 'Normal';
  let statusBg = 'rgba(16, 185, 129, 0.12)';
  let statusColor = 'var(--green, #10b981)';
  let statusBorder = 'rgba(16, 185, 129, 0.25)';
  let statusIcon = 'bi-check-circle-fill';
  let btnColor = 'linear-gradient(135deg, var(--green, #10b981), #059669)';
  let timerColor = 'var(--text)';

  if (overMin >= 15 || elapsedSec > 28800) {
    status = 'critical';
    statusLabel = 'Critical';
    statusBg = 'rgba(239, 68, 68, 0.15)';
    statusColor = 'var(--red, #ef4444)';
    statusBorder = 'rgba(239, 68, 68, 0.3)';
    statusIcon = 'bi-exclamation-octagon-fill';
    btnColor = 'linear-gradient(135deg, var(--red, #ef4444), #dc2626)';
    timerColor = 'var(--red, #ef4444)';
  } else if (overMin >= 0) {
    status = 'overtime';
    statusLabel = 'Overtime';
    statusBg = 'rgba(245, 158, 11, 0.15)';
    statusColor = 'var(--yellow, #f59e0b)';
    statusBorder = 'rgba(245, 158, 11, 0.3)';
    statusIcon = 'bi-clock-history';
    btnColor = 'linear-gradient(135deg, var(--yellow, #f59e0b), #d97706)';
    timerColor = 'var(--yellow, #f59e0b)';
  }

  return (
    <div className={`aktif-card status-${status}`} data-session-id={session.id}>
      {/* Header Row: Queue + Customer Name + Status Badge + Payment Badge */}
      <div className="d-flex align-items-center justify-content-between mb-2 gap-2" style={{ minWidth: 0 }}>
        <div className="aktif-name d-flex align-items-center gap-1 mb-0 flex-grow-1" style={{ minWidth: 0 }}>
          {Number(session.queueNo) > 0 && (
            <span className="aktif-queue-badge" title="Nomor Antrian">
              #{session.queueNo}
            </span>
          )}
          <i className="bi bi-person-fill clr-cyan" aria-hidden="true"></i>
          <span className="text-truncate" title={session.nama || 'Penyewa'}>
            {session.nama || 'Penyewa'}
          </span>
          {showOutletBadge && session.outletId && (
            <span className="badge bg-secondary bg-opacity-50 text-white ms-1" style={{ fontSize: '.65rem' }}>
              {session.outletId}
            </span>
          )}
        </div>

        <div className="d-flex align-items-center gap-1 flex-shrink-0">
          <span
            className={`aktif-status-badge status-${status}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: '99px',
              background: statusBg,
              color: statusColor,
              border: `1px solid ${statusBorder}`,
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
              lineHeight: 1.2
            }}
          >
            <i className={`bi ${statusIcon}`} style={{ fontSize: '0.65rem' }}></i>
            {statusLabel}
          </span>
          <span className={`aktif-pay-badge ${payAwalStr}`}>
            <i className={`bi ${payAwalStr === 'qris' ? 'bi-qr-code-scan' : 'bi-cash-stack'}`}></i>
            {payAwalStr.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Items List */}
      <div className="item-tags mb-2">
        {itemsList.map((it, idx) => (
          <span className="itag" key={it.code || idx}>
            {it.code || '-'}×{it.qty || 1}
          </span>
        ))}
      </div>

      {/* Timer & Start Time */}
      <div className="aktif-meta mb-2">
        <span className="aktif-start-lbl d-flex align-items-center">
          <i className="bi bi-clock me-1"></i>
          Mulai: {new Date(safeStart).toTimeString().slice(0, 5)}
        </span>
        <span
          className="aktif-timer font-monospace"
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '1.05rem',
            fontWeight: 700,
            letterSpacing: '0.5px',
            color: timerColor
          }}
          aria-label={`Durasi aktif: ${fmtDur(elapsedSec)}`}
        >
          {fmtDur(elapsedSec)}
        </span>
      </div>

      {/* One-Tap Action Buttons */}
      <div className="aktif-footer d-flex gap-2 align-items-center mt-auto">
        <button
          type="button"
          className="btn-selesai flex-fill d-flex align-items-center justify-content-center gap-1"
          style={{
            background: btnColor,
            minHeight: '40px',
            padding: '8px 12px',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.85rem'
          }}
          onClick={() => onSelesaiSewa(session)}
        >
          <i className="bi bi-stop-circle-fill me-1"></i>
          <span>Selesai</span>
        </button>
        <button
          type="button"
          className="btn-qr-aktif"
          style={{ minWidth: '40px', minHeight: '40px' }}
          onClick={() => onShowQR(session)}
          title="Tampilkan QR"
          aria-label="Tampilkan QR"
        >
          <i className="bi bi-qr-code"></i>
        </button>
        <button
          type="button"
          className="btn-qr-aktif"
          style={{
            minWidth: '40px',
            minHeight: '40px',
            background: 'var(--bg2)',
            color: 'var(--cyan, #0ea5e9)',
            border: '1px solid var(--border)'
          }}
          onClick={() => onPrintSesi(session)}
          title="Print Struk"
          aria-label="Print Struk"
        >
          <i className="bi bi-printer-fill"></i>
        </button>
        <button
          type="button"
          className="btn-edit-aktif"
          style={{ minWidth: '40px', minHeight: '40px' }}
          onClick={() => onEditSesi(session)}
          title="Edit Sesi"
          aria-label="Edit Sesi"
        >
          <i className="bi bi-pencil-fill"></i>
        </button>
      </div>
    </div>
  );
}

function DashboardTab({
  activeSessions = [],
  onStartSewa,
  getImgUrl,
  onSelesaiSewa,
  onShowQR,
  onPrintSesi,
  onEditSesi,
  currentUserRole,
  outlets = [],
  selectedOutletFilter,
  onSelectOutletFilter
}) {
  const [inputNama, setInputNama] = useState('');
  const [payAwal, setPayAwal] = useState('cash');
  const [selectedQty, setSelectedQty] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localOutletFilter, setLocalOutletFilter] = useState('all');

  const isAdmin = currentUserRole === 'admin';
  const effectiveOutletFilter = selectedOutletFilter !== undefined ? selectedOutletFilter : localOutletFilter;

  const handleOutletFilterChange = (val) => {
    setLocalOutletFilter(val);
    if (typeof onSelectOutletFilter === 'function') {
      onSelectOutletFilter(val);
    }
  };

  const changeQty = (code, delta) => {
    setSelectedQty(prev => {
      const current = prev[code] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [code]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [code]: next };
    });
  };

  const handleStart = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;

    const nama = inputNama.trim();
    if (!nama) {
      swalWarning('Nama Kosong', 'Masukkan nama penyewa!');
      return;
    }

    const items = ITEMS.filter(i => (selectedQty[i.code] || 0) > 0)
                       .map(i => ({ code: i.code, qty: selectedQty[i.code] }));

    if (items.length === 0) {
      swalWarning('Item Belum Dipilih', 'Pilih minimal satu item!');
      return;
    }

    setIsSubmitting(true);
    try {
      if (typeof onStartSewa === 'function') {
        await onStartSewa(nama, items, payAwal);
      }
      // Reset form on success
      setInputNama('');
      setPayAwal('cash');
      setSelectedQty({});
    } catch (err) {
      console.error('Failed starting rental:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scopedSessions = (activeSessions || []).filter(s => {
    if (!s) return false;
    if (isAdmin && effectiveOutletFilter && effectiveOutletFilter !== 'all') {
      return (s.outletId || 'outlet-pusat') === effectiveOutletFilter;
    }
    return true;
  });

  const queryLower = String(searchQuery || '').trim().toLowerCase();
  const filteredSessions = scopedSessions
    .filter(s => {
      if (!s) return false;
      if (!queryLower) return true;
      const matchName = String(s.nama || '').toLowerCase().includes(queryLower);
      const matchQueue = String(s.queueNo || '').toLowerCase().includes(queryLower);
      return matchName || matchQueue;
    })
    .sort((a, b) => (b.startTime || 0) - (a.startTime || 0));

  return (
    <div id="tab-dashboard" className="tab-pane active">
      <div className="row g-3">
        {/* LEFT COLUMN: Rental Starter */}
        <div className="col-12 col-lg-5 d-flex flex-column">
          <div className="panel flex-fill">
            <div className="panel-head">
              <i className="bi bi-plus-circle-fill clr-yellow"></i>
              <span>Sewa Baru</span>
            </div>
            <div className="panel-body">
              {/* Customer Name Input */}
              <label htmlFor="customer-name-input" className="field-label">
                Nama Penyewa
              </label>
              <div className="input-ico-wrap mb-3">
                <i className="bi bi-person-fill ico" aria-hidden="true"></i>
                <input
                  id="customer-name-input"
                  type="text"
                  value={inputNama}
                  onChange={(e) => setInputNama(e.target.value)}
                  className="cfield"
                  style={{ minHeight: '44px' }}
                  placeholder="Masukkan nama penyewa..."
                  autoComplete="off"
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>

              {/* Payment Method Selector */}
              <label className="field-label mb-2">Metode Bayar Awal (Tarif Pokok)</label>
              <div className="pay-awal-selector d-flex gap-2 mb-3" role="radiogroup" aria-label="Metode Bayar Awal">
                <label
                  className={`pay-awal-opt flex-fill d-flex align-items-center justify-content-center ${payAwal === 'cash' ? 'active' : ''}`}
                  style={{
                    minHeight: '44px',
                    borderRadius: '8px',
                    border: payAwal === 'cash' ? '2px solid var(--green, #10b981)' : '1px solid var(--border)',
                    background: payAwal === 'cash' ? 'color-mix(in srgb, var(--green, #10b981) 12%, var(--bg))' : 'var(--bg)',
                    color: payAwal === 'cash' ? 'var(--green, #10b981)' : 'var(--text2)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    padding: '8px 12px'
                  }}
                >
                  <input
                    type="radio"
                    name="payAwal"
                    value="cash"
                    checked={payAwal === 'cash'}
                    onChange={() => setPayAwal('cash')}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <span className="d-flex align-items-center gap-2" style={{ border: 'none', padding: 0, background: 'none', color: 'inherit' }}>
                    <i className="bi bi-cash-stack fs-5"></i>
                    <span>Cash</span>
                  </span>
                </label>

                <label
                  className={`pay-awal-opt flex-fill d-flex align-items-center justify-content-center ${payAwal === 'qris' ? 'active' : ''}`}
                  style={{
                    minHeight: '44px',
                    borderRadius: '8px',
                    border: payAwal === 'qris' ? '2px solid var(--cyan, #0ea5e9)' : '1px solid var(--border)',
                    background: payAwal === 'qris' ? 'color-mix(in srgb, var(--cyan, #0ea5e9) 12%, var(--bg))' : 'var(--bg)',
                    color: payAwal === 'qris' ? 'var(--cyan, #0ea5e9)' : 'var(--text2)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    padding: '8px 12px'
                  }}
                >
                  <input
                    type="radio"
                    name="payAwal"
                    value="qris"
                    checked={payAwal === 'qris'}
                    onChange={() => setPayAwal('qris')}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                  <span className="d-flex align-items-center gap-2" style={{ border: 'none', padding: 0, background: 'none', color: 'inherit' }}>
                    <i className="bi bi-qr-code-scan fs-5"></i>
                    <span>QRIS</span>
                  </span>
                </label>
              </div>

              {/* Items Selection Cards */}
              <label className="field-label mb-2">Pilih Item &amp; Jumlah</label>
              <div className="row row-cols-2 row-cols-sm-3 g-2 mb-3">
                {ITEMS.map(item => {
                  const qty = selectedQty[item.code] || 0;
                  const isSelected = qty > 0;
                  const img = (typeof getImgUrl === 'function' ? getImgUrl(item.code) : null) || item.defaultImg;
                  const priceLabel = item.isPackage
                    ? `Paket ${item.packageHours}j • ${fmtRp(item.priceHour)}`
                    : `${fmtRp(item.priceHour)}/jam`;

                  return (
                    <div className="col" key={item.code}>
                      <div
                        className={`item-card ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => {
                          if (!e.target.closest('.qty-control')) {
                            changeQty(item.code, 1);
                          }
                        }}
                        style={{
                          userSelect: 'none',
                          border: isSelected ? '2px solid var(--primary, #2563eb)' : '1px solid var(--border)'
                        }}
                      >
                        <div className="item-img-box position-relative w-100">
                          <ItemImage src={img} alt={item.name} emoji={item.emoji} />
                          {isSelected && (
                            <div
                              className="position-absolute top-0 end-0 m-1 bg-primary text-white rounded-circle d-flex align-items-center justify-content-center"
                              style={{
                                width: '22px',
                                height: '22px',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                                fontSize: '0.8rem',
                                fontWeight: 800
                              }}
                              aria-hidden="true"
                            >
                              <i className="bi bi-check-lg"></i>
                            </div>
                          )}
                        </div>

                        <div className="d-flex align-items-center justify-content-between w-100 gap-1 px-1">
                          <span className="item-code">{item.code}</span>
                          {item.isPackage && (
                            <span className="badge bg-secondary bg-opacity-25 text-body-secondary" style={{ fontSize: '0.6rem' }}>
                              Paket
                            </span>
                          )}
                        </div>

                        <div className="item-name text-truncate w-100" title={item.name}>
                          {item.name}
                        </div>
                        <div className="item-price text-truncate w-100 font-monospace" style={{ fontSize: '0.75rem' }}>
                          {priceLabel}
                        </div>

                        <div
                          className="qty-control d-flex align-items-center justify-content-between w-100 mt-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="qty-btn minus"
                            style={{ minWidth: '38px', minHeight: '38px', touchAction: 'manipulation' }}
                            onClick={() => changeQty(item.code, -1)}
                            disabled={qty === 0}
                            aria-label={`Kurangi ${item.name}`}
                          >
                            <i className="bi bi-dash-lg"></i>
                          </button>
                          <span className="qty-val font-monospace">{qty}</span>
                          <button
                            type="button"
                            className="qty-btn plus"
                            style={{ minWidth: '38px', minHeight: '38px', touchAction: 'manipulation' }}
                            onClick={() => changeQty(item.code, 1)}
                            aria-label={`Tambah ${item.name}`}
                          >
                            <i className="bi bi-plus-lg"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Start Rental Submit Button */}
              <button
                type="button"
                className="btn-start w-100"
                style={{ minHeight: '48px', touchAction: 'manipulation' }}
                onClick={handleStart}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    <span>Memproses Sesi...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-play-circle-fill me-2"></i>
                    <span>Mulai Sewa Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Active Sessions List */}
        <div className="col-12 col-lg-7 d-flex flex-column">
          <div className="panel flex-fill">
            <div className="panel-head flex-wrap gap-2">
              <i className="bi bi-people-fill clr-cyan"></i>
              <span>Penyewa Aktif</span>
              {isAdmin && (
                <select
                  className="cfield-sm ms-auto"
                  style={{ maxWidth: '160px', minHeight: '36px' }}
                  value={effectiveOutletFilter}
                  onChange={(e) => handleOutletFilterChange(e.target.value)}
                  aria-label="Filter Outlet Dashboard"
                >
                  <option value="all">Semua Outlet</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nama || o.name || o.id}
                    </option>
                  ))}
                </select>
              )}
              <span className={isAdmin ? 'aktif-count' : 'ms-auto aktif-count'}>
                {scopedSessions.length}
              </span>
            </div>

            <div className="panel-body">
              {/* Search Bar */}
              <div className="input-ico-wrap mb-3">
                <i className="bi bi-search ico" aria-hidden="true"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="cfield"
                  style={{ minHeight: '42px' }}
                  placeholder="Cari nama atau antrian..."
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Cari nama penyewa aktif"
                />
              </div>

              {/* Sessions Grid / Empty State */}
              <div className="aktif-scroll">
                {filteredSessions.length === 0 ? (
                  <div
                    className="empty-box col-12 d-flex flex-column align-items-center justify-content-center py-5 text-center text-muted"
                    style={{ gridColumn: '1 / -1' }}
                  >
                    <i className="bi bi-clock-history mb-2" style={{ fontSize: '3rem', opacity: 0.4 }}></i>
                    <p className="mb-0" style={{ fontWeight: 500 }}>
                      Belum ada penyewa aktif
                    </p>
                  </div>
                ) : (
                  filteredSessions.map(s => (
                    <LiveSessionTimer
                      key={s.id}
                      session={s}
                      onSelesaiSewa={onSelesaiSewa}
                      onShowQR={onShowQR}
                      onPrintSesi={onPrintSesi}
                      onEditSesi={onEditSesi}
                      showOutletBadge={isAdmin && effectiveOutletFilter === 'all'}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardTab;
