import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

vi.mock('../api', () => ({
  fetchAllData: vi.fn().mockResolvedValue({
    sessions: [],
    transactions: [],
    users: [
      { username: 'andre', password: 'andre', role: 'cashier' }
    ]
  }),
  addSession: vi.fn(),
  editSession: vi.fn(),
  claimSession: vi.fn(),
  deleteSession: vi.fn(),
  deleteTxn: vi.fn(),
  clearAllTxns: vi.fn(),
  verifyAdminPassword: vi.fn(),
  changeAdminPassword: vi.fn(),
  addDeletionLog: vi.fn(),
  getDeletionLogs: vi.fn().mockResolvedValue({ logs: [] })
}));

describe('Cashier Login Flow', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders without error when cashier logs in as andre', async () => {
    render(<App />);
    
    // Select Portal Kasir
    const kasirBtn = screen.getByText(/Portal Kasir/i);
    fireEvent.click(kasirBtn);

    // Wait for LoginPage
    const nameInput = await screen.findByPlaceholderText(/Ketik nama kasir/i);
    const passInput = screen.getByPlaceholderText(/Password shift/i);

    fireEvent.change(nameInput, { target: { value: 'andre' } });
    fireEvent.change(passInput, { target: { value: 'andre' } });

    const loginBtn = screen.getByText(/Mulai Shift/i);
    fireEvent.click(loginBtn);

    // Main App header should show EVREN HOUSE
    await waitFor(() => {
      expect(screen.getByText('EVREN HOUSE')).toBeDefined();
    });
  });
});
