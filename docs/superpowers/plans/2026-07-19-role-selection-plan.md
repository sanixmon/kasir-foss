# Role Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a first-layer authentication screen to differentiate between Cashier and Admin logins.

**Architecture:** A new `RoleSelection` component intercepts the app startup. `App.jsx` stores `currentUserRole`. Admins enter a password to bypass shift login, while cashiers proceed to the normal shift login. The Settings tab is restricted to Admins.

**Tech Stack:** React, Vitest/Testing Library

## Global Constraints

- NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
- Exact file paths always

---

### Task 1: Create RoleSelection Component

**Files:**
- Create: `src/components/RoleSelection.jsx`
- Create: `src/__tests__/RoleSelection.test.jsx`

**Interfaces:**
- Consumes: None
- Produces: `RoleSelection(props: { onSelectCashier: (), onSelectAdmin: (password) })`

- [ ] **Step 1: Write the failing test**

```javascript
// src/__tests__/RoleSelection.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoleSelection from '../components/RoleSelection';

describe('RoleSelection Component', () => {
  it('calls onSelectCashier when Portal Kasir is clicked', () => {
    const onSelectCashier = vi.fn();
    render(<RoleSelection onSelectCashier={onSelectCashier} onSelectAdmin={() => {}} />);
    fireEvent.click(screen.getByText(/Portal Kasir/i));
    expect(onSelectCashier).toHaveBeenCalledTimes(1);
  });

  it('shows password prompt when Portal Admin is clicked and calls onSelectAdmin on submit', () => {
    const onSelectAdmin = vi.fn();
    render(<RoleSelection onSelectCashier={() => {}} onSelectAdmin={onSelectAdmin} />);
    
    // Initial state: password input not visible
    expect(screen.queryByPlaceholderText(/Masukkan Password Admin/i)).toBeNull();
    
    // Click Admin
    fireEvent.click(screen.getByText(/Portal Admin/i));
    
    // Password input appears
    const input = screen.getByPlaceholderText(/Masukkan Password Admin/i);
    fireEvent.change(input, { target: { value: 'secret' } });
    
    // Submit
    fireEvent.click(screen.getByText(/Masuk/i));
    expect(onSelectAdmin).toHaveBeenCalledWith('secret');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/RoleSelection.test.jsx`
Expected: FAIL with "Failed to resolve import" or similar.

- [ ] **Step 3: Write minimal implementation**

```javascript
// src/components/RoleSelection.jsx
import React, { useState } from 'react';

export default function RoleSelection({ onSelectCashier, onSelectAdmin }) {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [password, setPassword] = useState('');

  return (
    <div className="login-container d-flex align-items-center justify-content-center" style={{ minHeight: '100vh', background: 'var(--bg-color)' }}>
      <div className="card p-4 shadow-sm" style={{ maxWidth: '400px', width: '100%', background: 'var(--surface-color)' }}>
        <h3 className="text-center mb-4">EVREN HOUSE</h3>
        
        {!showAdminLogin ? (
          <div className="d-flex flex-column gap-3">
            <button className="btn btn-primary btn-lg w-100" onClick={onSelectCashier}>
              🛍️ Portal Kasir
            </button>
            <button className="btn btn-outline-secondary btn-lg w-100" onClick={() => setShowAdminLogin(true)}>
              🛡️ Portal Admin
            </button>
          </div>
        ) : (
          <div>
            <h5 className="mb-3">Login Admin</h5>
            <input 
              type="password" 
              className="form-control mb-3" 
              placeholder="Masukkan Password Admin"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSelectAdmin(password)}
              autoFocus
            />
            <div className="d-flex gap-2">
              <button className="btn btn-secondary w-50" onClick={() => setShowAdminLogin(false)}>Kembali</button>
              <button className="btn btn-primary w-50" onClick={() => onSelectAdmin(password)}>Masuk</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/RoleSelection.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/RoleSelection.test.jsx src/components/RoleSelection.jsx
git commit -m "feat: add RoleSelection component with TDD"
```

---

