import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthSession } from '../useAuthSession';
import { getShiftDate } from '../../../../lib/shift';
import * as api from '../../../../api';
import * as swal from '../../../../lib/swal';

vi.mock('../../../../api', () => ({
  loginAdmin: vi.fn(),
  setAuthToken: vi.fn(),
  clearEscalationToken: vi.fn()
}));

vi.mock('../../../../lib/swal', () => ({
  swalError: vi.fn()
}));

describe('useAuthSession Hook Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes as unauthenticated when localStorage is empty', () => {
    const { result } = renderHook(() => useAuthSession());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.currentUserRole).toBe(null);
    expect(result.current.currentShiftUser).toBe(null);
  });

  it('restores authenticated state for valid existing cashier session', () => {
    localStorage.setItem('kw_currentUser', 'Budi');
    localStorage.setItem('kw_userRole', 'cashier');
    localStorage.setItem('kw_shiftDate', getShiftDate());

    const { result } = renderHook(() => useAuthSession());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.currentUserRole).toBe('cashier');
    expect(result.current.currentShiftUser).toBe('Budi');
  });

  it('restores admin session without shift user', () => {
    localStorage.setItem('kw_userRole', 'admin');

    const { result } = renderHook(() => useAuthSession());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.currentUserRole).toBe('admin');
  });

  it('handles cashier login flow', () => {
    const { result } = renderHook(() => useAuthSession());

    act(() => {
      result.current.selectCashierRole();
    });
    expect(result.current.currentUserRole).toBe('cashier');
    expect(result.current.isAuthenticated).toBe(false); // No shift user yet

    act(() => {
      result.current.handleLogin('budi');
    });
    expect(result.current.currentShiftUser).toBe('Budi');
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem('kw_currentUser')).toBe('Budi');
  });

  it('handles admin login flow', async () => {
    api.loginAdmin.mockResolvedValue({ success: true, token: 'admin-jwt' });

    const { result } = renderHook(() => useAuthSession());

    let loginRes;
    await act(async () => {
      loginRes = await result.current.selectAdminRole('secretAdmin');
    });

    expect(loginRes.success).toBe(true);
    expect(api.setAuthToken).toHaveBeenCalledWith('admin-jwt');
    expect(result.current.currentUserRole).toBe('admin');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('rejects wrong admin password', async () => {
    api.loginAdmin.mockResolvedValue({ success: false, error: 'Password salah' });

    const { result } = renderHook(() => useAuthSession());

    let loginRes;
    await act(async () => {
      loginRes = await result.current.selectAdminRole('wrongPass');
    });

    expect(loginRes.success).toBe(false);
    expect(swal.swalError).toHaveBeenCalledWith('Password Salah', 'Password salah');
    expect(result.current.currentUserRole).toBe(null);
  });

  it('clearSessionState wipes auth token, escalation token, and local storage', () => {
    const onSessionCleared = vi.fn();
    localStorage.setItem('kw_currentUser', 'Budi');
    localStorage.setItem('kw_userRole', 'cashier');
    localStorage.setItem('kw_shiftQNo', '3');

    const { result } = renderHook(() => useAuthSession({ onSessionCleared }));

    act(() => {
      result.current.clearSessionState();
    });

    expect(api.setAuthToken).toHaveBeenCalledWith(null);
    expect(api.clearEscalationToken).toHaveBeenCalled();
    expect(result.current.currentUserRole).toBe(null);
    expect(result.current.currentShiftUser).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('kw_currentUser')).toBe(null);
    expect(localStorage.getItem('kw_userRole')).toBe(null);
    expect(onSessionCleared).toHaveBeenCalled();
  });

  it('doLogout requires matching username before logging out', () => {
    localStorage.setItem('kw_currentUser', 'Budi');
    localStorage.setItem('kw_userRole', 'cashier');

    const { result } = renderHook(() => useAuthSession());

    act(() => {
      result.current.handleLogout();
    });
    expect(result.current.showLogoutConfirm).toBe(true);

    // Mismatched name -> fails
    act(() => {
      result.current.setLogoutConfirmName('Joko');
    });
    let logoutSuccess;
    act(() => {
      logoutSuccess = result.current.doLogout();
    });
    expect(logoutSuccess).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);

    // Matched name -> succeeds
    act(() => {
      result.current.setLogoutConfirmName('budi');
    });
    act(() => {
      logoutSuccess = result.current.doLogout();
    });
    expect(logoutSuccess).toBe(true);
    expect(result.current.showLogoutConfirm).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('manages activeOutletId state and saves to localStorage', () => {
    const { result } = renderHook(() => useAuthSession());

    act(() => {
      result.current.setActiveOutletId('outlet-pusat');
    });
    expect(result.current.activeOutletId).toBe('outlet-pusat');
    expect(localStorage.getItem('kw_activeOutletId')).toBe('outlet-pusat');

    act(() => {
      result.current.handleLogin('budi', 'outlet-cabang');
    });
    expect(result.current.activeOutletId).toBe('outlet-cabang');
    expect(localStorage.getItem('kw_activeOutletId')).toBe('outlet-cabang');

    act(() => {
      result.current.clearSessionState();
    });
    expect(result.current.activeOutletId).toBe(null);
    expect(localStorage.getItem('kw_activeOutletId')).toBe(null);
  });
});
