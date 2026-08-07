# EVREN HOUSE POS React Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the EVREN HOUSE cashier web application into a Vite + React (JavaScript/JSX) app with 1:1 CSS matching, 10:59 overtime tolerance, shift-based queue numbers, and no Service Worker.

**Architecture:** A Single-Page React App using global state in `App.jsx` (which mimics the vanilla JS state/local storage variables), passing props and callbacks to child components and modals. Vanilla CSS styling is preserved exactly by copying `style.css` to `src/index.css` and importing it globally.

**Tech Stack:** React 19, Vite 8, Supabase client (`@supabase/supabase-js`), Bootstrap 5 CSS, Bootstrap Icons, Montserrat & Inter Google Fonts, SheetJS (XLSX), QRCode.js.

## Global Constraints
- **React Template:** JavaScript React (JSX), no TypeScript.
- **Service Worker:** No `sw.js` registration; unregister logic must be executed to clear previous PWA installations.
- **1:1 Styling:** Do not edit the core rules in `style.css` (imported as `src/index.css`). Use original classes (`className="panel"`, `className="cfield"`, etc.).
- **Overtime rule:** Free until 10 minutes and 59 seconds. OT triggers only when `Math.floor(elapsedMin - limitMin) >= 11`.
- **Queue Number:** Increments on new rental, resets to `0` and is cleared from `localStorage` on logout.

---

### Task 1: Setup HTML, Vite, and Style Integration

**Files:**
- Modify: `index.html`
- Create: `src/index.css`
- Modify: `src/main.jsx`
- Modify: `vite.config.js`

**Interfaces:**
- Consumes: `/backup-vanilla/index.html`, `/backup-vanilla/style.css`
- Produces: CSS imported globally, CDNs loaded in HTML, basic React mount verified.

- [ ] **Step 1: Update index.html**
  Replace `/root/dev/kasir-db/index.html` with basic React mount structure and keep all original Google fonts, Bootstrap CDNs, sheetJS, and qrcodejs scripts, and add the SW unregistration logic.
  
  ```html
  <!DOCTYPE html>
  <html lang="id" data-theme="dark">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EVREN HOUSE</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <div id="printArea" style="display:none"></div>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <script type="module" src="/src/main.jsx"></script>
    <script>
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
          for (let registration of registrations) {
            registration.unregister();
          }
        });
      }
    </script>
  </body>
  </html>
  ```

- [ ] **Step 2: Copy Vanilla CSS**
  Copy `/root/dev/kasir-db/backup-vanilla/style.css` to `/root/dev/kasir-db/src/index.css`.
  
  ```bash
  cp backup-vanilla/style.css src/index.css
  ```

- [ ] **Step 3: Update src/main.jsx**
  Import the global CSS and bootstrap imports.
  
  ```javascript
  import React from 'react'
  import ReactDOM from 'react-dom/client'
  import App from './App.jsx'
  import './index.css'

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
  ```

- [ ] **Step 4: Update src/App.jsx for baseline test**
  Write a placeholder App component to verify the dev environment runs.
  
  ```javascript
  import React from 'react';

  function App() {
    return (
      <div className="container py-5 text-center">
        <h1 className="brand-title">EVREN HOUSE</h1>
        <p className="brand-sub">React Baseline Working</p>
      </div>
    );
  }

  export default App;
  ```

- [ ] **Step 5: Run dev build to verify setup**
  Run: `npm run build`
  Expected: Production build finishes successfully with zero errors.

- [ ] **Step 6: Commit**
  ```bash
  git add index.html src/index.css src/main.jsx src/App.jsx vite.config.js
  git commit -m "feat: setup react project structure and import style.css"
  ```

---

### Task 2: Supabase Integration & State Initialization

**Files:**
- Create: `src/supabase.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: Supabase credentials from `/backup-vanilla/script.js`
- Produces: Exported Supabase client `sb` and initial state loaders in `App.jsx`.

- [ ] **Step 1: Create src/supabase.js**
  Initialize and export the Supabase client using client URL and anon key.
  
  ```javascript
  import { createClient } from '@supabase/supabase-js';

  const SB_URL = "https://bacpwnbsvtwotkfnkhnb.supabase.co";
  const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhY3B3bmJzdnR3b3RrZm5raG5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Mjc2NzcsImV4cCI6MjA5MTEwMzY3N30.TA79dCK8U7oRyuw_XIr3WoW3Ll_j3qBs78erL6KuhI4";
  
  export const sb = createClient(SB_URL, SB_KEY);
  ```

- [ ] **Step 2: Add initial state and localStorage logic in App.jsx**
  Implement local state loading, constants for `ITEMS` and helper formatting methods.
  
  ```javascript
  import React, { useState, useEffect } from 'react';
  import { sb } from './supabase';

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

  function App() {
    const [activeSessions, setActiveSessions] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [adminPassword, setAdminPassword] = useState('admin');
    const [shiftQueueNo, setShiftQueueNo] = useState(0);
    const [currentShiftUser, setCurrentShiftUser] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [theme, setTheme] = useState('dark');
    const [sbConnected, setSbConnected] = useState(false);

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
      setCurrentShiftUser(localStorage.getItem('kw_currentUser'));
      
      const savedTheme = localStorage.getItem('kw_theme') || 'dark';
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }, []);

    return (
      <div className="container py-5">
        <p>Current User: {currentShiftUser || 'Guest'}</p>
        <p>Theme: {theme}</p>
      </div>
    );
  }

  export default App;
  ```

- [ ] **Step 3: Test rendering**
  Run: `npm run build`
  Expected: Clean build with zero errors.

- [ ] **Step 4: Commit**
  ```bash
  git add src/supabase.js src/App.jsx
  git commit -m "feat: add supabase client and initial state setups"
  ```

---

### Task 3: Login Panel & Shift Navigation Router

**Files:**
- Create: `src/components/LoginPage.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- LoginPage: Consumes callback `onLogin(userName)`
- App: Holds routes to switch between Login view, tracking hash view, and Main POS dashboard tabs.