### Task 2: Integrate RoleSelection into App.jsx

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/__tests__/App.test.jsx` (we will create a basic mock test if it doesn't exist, but since App.jsx is huge and typically requires complex mocks, we will implement the logic carefully and manually verify the integration. Wait, rule is NO PRODUCTION CODE WITHOUT A FAILING TEST. We must write an integration test for App routing).

Let's write a targeted test for `App.jsx` role routing logic. Since testing `App.jsx` fully is hard due to Supabase, we will test the routing flow by mocking Supabase.

**Interfaces:**
- Consumes: `RoleSelection` component.

- [ ] **Step 1: Write the failing test**

```javascript
// src/__tests__/AppRouting.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

// Mock Supabase to prevent actual network calls during render
vi.mock('../supabase', () => ({
  sb: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn()
    })),
    removeChannel: vi.fn()
  }
}));

describe('App Routing based on Role', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows RoleSelection initially, clicking Kasir shows LoginPage', () => {
    render(<App />);
    expect(screen.getByText(/Portal Kasir/i)).toBeDefined();
    
    fireEvent.click(screen.getByText(/Portal Kasir/i));
    // LoginPage should appear (it has a text "Mulai Shift")
    expect(screen.getByText(/Mulai Shift/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/AppRouting.test.jsx`
Expected: FAIL because App currently goes straight to `LoginPage`.

- [ ] **Step 3: Write minimal implementation**

Edit `src/App.jsx`.

1. Import `RoleSelection`:
`import RoleSelection from './components/RoleSelection';` (Around line 10)

2. Add `currentUserRole` state (Around line 55):
```javascript
  const [currentUserRole, setCurrentUserRole] = useState(null);
```

3. Initialize it in `useEffect` (Around line 124):
```javascript
    const savedUser = localStorage.getItem('kw_currentUser');
    if (savedUser) setCurrentShiftUser(savedUser);
    const savedRole = localStorage.getItem('kw_userRole');
    if (savedRole) setCurrentUserRole(savedRole);
```

4. Modify `handleLogout` (Around line 94):
```javascript
  const handleLogout = () => {
    if (window.confirm(`Akhiri sesi / shift saat ini?`)) {
      localStorage.removeItem('kw_currentUser');
      localStorage.removeItem('kw_shiftQNo');
      localStorage.removeItem('kw_userRole');
      setShiftQueueNo(0);
      setCurrentShiftUser(null);
      setCurrentUserRole(null);
    }
  };
```

5. Modify the rendering logic at the very bottom (Around line 942):
Replace:
```javascript
  if (!currentShiftUser) {
    return <LoginPage onLogin={handleLogin} />;
  }
```
With:
```javascript
  if (!currentUserRole) {
    return (
      <RoleSelection 
        onSelectCashier={() => {
          setCurrentUserRole('cashier');
          localStorage.setItem('kw_userRole', 'cashier');
        }}
        onSelectAdmin={(pwd) => {
          if (pwd === adminPassword) {
            setCurrentUserRole('admin');
            localStorage.setItem('kw_userRole', 'admin');
          } else {
            alert('Password salah!');
          }
        }}
      />
    );
  }

  if (currentUserRole === 'cashier' && !currentShiftUser) {
    return (
      <div>
        <div className="p-2"><button className="btn btn-sm btn-outline-secondary" onClick={() => { setCurrentUserRole(null); localStorage.removeItem('kw_userRole'); }}>&larr; Ganti Role</button></div>
        <LoginPage onLogin={handleLogin} />
      </div>
    );
  }
```

6. Restrict Settings tab for Cashier (Around line 1016):
```javascript
        {activeTab === 'pengaturan' && currentUserRole === 'admin' && (
          <SettingsTab ... />
        )}
        {activeTab === 'pengaturan' && currentUserRole === 'cashier' && (
          <div className="text-center mt-5">
            <h4>Akses Ditolak</h4>
            <p>Hanya Admin yang dapat mengakses Pengaturan.</p>
          </div>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/AppRouting.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/__tests__/AppRouting.test.jsx
git commit -m "feat: integrate RoleSelection and admin auth into App routing"
```
