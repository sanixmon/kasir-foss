# Clean Modern POS UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Kasir FOSS UI from an arcade/toy-like neon aesthetic into a clean, modern, professional enterprise POS interface and eliminate dead/phantom features.

**Architecture:** Refactor CSS design tokens to modern Slate/Zinc palette, streamline login into a single-step responsive portal, modularize POS dashboard and active session cards with tabular typography, purge unused Google Sheets and custom URL prompts, and verify end-to-end.

**Tech Stack:** React 19, CSS Custom Properties (Design Tokens), Bootstrap Icons, Vitest / Testing Library.

## Global Constraints
- Modern, clean, minimal POS aesthetic (Slate/Zinc palette, no neon glow text-shadows, no bouncing cartoon animations).
- Single-step responsive login for mobile and desktop (`autoCapitalize="none"`, `autoCorrect="off"`, 44px touch targets).
- Purge all dead/phantom features (manual Google Sheets sync, custom image URL prompts, fake interval indicators).
- Zero regression in POS operations: active session timers, calculation, QR modal, receipts, multi-outlet SSE stream.

---

### Task 1: Modern Professional POS Design System & CSS Tokens
**Files:**
- Modify: `src/index.css`
- Test: `src/__tests__/AppRouting.test.jsx`

- [ ] **Step 1: Update design tokens and remove neon glow variables in `src/index.css`**
Replace neon cyan/pink/lime variables and glowing text-shadows with refined Slate/Zinc palette, subtle borders, crisp font hierarchy, and professional button styling.

- [ ] **Step 2: Run test suite to ensure CSS changes don't break component tests**
Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add src/index.css
git commit -m "style(theme): update design tokens to modern slate zinc enterprise POS system"
```

---

### Task 2: Streamlined Single-Step Login Portal
**Files:**
- Modify: `src/features/auth/components/LoginPage.jsx`
- Modify: `src/App.jsx`
- Test: `src/__tests__/CashierLogin.test.jsx`

- [ ] **Step 1: Refactor `LoginPage.jsx`**
Create a unified, responsive login card with outlet dropdown, cashier name, password, clean error alerts, mobile keyboard optimizations (`autoCapitalize="none"`, `autoCorrect="off"`), and direct Admin portal toggle.

- [ ] **Step 2: Update `App.jsx` authentication routing**
Bypass redundant `RoleSelection` splash screen and render clean `LoginPage` directly.

- [ ] **Step 3: Run cashier login tests**
Run: `npx vitest run src/__tests__/CashierLogin.test.jsx`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add src/features/auth/components/LoginPage.jsx src/App.jsx
git commit -m "feat(auth): streamline single-step login portal with mobile keyboard optimizations"
```

---

### Task 3: Professional POS Rental Starter & Active Session Timers
**Files:**
- Modify: `src/components/DashboardTab.jsx`
- Test: `src/__tests__/operationalWorkflow.test.js`

- [ ] **Step 1: Refactor `DashboardTab.jsx`**
Clean up item selection cards (clear pricing, touch-friendly increment/decrement, remove prompt image handlers), streamline customer name and payment method selection, and upgrade active session timer cards with tabular-numeric monospace duration and clean status badges (Normal, Overtime, Critical).

- [ ] **Step 2: Run operational workflow tests**
Run: `npx vitest run src/__tests__/operationalWorkflow.test.js`
Expected: PASS

- [ ] **Step 3: Commit**
```bash
git add src/components/DashboardTab.jsx
git commit -m "feat(pos): modernize rental starter and active session timer cards"
```

---

### Task 4: Clean History, Auditing, & Settings (Purge Phantom Features)
**Files:**
- Modify: `src/features/transactions/components/HistoryTab.jsx`
- Modify: `src/components/SettingsTab.jsx`
- Modify: `src/components/QRCodeModal.jsx`
- Test: `src/__tests__/HistoryTab.test.jsx`

- [ ] **Step 1: Clean `SettingsTab.jsx` & `QRCodeModal.jsx`**
Remove legacy Google Sheets cloud push/pull buttons, custom URL image prompt buttons, and fake sync indicators. Keep only actual functional settings (Admin password change, database backup & disaster recovery, user management, outlet management).

- [ ] **Step 2: Refine `HistoryTab.jsx`**
Ensure clean table typography, date/shift/outlet filtering, and instant thermal receipt printing.

- [ ] **Step 3: Run history and settings tests**
Run: `npx vitest run src/__tests__/HistoryTab.test.jsx`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add src/features/transactions/components/HistoryTab.jsx src/components/SettingsTab.jsx src/components/QRCodeModal.jsx
git commit -m "refactor(settings): purge legacy phantom cloud sync and dead image prompts"
```

---

### Task 5: Component Deduplication, Build & Live Deployment Verification
**Files:**
- Remove unused legacy duplicate components in `src/components/` that are superseded in `src/features/`
- Build & restart containers: `sudo docker compose up -d --build`
- Verify live deployment at `https://kasir.sanxmon.my.id`

- [ ] **Step 1: Run full test suite**
Run: `npm test`
Expected: 100% PASS

- [ ] **Step 2: Build frontend container & reload**
Run: `sudo docker compose up -d --build frontend`

- [ ] **Step 3: Verify live public endpoints**
Run: `curl -sI https://kasir.sanxmon.my.id/` and `curl -s https://kasir.sanxmon.my.id/ready`

- [ ] **Step 4: Commit and push**
```bash
git add .
git commit -m "feat(deploy): deploy modernized professional POS UI to production"
git push origin main
```
