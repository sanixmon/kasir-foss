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
  loginCashier: vi.fn().mockImplementation((username, password) => {
    if (username === 'andre' && password === 'andre') {
      return Promise.resolve({ success: true, token: 'mock-cashier-token', user: { username: 'andre', role: 'cashier' } });
    }
    return Promise.resolve({ success: false, error: 'Nama kasir atau password salah.' });
  }),
  loginAdmin: vi.fn().mockImplementation((password) => {
    if (password === 'admin123') {
      return Promise.resolve({ success: true, token: 'mock-admin-token' });
    }
    return Promise.resolve({ success: false, error: 'Password admin tidak sesuai.' });
  }),
  fetchOutlets: vi.fn().mockResolvedValue([
    { id: 'outlet-pusat', nama: 'Outlet Pusat' },
    { id: 'outlet-cabang', nama: 'Outlet Cabang' }
  ]),
  setAuthToken: vi.fn(),
  setActiveOutletId: vi.fn(),
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
    vi.clearAllMocks();
  });

  it('renders without error when cashier logs in as andre', async () => {
    render(<App />);

    // In streamlined single-step login portal, cashier fields are rendered directly
    const nameInput = await screen.findByPlaceholderText(/Ketik nama kasir/i);
    const passInput = screen.getByPlaceholderText(/Password shift/i);

    // Verify mobile keyboard optimizations
    expect(nameInput.getAttribute('autoCapitalize')).toBe('none');
    expect(nameInput.getAttribute('autoCorrect')).toBe('off');
    expect(nameInput.getAttribute('spellCheck')).toBe('false');

    fireEvent.change(nameInput, { target: { value: 'andre' } });
    fireEvent.change(passInput, { target: { value: 'andre' } });

    const loginBtn = screen.getByText(/Mulai Shift/i);
    fireEvent.click(loginBtn);

    // Main App header should show EVREN HOUSE
    await waitFor(() => {
      expect(screen.getByText('EVREN HOUSE')).toBeDefined();
    });
  });

  it('allows switching to Admin portal and logging in', async () => {
    render(<App />);

    // Switch to Admin mode
    const adminTab = screen.getByText(/Portal Admin/i);
    fireEvent.click(adminTab);

    // Admin password input should appear with mobile keyboard optimizations
    const adminPassInput = await screen.findByPlaceholderText(/Masukkan Password Admin/i);
    expect(adminPassInput.getAttribute('autoCapitalize')).toBe('none');
    expect(adminPassInput.getAttribute('autoCorrect')).toBe('off');
    expect(adminPassInput.getAttribute('spellCheck')).toBe('false');

    fireEvent.change(adminPassInput, { target: { value: 'admin123' } });
    const adminSubmitBtn = screen.getByText(/Masuk Portal Admin/i);
    fireEvent.click(adminSubmitBtn);

    await waitFor(() => {
      expect(screen.getByText('EVREN HOUSE')).toBeDefined();
    });
  });

  it('shows error message on validation failure', async () => {
    render(<App />);

    const loginBtn = screen.getByText(/Mulai Shift/i);
    fireEvent.click(loginBtn);

    expect(await screen.findByText(/Ketik nama kasir terlebih dahulu!/i)).toBeDefined();
  });
});
