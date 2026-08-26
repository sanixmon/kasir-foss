import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

// Mock API layer to prevent actual network calls during render
vi.mock('../api', () => ({
  fetchAllData: vi.fn().mockResolvedValue({ sessions: [], transactions: [], serverTime: Date.now() }),
  fetchOutlets: vi.fn().mockResolvedValue([]),
  loginCashier: vi.fn().mockResolvedValue({ success: true, token: 'tok' }),
  loginAdmin: vi.fn().mockResolvedValue({ success: true, token: 'tok' }),
  setAuthToken: vi.fn(),
  setActiveOutletId: vi.fn(),
  addSession: vi.fn(),
  editSession: vi.fn(),
  claimSession: vi.fn(),
  deleteSession: vi.fn()
}));

describe('App Routing based on Role', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders single-step LoginPage portal initially', async () => {
    render(<App />);
    expect(screen.getByText(/Portal Kasir/i)).toBeDefined();
    expect(screen.getByText(/Portal Admin/i)).toBeDefined();
    expect(screen.getByText(/Mulai Shift/i)).toBeDefined();
  });
});
