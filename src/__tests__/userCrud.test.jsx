import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LoginPage from '../components/LoginPage';
import { saveUser, deleteUser, fetchAllData, setApiUrl } from '../api';

describe('User / Cashier CRUD API Unit Tests', () => {
  const mockApiUrl = 'https://script.google.com/macros/s/TEST_SCRIPT_ID/exec';

  beforeEach(() => {
    setApiUrl(mockApiUrl);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('CREATE / UPDATE: saveUser calls POST with save_user action and user credentials', async () => {
    const mockResponse = { success: true };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse
    });

    const result = await saveUser('budi', 'kasir123', 'cashier');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      mockApiUrl,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_user',
          payload: { username: 'budi', password: 'kasir123', role: 'cashier' }
        })
      })
    );
    expect(result).toEqual({ success: true });
  });

  it('READ: fetchAllData retrieves user list with custom passwords along with sessions and transactions', async () => {
    const mockCloudData = {
      sessions: [],
      transactions: [],
      users: [
        { username: 'admin', password: 'adminPass', role: 'admin' },
        { username: 'budi', password: 'kasir123', role: 'cashier' }
      ]
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockCloudData
    });

    const data = await fetchAllData();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(data.users).toHaveLength(2);
    expect(data.users.find(u => u.username === 'budi')).toEqual({ username: 'budi', password: 'kasir123', role: 'cashier' });
  });

  it('UPDATE: saveUser updates existing user credentials and role', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    const result = await saveUser('budi', 'newpassword999', 'admin');

    expect(fetch).toHaveBeenCalledWith(
      mockApiUrl,
      expect.objectContaining({
        body: JSON.stringify({
          action: 'save_user',
          payload: { username: 'budi', password: 'newpassword999', role: 'admin' }
        })
      })
    );
    expect(result.success).toBe(true);
  });

  it('DELETE: deleteUser calls POST with delete_user action and target username', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    const result = await deleteUser('budi');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      mockApiUrl,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'delete_user',
          payload: { username: 'budi' }
        })
      })
    );
    expect(result).toEqual({ success: true });
  });

  it('LOGIN SYSTEM: LoginPage validates against custom password inputted from Admin Menu instead of default password', async () => {
    const mockOnLogin = vi.fn();
    const api = await import('../api');
    vi.spyOn(api, 'loginCashier').mockImplementation(async (username, password) => {
      if (username.toLowerCase() === 'rani' && password === 'customPassword123') {
        return { success: true, user: { username: 'rani', role: 'cashier' }, token: 'token-123' };
      }
      return { success: false, error: 'Password shift tidak sesuai!' };
    });

    render(<LoginPage onLogin={mockOnLogin} />);
    
    // Type username & try default password
    const usernameInput = screen.getByPlaceholderText('Ketik nama kasir...');
    const passwordInput = screen.getByPlaceholderText('Password shift...');
    const loginButton = screen.getByText('Mulai Shift');

    fireEvent.change(usernameInput, { target: { value: 'Rani' } }); // case-insensitive match
    fireEvent.change(passwordInput, { target: { value: 'jayalahevren' } }); // attempt default password
    fireEvent.click(loginButton);

    // Should reject default password when custom password is set
    expect(await screen.findByText('Password shift tidak sesuai!')).toBeInTheDocument();
    expect(mockOnLogin).not.toHaveBeenCalled();

    // Enter correct custom password
    fireEvent.change(passwordInput, { target: { value: 'customPassword123' } });
    fireEvent.click(loginButton);

    expect(await screen.findByText(/EVREN HOUSE/)).toBeInTheDocument();
    expect(mockOnLogin).toHaveBeenCalledWith('rani');
  });

  it('LOGIN SYSTEM: LoginPage falls back to default password only when password is not set in DB', async () => {
    const mockOnLogin = vi.fn();
    const api = await import('../api');
    vi.spyOn(api, 'loginCashier').mockImplementation(async (username, password) => {
      if (username.toLowerCase() === 'akbar' && password === 'jayalahevren') {
        return { success: true, user: { username: 'akbar', role: 'cashier' }, token: 'token-123' };
      }
      return { success: false, error: 'Password shift tidak sesuai!' };
    });

    render(<LoginPage onLogin={mockOnLogin} />);

    const usernameInput = screen.getByPlaceholderText('Ketik nama kasir...');
    const passwordInput = screen.getByPlaceholderText('Password shift...');
    const loginButton = screen.getByText('Mulai Shift');

    fireEvent.change(usernameInput, { target: { value: 'akbar' } });
    fireEvent.change(passwordInput, { target: { value: 'jayalahevren' } });
    fireEvent.click(loginButton);

    expect(await screen.findByText(/EVREN HOUSE/)).toBeInTheDocument();
    expect(mockOnLogin).toHaveBeenCalledWith('akbar');
  });
});
