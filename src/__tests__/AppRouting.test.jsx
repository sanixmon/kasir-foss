import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

// Mock API layer to prevent actual network calls during render
vi.mock('../api', () => ({
  fetchAllData: vi.fn().mockResolvedValue({ sessions: [], transactions: [], serverTime: Date.now() }),
  addSession: vi.fn(),
  editSession: vi.fn(),
  claimSession: vi.fn(),
  deleteSession: vi.fn()
}));

describe('App Routing based on Role', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows RoleSelection initially, clicking Kasir shows LoginPage', async () => {
    render(<App />);
    expect(screen.getByText(/Portal Kasir/i)).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByText(/Portal Kasir/i));
    });
    // LoginPage should appear (it has a text "Mulai Shift")
    expect(screen.getByText(/Mulai Shift/i)).toBeDefined();
  });
});
