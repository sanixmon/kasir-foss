# 🛴 Kasir Sheet — Scooter & Stroller Rental POS System ⚡

[![Build & Test](https://img.shields.io/badge/tests-49%20passed-brightgreen.svg)](https://github.com/sanixmon/kasir-sheet)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff.svg)](https://vitejs.dev/)
[![Backend](https://img.shields.io/badge/Backend-Google%20Apps%20Script-34a853.svg)](https://developers.google.com/apps-script)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A high-performance, real-time **Point of Sale (POS) & Rental Tracking System** designed specifically for scooter, stroller, and equipment rental businesses. Built with **React 19, Vite, and Google Sheets (via Google Apps Script API)** as a serverless database.

---

## ✨ Key Features

### ⏱️ Live Rental Tracking & Precise Overtime (OT) Engine
- **Real-Time Duration Timers:** Displays elapsed time for all active rentals with visual status badges (Normal, Overtime, Grace Period, and Zombie Session warning > 8 hrs).
- **Mathematical Grace Period:** Automatic 10-minute 59-second free grace period before applying overtime penalties.
- **Tiered Overtime Calculation:** Automatically computes Half-Hour OT (11–40 mins) and Full-Hour OT (41–60 mins) across single or multi-hour overdue durations.
- **Manual Adjustments & Tolerances:** Allows cashiers to adjust or waive overtime items directly during checkout.

### 🔄 Dynamic Partial Returns & Split Billing
- Supports partial returns for group rentals (e.g., returning 1 scooter out of 3 rented).
- Calculates exact overtime and base costs for returned items while keeping the remaining items active on the rental timer.

### 📊 Google Sheets Serverless Database & Caching
- **Google Apps Script Integration:** Fully synchronized with Google Sheets (`ActiveSessions`, `Transactions`, `Users`, `Settings`).
- **Low-Latency Polling:** Fast 5-second polling with script-side caching (2s TTL) and `LockService` concurrency safety to prevent race conditions.
- **Offline-First Local Storage Fallback:** Gracefully caches state locally and auto-prunes storage upon quota limits.

### 🌅 Shift & Rollover Management
- **Deterministic 6 AM Shift Rollover:** Late-night transactions (00:00–05:59 AM) are automatically grouped into the correct shift date.
- **Daily Queue Numbering:** Automated queue numbering per shift day.
- **Multi-Role Access Control:** Separate roles for Cashiers and Administrators.

### 🧾 QR Code Receipts & Thermal Printing
- **Live Customer Tracking:** Generates shareable QR codes linked to live customer-facing tracking pages (`#track/<id>`).
- **Print Receipt Ready:** Instant HTML formatting tailored for thermal receipt printers (Start Receipt & Completion Receipt).

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 + Vite 6 |
| **Styling System** | Custom Vanilla CSS (Design Tokens, Dark/Light Mode) |
| **Backend & Database** | Google Apps Script (GAS) + Google Sheets |
| **State & Storage** | React Hooks + LocalStorage Buffer |
| **Testing Suite** | Vitest + React Testing Library (49 Unit & Component Tests) |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Package Manager**: `pnpm` (recommended), `npm`, or `yarn`

### 1. Clone & Install
```bash
git clone https://github.com/sanixmon/kasir-sheet.git
cd kasir-sheet
pnpm install
```

### 2. Run Development Server
```bash
pnpm dev
```
Open `http://localhost:5173` in your browser.

### 3. Run Test Suite
```bash
pnpm test
```

### 4. Build for Production
```bash
pnpm build
```

---

## ⚙️ Google Apps Script (GAS) Setup

To connect this frontend to your own Google Sheet:

1. Open your Google Sheet (`ActiveSessions`, `Transactions`, `Users`, `Settings`).
2. Go to **Extensions > Apps Script**.
3. Copy the content of [`docs/google-apps-script/Code.gs`](docs/google-apps-script/Code.gs) into your Apps Script editor.
4. Click **Deploy > New Deployment**.
5. Select Type: **Web App**.
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the generated Web App URL into your `src/App.jsx` API endpoint configuration.

---

## 📁 Project Structure

```
kasir-sheet/
├── docs/
│   └── google-apps-script/
│       ├── Code.gs             # Complete Apps Script backend code
│       └── README.md           # Apps Script API documentation
├── src/
│   ├── __tests__/              # Vitest suite (49 passing tests)
│   ├── components/             # React UI Components
│   │   ├── CalculateRentalModal.jsx
│   │   ├── DashboardTab.jsx
│   │   ├── HistoryTab.jsx
│   │   ├── QRCodeModal.jsx
│   │   └── TrackingPage.jsx
│   ├── lib/                    # Business Logic (ot.js, history.js, etc.)
│   ├── App.jsx                 # Core Application Controller & State
│   └── index.css               # Design Tokens & Theming
└── package.json
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*Developed with ❤️ for high-reliability rental operations.*