- [ ] **Step 1: Create src/components/LoginPage.jsx**
  Implement the exact UI of `/backup-vanilla/index.html` lines 15-44.
  
  ```javascript
  import React, { useState } from 'react';

  const SHIFT_USERS = ['akbar','rani','monica','aldy','wahyu','donny','zumi','awang'];
  const SHIFT_PASS = 'jayalahevren';

  function LoginPage({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = () => {
      if (!username) { setError('⚠️ Pilih nama kasir!'); return; }
      if (!SHIFT_USERS.includes(username.toLowerCase())) { setError('❌ Kasir tidak ditemukan!'); return; }
      if (password !== SHIFT_PASS) { setError('❌ Password salah!'); return; }
      setError('');
      onLogin(username);
    };

    return (
      <div id="loginPage">
        <div className="login-card">
          <div style={{ marginBottom: '24px' }}>
            <div className="login-brand">EVREN HOUSE</div>
            <div className="login-sub">Scooter &amp; Stroller</div>
          </div>
          <hr className="login-divider" style={{ marginTop: 0, marginBottom: '20px' }} />
          <div className="login-shift-title"><i className="bi bi-person-badge-fill me-1"></i>Login Shift Kasir</div>
          <select 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            className="login-select"
          >
            <option value="">— Pilih Nama Kasir —</option>
            <option value="akbar">Akbar</option>
            <option value="rani">Rani</option>
            <option value="monica">Monica</option>
            <option value="aldy">Aldy</option>
            <option value="wahyu">Wahyu</option>
            <option value="donny">Donny</option>
            <option value="zumi">Zumi</option>
            <option value="awang">Awang</option>
          </select>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-field" 
            placeholder="Password shift..." 
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button className="btn-login" onClick={handleLogin}>
            <i className="bi bi-box-arrow-in-right"></i>Mulai Shift
          </button>
          <div className="login-err">{error}</div>
          <div style={{ marginTop: '18px', fontSize: '.72rem', color: 'var(--text2)', textAlign: 'center' }}>
            <i className="bi bi-shield-lock me-1"></i>Akses terbatas untuk kasir Evren House
          </div>
        </div>
      </div>
    );
  }

  export default LoginPage;
  ```

- [ ] **Step 2: Add navigation and switch routing to App.jsx**
  Check hash routing (for `#track/`) or session checking, and handle header clock.
  
  ```javascript
  // Add this routing logic to App.jsx
  import React, { useState, useEffect } from 'react';
  import LoginPage from './components/LoginPage';
  import { sb } from './supabase';

  function App() {
    const [activeSessions, setActiveSessions] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [adminPassword, setAdminPassword] = useState('admin');
    const [shiftQueueNo, setShiftQueueNo] = useState(0);
    const [currentShiftUser, setCurrentShiftUser] = useState(null);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [theme, setTheme] = useState('dark');
    const [sbConnected, setSbConnected] = useState(false);
    const [isTrackingMode, setIsTrackingMode] = useState(false);
    const [trackingId, setTrackingId] = useState('');
    const [liveTime, setLiveTime] = useState('00:00:00');
    const [liveDate, setLiveDate] = useState('—');

    const handleLogin = (user) => {
      // Find proper capitalization
      const cName = user.charAt(0).toUpperCase() + user.slice(1);
      setCurrentShiftUser(cName);
      localStorage.setItem('kw_currentUser', cName);
    };

    const handleLogout = () => {
      if (window.confirm(`Akhiri shift sebagai ${currentShiftUser}?`)) {
        localStorage.removeItem('kw_currentUser');
        localStorage.removeItem('kw_shiftQNo');
        setShiftQueueNo(0);
        setCurrentShiftUser(null);
      }
    };

    useEffect(() => {
      // Check saved user
      const savedUser = localStorage.getItem('kw_currentUser');
      if (savedUser) setCurrentShiftUser(savedUser);

      // Check hash route
      const checkHash = () => {
        const hash = window.location.hash;
        if (hash.startsWith('#track/')) {
          setIsTrackingMode(true);
          setTrackingId(hash.replace('#track/', '').trim());
        } else {
          setIsTrackingMode(false);
          setTrackingId('');
        }
      };
      checkHash();
      window.addEventListener('hashchange', checkHash);

      // Start clock
      const tick = () => {
        const now = new Date();
        setLiveTime(now.toTimeString().slice(0, 8));
        const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        setLiveDate(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`);
      };
      tick();
      const interval = setInterval(tick, 1000);

      return () => {
        window.removeEventListener('hashchange', checkHash);
        clearInterval(interval);
      };
    }, []);

    if (isTrackingMode) {
      return (
        <div id="trackingPage">
          <div className="track-body" style={{ color: 'white', padding: '40px' }}>
            <h2>Tracking Sesi: {trackingId}</h2>
            <p>Fitur tracking akan dikembangkan pada task selanjutnya.</p>
          </div>
        </div>
      );
    }

    if (!currentShiftUser) {
      return <LoginPage onLogin={handleLogin} />;
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
                <div className="shift-indicator d-flex" onClick={handleLogout}>
                  <span className="shift-dot"></span>
                  <span>{currentShiftUser}</span>
                  <i className="bi bi-box-arrow-right ms-1" style={{ fontSize: '.75rem', opacity: .6 }}></i>
                </div>
                <div className="text-end">
                  <div className="clock-time">{liveTime}</div>
                  <div className="clock-date d-none d-sm-block">{liveDate}</div>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="container-fluid px-2 px-md-3 py-3" style={{ paddingBottom: '80px' }}>
          <h4>Active Tab: {activeTab}</h4>
        </div>
      </div>
    );
  }

  export default App;
  ```

- [ ] **Step 3: Build & verify**
  Run: `npm run build`
  Expected: Successful compilation.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/LoginPage.jsx src/App.jsx
  git commit -m "feat: add LoginPage and core shift router in App.jsx"
  ```

---

### Task 4: Dashboard Tab Component (Rental Creation & Listing)

