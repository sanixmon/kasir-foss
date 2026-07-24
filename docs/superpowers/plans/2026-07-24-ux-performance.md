# UX & Performance Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the real-time clock to its own component to prevent whole-app re-renders, and add physical interaction feedback via CSS scaling and transitions.

**Architecture:** A new `LiveClock` component will encapsulate the clock state and interval. `index.css` will receive global micro-animation tokens for all interactive elements.

**Tech Stack:** React, Vanilla CSS

## Global Constraints
- Exact file paths always.
- Strictly adhere to TDD; mandatory Red-Green-Refactor cycle where applicable (for UI rendering/integration).
- Maintain existing codebase styles and class naming conventions.

---

### Task 1: Extract LiveClock Component

**Files:**
- Create: `src/components/LiveClock.jsx`
- Modify: `src/App.jsx`
- Create: `src/__tests__/LiveClock.test.jsx`

**Interfaces:**
- Consumes: Standard React hooks (`useState`, `useEffect`).
- Produces: `<LiveClock />` component.

- [ ] **Step 1: Write the failing test for LiveClock**
```jsx
// src/__tests__/LiveClock.test.jsx
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LiveClock from '../components/LiveClock';

describe('LiveClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24, 10, 30, 0)); // July 24, 2026 10:30:00
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders time and updates every second', () => {
    render(<LiveClock />);
    expect(screen.getByText('10:30:00')).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText('10:30:01')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run src/__tests__/LiveClock.test.jsx`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement LiveClock**
```jsx
// src/components/LiveClock.jsx
import React, { useState, useEffect } from 'react';

function LiveClock() {
  const [time, setTime] = useState('00:00:00');
  const [date, setDate] = useState('—');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toTimeString().slice(0, 8));
      const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
      const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
      setDate(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="clock-box ms-auto d-flex flex-column align-items-end justify-content-center px-3" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
      <div className="clock-time">{time}</div>
      <div className="clock-date d-none d-sm-block">{date}</div>
    </div>
  );
}

export default LiveClock;
```

- [ ] **Step 4: Verify test passes**
Run: `npx vitest run src/__tests__/LiveClock.test.jsx`
Expected: PASS

- [ ] **Step 5: Integrate LiveClock into App.jsx**
Remove the `liveTime` and `liveDate` state from `App.jsx`, and remove the interval logic. Replace the HTML rendering of the clock with `<LiveClock />`.

```diff
// src/App.jsx
+ import LiveClock from './components/LiveClock';

// Remove these states
-  const [liveTime, setLiveTime] = useState('00:00:00');
-  const [liveDate, setLiveDate] = useState('—');

// In useEffect:
-    const updateTime = () => {
-      const now = new Date();
-      setLiveTime(now.toTimeString().slice(0, 8));
-      const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
-      const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
-      setLiveDate(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`);
-    };
-    updateTime();
-    const timer = setInterval(updateTime, 1000);

// In cleanup:
-      clearInterval(timer);

// In the JSX (Header area):
-              <div className="clock-box ms-auto d-flex flex-column align-items-end justify-content-center px-3" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
-                <div className="clock-time">{liveTime}</div>
-                <div className="clock-date d-none d-sm-block">{liveDate}</div>
-              </div>
+              <LiveClock />
```

- [ ] **Step 6: Run full test suite to ensure no regressions**
Run: `npm run test`
Expected: PASS

- [ ] **Step 7: Commit**
```bash
git add src/components/LiveClock.jsx src/App.jsx src/__tests__/LiveClock.test.jsx
git commit -m "perf: extract LiveClock to prevent global re-renders"
```

---

### Task 2: Add CSS Micro-Animations

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Existing UI components relying on `.btn`, `.act-btn`, `.sum-card`, `.rental-card`.

- [ ] **Step 1: Write CSS additions**
Add interactive tactile feedback to the stylesheet.

```css
/* Add to src/index.css at the end of the file */

/* ── Micro-Animations & Interaction Feedback ── */

/* Buttons */
.btn, .btn-start, .btn-sec, .act-btn, .nav-item {
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  cursor: pointer;
}

.btn:active, .btn-start:active, .btn-sec:active, .act-btn:active {
  transform: scale(0.95);
  opacity: 0.9;
}

.btn:hover, .btn-start:hover, .btn-sec:hover {
  filter: brightness(1.1);
}

/* Cards */
.rental-card, .sum-card, .hist-card {
  transition: all 0.25s cubic-bezier(0.25, 0.8, 0.25, 1);
  cursor: pointer;
}

.rental-card:active, .sum-card:active, .hist-card:active {
  transform: scale(0.98);
}

.rental-card:hover {
  box-shadow: 0 8px 16px rgba(0,0,0,0.3);
  border-color: rgba(255, 255, 255, 0.2);
}
```

- [ ] **Step 2: Commit**
```bash
git add src/index.css
git commit -m "ui: add tactile micro-animations and hover states"
```