**Files:**
- Create: `src/components/DashboardTab.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- DashboardTab: Consumes `activeSessions`, `onStartSewa(nama, selectedItems, payAwal)`, lists items, handles live timers.
- App: Manages adding sessions and synchronizing to Supabase/localStorage.

- [ ] **Step 1: Create src/components/DashboardTab.jsx**
  Implement new rental form, item selection grid (with image urls), search, and listing cards with custom blinking class timers.
  
  ```javascript
  import React, { useState, useEffect } from 'react';
  import { ITEMS, fmtRp, fmtDur } from '../App';

  function DashboardTab({ activeSessions, onStartSewa, getImgUrl }) {
    const [inputNama, setInputNama] = useState('');
    const [payAwal, setPayAwal] = useState('cash');
    const [selectedQty, setSelectedQty] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [sessionDurations, setSessionDurations] = useState({});

    // Live counter update loop
    useEffect(() => {
      const updateTimers = () => {
        const updated = {};
        activeSessions.forEach(s => {
          const sec = Math.floor((Date.now() - s.startTime) / 1000);
          updated[s.id] = sec;
        });
        setSessionDurations(updated);
      };
      updateTimers();
      const interval = setInterval(updateTimers, 1000);
      return () => clearInterval(interval);
    }, [activeSessions]);

    const changeQty = (code, delta) => {
      setSelectedQty(prev => {
        const val = Math.max(0, (prev[code] || 0) + delta);
        return { ...prev, [code]: val };
      });
    };

    const handleStart = () => {
      const nama = inputNama.trim();
      if (!nama) { alert('Masukkan nama penyewa!'); return; }
      const items = ITEMS.filter(i => (selectedQty[i.code] || 0) > 0)
                         .map(i => ({ code: i.code, qty: selectedQty[i.code] }));
      if (items.length === 0) { alert('Pilih minimal satu item!'); return; }
      
      onStartSewa(nama, items, payAwal);
      
      // Reset form
      setInputNama('');
      setPayAwal('cash');
      setSelectedQty({});
    };

    const filteredSessions = activeSessions
      .filter(s => s.nama.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => b.startTime - a.startTime);

    return (
      <div id="tab-dashboard" className="tab-pane active">
        <div className="row g-3">
          <div className="col-12 col-lg-5 d-flex flex-column">
            <div className="panel flex-fill">
              <div className="panel-head"><i className="bi bi-plus-circle-fill clr-yellow"></i><span>Sewa Baru</span></div>
              <div className="panel-body">
                <label className="field-label">Nama Penyewa</label>
                <div className="input-ico-wrap mb-3">
                  <i className="bi bi-person-fill ico"></i>
                  <input 
                    type="text" 
                    value={inputNama} 
                    onChange={(e) => setInputNama(e.target.value)} 
                    className="cfield" 
                    placeholder="Masukkan nama penyewa..." 
                  />
                </div>
                <label className="field-label mb-2">Metode Bayar Awal (Tarif Pokok)</label>
                <div className="pay-awal-selector mb-3">
                  <label className="pay-awal-opt">
                    <input 
                      type="radio" 
                      name="payAwal" 
                      checked={payAwal === 'cash'} 
                      onChange={() => setPayAwal('cash')} 
                    />
                    <span><i class="bi bi-cash-stack me-1"></i>Cash</span>
                  </label>
                  <label className="pay-awal-opt">
                    <input 
                      type="radio" 
                      name="payAwal" 
                      checked={payAwal === 'qris'} 
                      onChange={() => setPayAwal('qris')} 
                    />
                    <span><i class="bi bi-qr-code-scan me-1"></i>QRIS</span>
                  </label>
                </div>
                <label className="field-label mb-2">Pilih Item &amp; Jumlah</label>
                <div className="row row-cols-2 row-cols-sm-3 g-2 mb-3">
                  {ITEMS.map(item => {
                    const qty = selectedQty[item.code] || 0;
                    const img = getImgUrl(item.code) || item.defaultImg;
                    const priceLabel = item.isPackage ? `Paket ${item.packageHours}jam ${fmtRp(item.priceHour)}` : `${fmtRp(item.priceHour)}/jam`;
                    return (
                      <div className="col" key={item.code}>
                        <div className={`item-card ${qty > 0 ? 'selected' : ''}`}>
                          <div className="item-img-box">
                            <img src={img} alt={item.name} onError={(e) => { e.target.parentElement.innerHTML = `<div style="font-size:2rem">${item.emoji}</div>` }} />
                          </div>
                          <div className="item-code">{item.code}</div>
                          <div className="item-name">{item.name}</div>
                          <div className="item-price">{priceLabel}</div>
                          <div className="qty-control">
                            <button className="qty-btn minus" onClick={() => changeQty(item.code, -1)}>−</button>
                            <span className="qty-val">{qty}</span>
                            <button className="qty-btn" onClick={() => changeQty(item.code, 1)}>+</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="btn-start w-100" onClick={handleStart}>
                  <i className="bi bi-play-circle-fill me-2"></i>Mulai Sewa Sekarang
                </button>
              </div>
            </div>
          </div>
          
          <div className="col-12 col-lg-7 d-flex flex-column">
            <div className="panel flex-fill">
              <div className="panel-head">
                <i className="bi bi-people-fill clr-cyan"></i><span>Penyewa Aktif</span>
                <span className="ms-auto aktif-count">{activeSessions.length}</span>
              </div>
              <div className="panel-body">
                <div className="input-ico-wrap mb-3">
                  <i className="bi bi-search ico"></i>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="cfield" 
                    placeholder="Cari nama penyewa..." 
                  />
                </div>
                <div className="aktif-scroll">
                  {filteredSessions.length === 0 ? (
                    <div className="empty-box"><i className="bi bi-hourglass-split"></i><p>Belum ada penyewa aktif</p></div>
                  ) : (
                    filteredSessions.map(s => {
                      const elapsedSec = sessionDurations[s.id] || 0;
                      // Determine status dot
                      const pkgItem = s.items.find(it => {
                        const d = ITEMS.find(item => item.code === it.code);
                        return d && d.isPackage;
                      });
                      const pkgHours = pkgItem ? ITEMS.find(item => item.code === pkgItem.code).packageHours : 1;
                      const limitMin = pkgItem ? pkgHours * 60 : 60;
                      const overMin = (elapsedSec / 60) - limitMin;
                      
                      let dotClass = 'dot dot-ok';
                      if (overMin > 25) dotClass = 'dot dot-hot';
                      else if (overMin > 10) dotClass = 'dot dot-warn';

                      return (
                        <div className="aktif-card" key={s.id}>
                          <div className="d-flex align-items-center justify-content-between mb-1 gap-2" style={{ minWidth: 0 }}>
                            <div className="aktif-name" style={{ marginBottom: 0 }}>
                              <i className="bi bi-person-fill me-1 clr-cyan"></i>{s.nama}
                            </div>
                            <span className={`aktif-pay-badge ${s.payAwal}`}>
                              <i className={`bi ${s.payAwal === 'qris' ? 'bi-qr-code-scan' : 'bi-cash-stack'}`}></i>
                              {s.payAwal.toUpperCase()}
                            </span>
                          </div>
                          <div className="item-tags">
                            {s.items.map(it => (
                              <span className="itag" key={it.code}>{it.code}×{it.qty}</span>
                            ))}
                          </div>
                          <div className="aktif-meta">
                            <span className="aktif-start-lbl">
                              <i className="bi bi-clock me-1"></i>
                              {new Date(s.startTime).toTimeString().slice(0,5)}
                            </span>
                            <span className="aktif-timer">{fmtDur(elapsedSec)}</span>
                          </div>
                          <div className="aktif-footer">
                            <button className="btn-selesai" onClick={() => alert('Checkout click')}>
                              <i className="bi bi-stop-circle-fill me-1"></i>Selesai &amp; Bayar
                            </button>
                            <button className="btn-qr-aktif"><i className="bi bi-qr-code"></i></button>
                            <button className="btn-edit-aktif"><i className="bi bi-pencil-fill"></i></button>
                            <span className={dotClass}></span>
                          </div>
                        </div>
                      );
                    })
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
  ```

- [ ] **Step 2: Update App.jsx routing and render DashboardTab**
  Mount `DashboardTab` and implement `handleStartSewa`.
  
  ```javascript
  // Add this inside App.jsx
  const handleStartSewa = (nama, items, payAwal) => {
    const newQueueNo = shiftQueueNo + 1;
    setShiftQueueNo(newQueueNo);
    localStorage.setItem('kw_shiftQNo', newQueueNo);

    const session = {
      id: Math.random().toString(36).substring(2, 11),
      nama,
      items,
      startTime: Date.now(),
      payAwal,
      queueNo: newQueueNo
    };

    const updated = [...activeSessions, session];
    setActiveSessions(updated);
    localStorage.setItem('kw_sessions', JSON.stringify(updated));

    // Supabase push logic (async)
    sb.from('active_sessions').upsert({
      id: session.id,
      nama: session.nama,
      items: session.items,
      start_time: session.startTime,
      pay_awal: session.payAwal
    }).then(() => console.log('Sewa saved to Supabase'));
  };

  const getImgUrl = (code) => localStorage.getItem('kw_img_' + code);
  ```

- [ ] **Step 3: Test render App.jsx with DashboardTab**
  Run: `npm run build`
  Expected: Clean compilation.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/DashboardTab.jsx src/App.jsx
  git commit -m "feat: implement DashboardTab new rental form and live cards"
  ```

---

### Task 5: Setup Tab Layout and Footer Navigation Bar

**Files:**
- Create: `src/components/FooterNav.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- FooterNav: Consumes `activeTab`, `activeCount`, `onTabChange(tabName)`
- App: Mounts the FooterNav at the bottom and toggles activeTab.

- [ ] **Step 1: Create src/components/FooterNav.jsx**
  Implement footer-nav structure using bootstrap icons.
  
  ```javascript
  import React from 'react';

  function FooterNav({ activeTab, onTabChange, activeCount }) {
    return (
      <nav className="footer-nav">
        <button 
          className={`fnav-btn ${activeTab === 'dashboard' ? 'active' : ''}`} 
          onClick={() => onTabChange('dashboard')}
        >
          <div className="fnav-ico-wrap">
            <i className="bi bi-grid-1x2-fill"></i>
            <span className={`fnav-badge ${activeCount === 0 ? 'd-none' : ''}`}>{activeCount}</span>
          </div>
          <span className="fnav-label">Sewa &amp; Aktif</span>
        </button>
        
        <button 
          className={`fnav-btn ${activeTab === 'riwayat' ? 'active' : ''}`} 
          onClick={() => onTabChange('riwayat')}
        >
          <div className="fnav-ico-wrap">
            <i className="bi bi-clock-history"></i>
          </div>
          <span className="fnav-label">Riwayat</span>
        </button>

        <button 
          className={`fnav-btn ${activeTab === 'pengaturan' ? 'active' : ''}`} 
          onClick={() => onTabChange('pengaturan')}
        >
          <div className="fnav-ico-wrap">
            <i className="bi bi-gear-fill"></i>
          </div>
          <span className="fnav-label">Pengaturan</span>
        </button>
      </nav>
    );
  }

  export default FooterNav;
  ```

- [ ] **Step 2: Mount FooterNav in App.jsx**
  Update the JSX markup inside `App.jsx` to render `DashboardTab`, tab panes, and `FooterNav`.
  
  ```javascript
  // Update App.jsx return block:
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
              <div className="shift-indicator d-flex" onClick={handleLogout}>
                <span className="shift-dot"></span>
                <span>{currentShiftUser}</span>
                <i className="bi bi-box-arrow-right ms-1" style={{ fontSize: '.75rem', opacity: .6 }}></i>
              </div>
              <div className="text-end">
                <div className="clock-time">{liveTime}</div>
                <div className="clock-date d-none d-sm-block">{liveDate}</div>
              </div>
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
          />
        )}
        {activeTab === 'riwayat' && (
          <div className="panel p-4 text-center">Riwayat Tab (Task selanjutnya)</div>
        )}
        {activeTab === 'pengaturan' && (
          <div className="panel p-4 text-center">Pengaturan Tab (Task selanjutnya)</div>
        )}
      </div>

      <FooterNav 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        activeCount={activeSessions.length} 
      />
    </div>
  );
  ```

- [ ] **Step 3: Run dev build**
  Run: `npm run build`
  Expected: Compile completes successfully.

- [ ] **Step 4: Commit**
  ```bash
  git add src/components/FooterNav.jsx src/App.jsx
  git commit -m "feat: add footer navigation and active tabs routing"
  ```

---

### Task 6: Add Calculation & Payment Modals

**Files:**
- Create: `src/components/CalculateRentalModal.jsx`
- Create: `src/components/PaymentModal.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- CalculateRentalModal: Calculates OT with 10:59 mins tolerance. Triggers PaymentModal.
- PaymentModal: Accepts cash / qris / split amounts, calculates change, adds to transaction array and triggers window.print().

- [ ] **Step 1: Create src/components/CalculateRentalModal.jsx**
  Implement the exact OT logic (overMin < 11 means tolerance, otherwise OT cost is calculated). Add tolerance checkbox toggle and manual discount adjustment buttons.
  
  ```javascript
  import React, { useState, useEffect } from 'react';
  import { ITEMS, fmtRp, fmtDur } from '../App';

  function CalculateRentalModal({ session, onClose, onProceedPayment }) {
    const elapsed = Math.floor((Date.now() - session.startTime) / 1000);
    const elapsedMin = elapsed / 60;

    const [itemsCalc, setItemsCalc] = useState([]);
    const [manualAdj, setManualAdj] = useState(0);

    useEffect(() => {
      const initial = session.items.map(it => {
        const def = ITEMS.find(item => item.code === it.code);
        const limitMin = def && def.isPackage ? def.packageHours * 60 : 60;
        
        let otFull = 0, otHalf = 0;
        const actualOver = elapsedMin - limitMin;
        if (Math.floor(actualOver) >= 11) {
          const cycles = Math.floor(actualOver / 60);
          const remainder = actualOver % 60;
          otFull = cycles;
          if (remainder > 10 && remainder <= 40) otHalf = 1;
          else if (remainder > 40) otFull += 1;
        }

        const otCost = (otFull * def.priceOT60 + otHalf * def.priceOT30) * it.qty;

        return {
          ...it,
          def,
          limitMin,
          baseCost: def.priceHour * it.qty,
          otFullCount: otFull,
          otHalfCount: otHalf,
          otCost: otCost,
          tolOn: false,
          bakFull: otFull,
          bakHalf: otHalf,
          bakCost: otCost
        };
      });
      setItemsCalc(initial);
    }, [session, elapsedMin]);

    const handleTolToggle = (idx, checked) => {
      setItemsCalc(prev => prev.map((it, i) => {
        if (i !== idx) return it;
        return {
          ...it,
          tolOn: checked,
          otFullCount: checked ? 0 : it.bakFull,
          otHalfCount: checked ? 0 : it.bakHalf,
          otCost: checked ? 0 : it.bakCost
        };
      }));
    };

    const adjustOTQty = (idx, field, delta) => {
      setItemsCalc(prev => prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it };
        updated[field] = Math.max(0, updated[field] + delta);
        updated.otCost = (updated.otFullCount * updated.def.priceOT60 + updated.otHalfCount * updated.def.priceOT30) * updated.qty;
        return updated;
      }));
    };

    const baseSum = itemsCalc.reduce((sum, it) => sum + it.baseCost, 0);
    const otSum = itemsCalc.reduce((sum, it) => sum + (it.tolOn ? 0 : it.otCost), 0);
    const grandOT = Math.max(0, otSum + manualAdj);

    const isOT = itemsCalc.some(it => Math.floor(elapsedMin - it.limitMin) >= 11);
    const maxOver = Math.max(...itemsCalc.map(it => {
      const o = elapsedMin - it.limitMin;
      return Math.floor(o) >= 11 ? o : 0;
    }));

    const handleProceed = () => {
      const otStr = itemsCalc
        .filter(it => !it.tolOn && (it.otFullCount > 0 || it.otHalfCount > 0))
        .map(it => `${it.code}(${it.otFullCount > 0 ? it.otFullCount + '×1j' : ''}${it.otHalfCount > 0 ? (it.otFullCount > 0 ? '+' : '') + it.otHalfCount + '×½j' : ''})`)
        .join(', ');
      
      const otDurStr = itemsCalc
        .filter(it => !it.tolOn && (it.otFullCount > 0 || it.otHalfCount > 0))
        .map(it => `${it.code}:${it.otFullCount * 60 + it.otHalfCount * 30}m`)
        .join(', ');

      const calculatedData = {
        session,
        itemsCalc,
        base: baseSum,
        ot: otSum,
        tol: manualAdj !== 0 ? -manualAdj : 0,
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
                    const otLabel = [];
                    if (it.otFullCount > 0) otLabel.push(`${it.otFullCount}× 1Jam (${fmtRp(it.def.priceOT60 * it.qty * it.otFullCount)})`);
                    if (it.otHalfCount > 0) otLabel.push(`${it.otHalfCount}× ½Jam (${fmtRp(it.def.priceOT30 * it.qty * it.otHalfCount)})`);
                    
                    let overStatus = '';
                    if (overMin <= 0) overStatus = 'Normal';
                    else if (Math.floor(overMin) < 11) overStatus = `Over ${Math.floor(overMin)}m — toleransi`;
                    else overStatus = `Over ${Math.floor(overMin)}m`;

                    return (
                      <div className={`breakdown-item ${it.tolOn ? 'item-tolerated' : ''}`} key={it.code}>
                        <div className="d-flex justify-content-between align-items-start gap-2">
                          <div className="flex-fill">
                            <div className="bi-name">{it.code} - {it.def.name} ×{it.qty}</div>
                            <div className="small text-secondary mb-1">{overStatus}</div>
                            <div className={`ot-auto-detail ${it.tolOn ? 'ot-detail-striked' : ''}`}>
                              {otLabel.length > 0 ? otLabel.join(' + ') : 'Tidak ada overtime'}
                            </div>
                            {!it.tolOn && overMin > 0 && (
                              <div className="ot-manual-row mt-2">
                                <span className="ot-manual-lbl">1 Jam: </span>
                                <button className="ot-count-btn" onClick={() => adjustOTQty(idx, 'otFullCount', -1)}>−</button>
                                <span className="mx-2">{it.otFullCount}</span>
                                <button className="ot-count-btn" onClick={() => adjustOTQty(idx, 'otFullCount', 1)}>+</button>
                                <span className="ot-manual-lbl ms-3">½ Jam: </span>
                                <button className="ot-count-btn" onClick={() => adjustOTQty(idx, 'otHalfCount', -1)}>−</button>
                                <span className="mx-2">{it.otHalfCount}</span>
                                <button className="ot-count-btn" onClick={() => adjustOTQty(idx, 'otHalfCount', 1)}>+</button>
                              </div>
                            )}
                            <label className="tol-toggle-label mt-2">
                              <input type="checkbox" checked={it.tolOn} onChange={(e) => handleTolToggle(idx, e.target.checked)} />
                              <span className="ms-2 small">Toleransi / Hapus OT</span>
                            </label>
                          </div>
                          <div className="text-end">
                            {it.tolOn ? (
                              <span className="badge bg-success">GRATIS</span>
                            ) : (
                              <span className="bi-price">{fmtRp(it.otCost)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grand-total-box mt-3">
                  <div className="gt-label">Total Tagihan Overtime</div>
                  <div className="gt-val">{fmtRp(grandOT)}</div>
                </div>

                <div className="total-all-box mt-2">
                  <div className="total-all-label">Total Biaya Keseluruhan</div>
                  <div className="total-all-val">{fmtRp(baseSum + grandOT)}</div>
                </div>

                <div className="manual-adj-box mt-3 p-2 border rounded">
                  <div className="small text-secondary mb-2">Koreksi Nominal Manual</div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-danger" onClick={() => setManualAdj(prev => prev - 5000)}>-5rb</button>
                    <span className="flex-grow-1 text-center align-self-center font-weight-bold">{fmtRp(manualAdj)}</span>
                    <button className="btn btn-sm btn-outline-success" onClick={() => setManualAdj(prev => prev + 5000)}>+5rb</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setManualAdj(0)}>Reset</button>
                  </div>
                </div>

                <div className="d-flex gap-2 mt-4">
                  <button className="btn-sec flex-fill" onClick={onClose}>Batal</button>
                  <button className="btn-start flex-fill" onClick={handleProceed}>
                    <i className="bi bi-credit-card-fill me-2"></i>Lanjut ke Pembayaran
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
  ```

- [ ] **Step 2: Create src/components/PaymentModal.jsx**
  Implement split / cash / qris payment interface, automatic change calculator, and print functions.
  
  ```javascript
  import React, { useState } from 'react';
  import { fmtRp } from '../App';

  function PaymentModal({ bayarData, onClose, onFinalize }) {
    const { grand, base, session } = bayarData;
    const isNoOT = grand === 0;

    const [payMode, setPayMode] = useState(isNoOT ? session.payAwal : 'cash');
    const [cashAmt, setCashAmt] = useState(grand);
    const [qrisAmt, setQrisAmt] = useState(0);

    const handleFinalize = () => {
      let finalCash = 0;
      let finalQris = 0;

      if (payMode === 'cash') {
        finalCash = grand;
      } else if (payMode === 'qris') {
        finalQris = grand;
      } else {
        finalCash = Number(cashAmt);
        finalQris = Number(qrisAmt);
        if (finalCash + finalQris !== grand) {
          alert(`Jumlah Split (${fmtRp(finalCash + finalQris)}) tidak sama dengan total tagihan (${fmtRp(grand)})!`);
          return;
        }
      }

      onFinalize(finalCash, finalQris);
    };

    const changeVal = Math.max(0, cashAmt - grand);

    return (
      <div className="modal show d-block" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content cmodal">
            <div className="modal-header cmodal-head">
              <h5 className="modal-title"><i className="bi bi-credit-card-fill me-2 clr-green"></i>Pembayaran</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body p-0">
              <div className="bayar-wrap" style={{ padding: '20px' }}>
                <div className="bayar-total-box text-center p-3 mb-3 border rounded">
                  <div className="bt-label">Total Tagihan (Overtime)</div>
                  <div className="bt-val font-weight-bold" style={{ fontSize: '1.8rem', color: 'var(--yellow)' }}>{fmtRp(grand)}</div>
                </div>

                <div className="pay-methods d-flex gap-2 justify-content-center mb-3">
                  <button 
                    disabled={isNoOT && session.payAwal !== 'cash'}
                    className={`btn flex-fill py-2 btn-outline-primary ${payMode === 'cash' ? 'active' : ''}`}
                    onClick={() => { setPayMode('cash'); setCashAmt(grand); setQrisAmt(0); }}
                  >
                    💵 Cash
                  </button>
                  <button 
                    disabled={isNoOT && session.payAwal !== 'qris'}
                    className={`btn flex-fill py-2 btn-outline-primary ${payMode === 'qris' ? 'active' : ''}`}
                    onClick={() => { setPayMode('qris'); setCashAmt(0); setQrisAmt(grand); }}
                  >
                    📱 QRIS
                  </button>
                  <button 
                    disabled={isNoOT}
                    className={`btn flex-fill py-2 btn-outline-primary ${payMode === 'split' ? 'active' : ''}`}
                    onClick={() => { setPayMode('split'); setCashAmt(Math.round(grand/2)); setQrisAmt(grand - Math.round(grand/2)); }}
                  >
                    💳 Split
                  </button>
                </div>

                {payMode === 'cash' && (
                  <div className="mb-3">
                    <label className="field-label">Jumlah Uang Cash Diterima</label>
                    <input 
                      type="number" 
                      className="cfield" 
                      style={{ paddingLeft: '12px' }}
                      value={cashAmt}
                      onChange={(e) => setCashAmt(Number(e.target.value))} 
                    />
                    <div className="kembalian-box mt-3 p-2 bg-success-subtle text-success rounded d-flex justify-content-between">
                      <span>Kembalian</span>
                      <strong>{fmtRp(changeVal)}</strong>
                    </div>
                  </div>
                )}

                {payMode === 'qris' && (
                  <div className="p-3 text-center border rounded mb-3">
                    <div style={{ fontSize: '2rem' }}>📱 Scan QRIS</div>
                    <div style={{ color: 'var(--yellow)', fontSize: '1.2rem' }}>{fmtRp(grand)}</div>
                  </div>
                )}

                {payMode === 'split' && (
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="field-label">💵 Cash</label>
                      <input 
                        type="number" 
                        className="cfield" 
                        style={{ paddingLeft: '12px' }}
                        value={cashAmt}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCashAmt(val);
                          setQrisAmt(grand - val);
                        }} 
                      />
                    </div>
                    <div className="col-6">
                      <label className="field-label">📱 QRIS</label>
                      <input 
                        type="number" 
                        className="cfield" 
                        style={{ paddingLeft: '12px' }}
                        value={qrisAmt}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setQrisAmt(val);
                          setCashAmt(grand - val);
                        }}
                      />
                    </div>
                  </div>
                )}

                <button className="btn-start w-100" onClick={handleFinalize}>
                  <i className="bi bi-check-circle-fill me-2"></i>Konfirmasi Pembayaran
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  export default PaymentModal;
  ```

- [ ] **Step 3: Integrate checkout callback and print function in App.jsx**
  Implement `printSelesai` and print triggering logic inside `/src/App.jsx`.
  
  ```javascript
  // Update App.jsx with checkout handling:
  const [activeCheckoutSession, setActiveCheckoutSession] = useState(null);
  const [activePaymentData, setActivePaymentData] = useState(null);

  const handleProceedPayment = (calculatedData) => {
    setActiveCheckoutSession(null);
    setActivePaymentData(calculatedData);
  };

  const handleFinalizePayment = (cash, qris) => {
    const { session, itemsCalc, base, ot, tol, grand, otStr, otDurStr, elapsed, endTime } = activePaymentData;
    const itemStr = session.items.map(i => `${i.code}×${i.qty}`).join(', ');
    
    const txn = {
      id: session.id,
      no: transactions.length + 1,
      queueNo: session.queueNo || 0,
      nama: session.nama,
      tanggal: todayStr(),
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

    const newTxns = [...transactions, txn];
    setTransactions(newTxns);
    localStorage.setItem('kw_txns', JSON.stringify(newTxns));

    const newSessions = activeSessions.filter(s => s.id !== session.id);
    setActiveSessions(newSessions);
    localStorage.setItem('kw_sessions', JSON.stringify(newSessions));

    // Print receipt
    const autoPrintSelesai = localStorage.getItem('kw_printSelesai') === 'true';
    if (autoPrintSelesai) {
      triggerPrintReceipt(txn);
    }

    // Sync DB
    sb.from('active_sessions').delete().eq('id', session.id).then(() => {
      sb.from('transactions').insert({
        id: txn.id,
        no: txn.no,
        nama: txn.nama,
        tanggal: txn.tanggal,
        start_time: txn.startTime,
        end_time: txn.endTime,
        items: txn.items,
        ot: txn.ot,
        ot_dur: txn.otDur,
        total_base: txn.totalBase,
        total_ot: txn.totalOT,
        total_tol: txn.totalTol,
        grand_total: txn.grandTotal,
        total_all: txn.totalAll,
        pay_awal: txn.payAwal,
        cash: txn.cash,
        qris: txn.qris,
        shift: txn.shift
      }).then(() => console.log('Transaction logged to Supabase'));
    });

    setActivePaymentData(null);
  };

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const triggerPrintReceipt = (txn) => {
    const trackUrl = window.location.href.split('#')[0] + '#track/' + txn.id;
    const durSec = Math.floor((txn.endTime - txn.startTime) / 1000);
    const html = `
      <div class="receipt-mono">
        <div class="rc rb" style="font-size:13px">EVREN HOUSE</div>
        <div class="rc">Scooter &amp; Stroller</div>
        <div class="rc">Struk Selesai Sewa</div>
        <hr>
        <div>Queue Number: ${txn.queueNo || 0}</div>
        <div>No: ${txn.no} | ${new Date(txn.endTime).toLocaleDateString('id-ID')}</div>
        <div>Nama: ${txn.nama}</div>
        <div>Shift: ${txn.shift || '-'}</div>
        <div>Mulai: ${new Date(txn.startTime).toTimeString().slice(0,5)} | Selesai: ${new Date(txn.endTime).toTimeString().slice(0,5)}</div>
        <div>Durasi: ${fmtDur(durSec)}</div>
        <hr>
        <div>Item: ${txn.items}</div>
        ${txn.ot !== '-' ? `<div>OT: ${txn.ot}</div>` : ''}
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

    const area = document.getElementById('printArea');
    if (!area) return;
    area.innerHTML = html;
    area.style.display = 'block';

    setTimeout(() => {
      const qrEl = area.querySelector('#printQrCode');
      if (qrEl && typeof QRCode !== 'undefined') {
        new QRCode(qrEl, { text: trackUrl, width: 120, height: 120 });
      }
      setTimeout(() => {
        window.print();
        area.style.display = 'none';
      }, 500);
    }, 100);
  };
  ```

- [ ] **Step 4: Update DashboardTab Trigger Callback**
  Modify `/src/components/DashboardTab.jsx`'s selesai sewa button onClick to invoke a callback prop `onSelesaiSewa(session)`.
  Update in App.jsx to render CalculateRentalModal on selection.
  
  ```javascript
  // App.jsx JSX changes
  {activeCheckoutSession && (
    <CalculateRentalModal 
      session={activeCheckoutSession} 
      onClose={() => setActiveCheckoutSession(null)} 
      onProceedPayment={handleProceedPayment} 
    />
  )}
  {activePaymentData && (
    <PaymentModal 
      bayarData={activePaymentData} 
      onClose={() => setActivePaymentData(null)} 
      onFinalize={handleFinalizePayment} 
    />
  )}
  ```

- [ ] **Step 5: Run dev build**
  Run: `npm run build`
  Expected: Success.

- [ ] **Step 6: Commit**
  ```bash
  git add src/components/CalculateRentalModal.jsx src/components/PaymentModal.jsx src/components/DashboardTab.jsx src/App.jsx
  git commit -m "feat: implement overtime calculations and checkout payment modals"
  ```

---

### Task 6: History Tab and Settings Tab

**Files:**
- Create: `src/components/HistoryTab.jsx`
- Create: `src/components/SettingsTab.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- HistoryTab: Consumes `transactions`, renders date filter, summary statistics (totals of Cash, QRIS, grand total), and supports excel exports.
- SettingsTab: Handles dark/light theme, admin pass edit, manual Sync push/pull.

- [ ] **Step 1: Create src/components/HistoryTab.jsx**
  Implement filters, transaction table layout, edit/delete actions triggers, and XLSX sheet generation.
  
  ```javascript
  import React, { useState } from 'react';
  import { fmtRp } from '../App';

  function HistoryTab({ transactions, onDeleteTxn }) {
    const today = new Date().toISOString().slice(0, 10);
    const [filterDate, setFilterDate] = useState(today);

    const filtered = transactions.filter(t => t.tanggal === filterDate);

    const totalPokok = filtered.reduce((s, t) => s + (t.totalBase || 0), 0);
    const totalPokokCash = filtered.reduce((s, t) => s + (t.payAwal === 'cash' ? (t.totalBase || 0) : 0), 0);
    const totalPokokQris = filtered.reduce((s, t) => s + (t.payAwal === 'qris' ? (t.totalBase || 0) : 0), 0);
    const totalTambahan = filtered.reduce((s, t) => s + (t.totalOT || 0), 0);
    const totalOTCash = filtered.reduce((s, t) => s + (t.cash || 0), 0);
    const totalOTQris = filtered.reduce((s, t) => s + (t.qris || 0), 0);

    const totalCashAll = totalPokokCash + totalOTCash;
    const totalQrisAll = totalPokokQris + totalOTQris;
    const grandTotal = totalPokok + totalTambahan;

    const handleExport = () => {
      if (filtered.length === 0) { alert('Tidak ada data untuk diexport'); return; }
      const dataRows = filtered.map(t => ({
        No: t.no, Nama: t.nama, Shift: t.shift, Tanggal: t.tanggal,
        Mulai: new Date(t.startTime).toTimeString().slice(0,5),
        Selesai: new Date(t.endTime).toTimeString().slice(0,5),
        Items: t.items, OT: t.ot, 'Durasi OT': t.otDur,
        Pokok: t.totalBase, 'OT Cost': t.totalOT, 'Grand Total': t.totalAll,
        'Metode Pokok': t.payAwal, 'Bayar Cash': t.cash, 'Bayar QRIS': t.qris
      }));
      const ws = window.XLSX.utils.json_to_sheet(dataRows);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');
      window.XLSX.writeFile(wb, `EvrenHouse_${filterDate}.xlsx`);
    };

    return (
      <div id="tab-riwayat" className="tab-pane active">
        <div className="panel">
          <div className="panel-head flex-wrap gap-2">
            <i className="bi bi-clock-history clr-green"></i><span>Riwayat Transaksi</span>
            <div className="ms-auto d-flex gap-2 flex-wrap align-items-center">
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="cfield-sm" 
              />
              <button className="btn-export" onClick={handleExport}><i className="bi bi-download me-1"></i>Export</button>
            </div>
          </div>
          <div className="panel-body">
            <div className="row g-2 mb-3">
              <div className="col-6 col-sm-2"><div className="sum-card"><div class="sum-label">Transaksi</div><div class="sum-val">{filtered.length}</div></div></div>
              <div className="col-6 col-sm-2"><div className="sum-card"><div class="sum-label">Total Pokok</div><div class="sum-val">{fmtRp(totalPokok)}</div></div></div>
              <div className="col-6 col-sm-2"><div className="sum-card"><div class="sum-label">Total Tambahan</div><div class="sum-val clr-orange">{fmtRp(totalTambahan)}</div></div></div>
              <div className="col-6 col-sm-2"><div className="sum-card"><div class="sum-label">Total Cash</div><div class="sum-val clr-green">{fmtRp(totalCashAll)}</div></div></div>
              <div className="col-6 col-sm-2"><div className="sum-card"><div class="sum-label">Total QRIS</div><div class="sum-val clr-cyan">{fmtRp(totalQrisAll)}</div></div></div>
              <div className="col-6 col-sm-2"><div className="sum-card"><div class="sum-label">Grand Total</div><div class="sum-val clr-yellow">{fmtRp(grandTotal)}</div></div></div>
            </div>
            
            <div className="table-responsive">
              <table className="ctable">
                <thead>
                  <tr>
                    <th>No</th><th>Nama</th><th>Shift</th><th>Waktu</th><th>Item</th><th>Grand Total</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan="7" className="text-center text-secondary py-4">Tidak ada transaksi</td></tr>
                  ) : (
                    filtered.map((t, idx) => (
                      <tr key={t.id}>
                        <td>{idx + 1}</td>
                        <td><strong>{t.nama}</strong></td>
                        <td><span className="badge-shift">{t.shift}</span></td>
                        <td>{new Date(t.startTime).toTimeString().slice(0,5)} - {new Date(t.endTime).toTimeString().slice(0,5)}</td>
                        <td>{t.items}</td>
                        <td><span style={{ fontWeight: 800, color: 'var(--yellow)' }}>{fmtRp(t.totalAll)}</span></td>
                        <td>
                          <button className="act-btn" onClick={() => onDeleteTxn(t.id)}><i className="bi bi-trash3-fill clr-red"></i></button>
                        </td>
                      </tr>
                    ))
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
  ```

- [ ] **Step 2: Create src/components/SettingsTab.jsx**
  Implement theme toggle, manual sync buttons, edit admin password interface, and the footer labels showing version (`1.2.0`) & deploy date (`14 Jul 2026`).
  
  ```javascript
  import React, { useState } from 'react';

  const APP_VERSION = '1.2.0';
  const DEPLOY_DATE = '14 Jul 2026';

  function SettingsTab({ theme, onThemeChange, adminPassword, onUpdateAdminPassword, onSyncPull, onSyncPush }) {
    const [newPassInput, setNewPassInput] = useState('');

    const handleChangePass = () => {
      const p = newPassInput.trim();
      if (!p) return;
      onUpdateAdminPassword(p);
      setNewPassInput('');
    };

    return (
      <div id="tab-pengaturan" className="tab-pane active">
        <div className="row g-3">
          <div className="col-12">
            <div className="panel">
              <div className="panel-head"><span>Koneksi Supabase</span></div>
              <div className="panel-body">
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-info" onClick={onSyncPull}>Tarik Data Cloud</button>
                  <button className="btn btn-info" onClick={onSyncPush}>Kirim Data Cloud</button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="panel">
              <div className="panel-head"><i className="bi bi-palette-fill clr-yellow"></i><span>Tampilan</span></div>
              <div className="panel-body">
                <div className="toggle-row d-flex justify-content-between align-items-center">
                  <div>
                    <div style={{ fontWeight: 700 }}>Mode Tampilan</div>
                    <div className="small text-secondary">{theme === 'dark' ? 'Mode Gelap aktif' : 'Mode Terang aktif'}</div>
                  </div>
                  <div className="theme-seg d-flex">
                    <button className={`theme-seg-btn btn ${theme === 'light' ? 'active' : ''}`} onClick={() => onThemeChange('light')}>Light</button>
                    <button className={`theme-seg-btn btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => onThemeChange('dark')}>Dark</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12">
            <div className="panel">
              <div className="panel-head"><i className="bi bi-shield-lock-fill clr-red"></i><span>Password Admin</span></div>
              <div className="panel-body">
                <p className="text-secondary small mb-2">Current: <code>{adminPassword}</code></p>
                <div className="input-group">
                  <input 
                    type="password" 
                    value={newPassInput}
                    onChange={(e) => setNewPassInput(e.target.value)}
                    className="cfield flex-fill" 
                    placeholder="Password baru..." 
                  />
                  <button className="btn-sec ms-2" onClick={handleChangePass}>Ubah</button>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 mt-3 border-top pt-3 text-secondary d-flex justify-content-between small">
            <span><i className="bi bi-code-slash me-1"></i>v{APP_VERSION}</span>
            <span><i className="bi bi-clock-history me-1"></i>Last deploy: {DEPLOY_DATE}</span>
          </div>
        </div>
      </div>
    );
  }

  export default SettingsTab;
  ```

- [ ] **Step 3: Hook up tabs in App.jsx**
  Mount `HistoryTab` and `SettingsTab` in `App.jsx`, implement delete handler and password-check state logic.
  
  ```javascript
  // App.jsx integration
  const handleDeleteTxn = (id) => {
    if (window.confirm('Hapus transaksi ini?')) {
      const updated = transactions.filter(t => t.id !== id);
      setTransactions(updated);
      localStorage.setItem('kw_txns', JSON.stringify(updated));
      sb.from('transactions').delete().eq('id', id).then(() => console.log('Deleted from Supabase'));
    }
  };

  const handleUpdateAdminPassword = (newPass) => {
    setAdminPassword(newPass);
    localStorage.setItem('kw_pass', newPass);
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('kw_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };
  ```

- [ ] **Step 4: Run dev build**
  Run: `npm run build`
  Expected: Clean build without errors.

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/HistoryTab.jsx src/components/SettingsTab.jsx src/App.jsx
  git commit -m "feat: add HistoryTab and SettingsTab components"
  ```

---

### Task 7: Production Build Check and Vercel Deploy

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: All React components, main config files.
- Produces: Complete static compiled output in `dist/` directory.

- [ ] **Step 1: Test Compile local build**
  Run: `npm run build`
  Expected: Successful compilation.

- [ ] **Step 2: Deploy to Vercel production**
  Run: `vercel --prod`
  Expected: aliased to `https://project-9kxf4.vercel.app` successfully.

- [ ] **Step 3: Commit**
  ```bash
  git commit -am "chore: finalize react migration and production deploy check"
  ```
