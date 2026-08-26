import { useState, useCallback } from 'react';
import { getShiftDate, checkShiftExpiration } from '../../../lib/shift';
import { setAuthToken, clearEscalationToken, loginAdmin } from '../../../api';
import { swalError } from '../../../lib/swal';

/**
 * Custom hook for managing authentication, role selection, shift user lifecycle, and logout confirmation.
 */
export function useAuthSession(options = {}) {
  const { onSessionCleared } = options;

  const [currentShiftUser, setCurrentShiftUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('kw_currentUser');
      if (!savedUser) return null;
      const shiftDate = localStorage.getItem('kw_shiftDate');
      const currentShiftDate = getShiftDate();
      if (shiftDate && checkShiftExpiration(shiftDate, currentShiftDate)) {
        return null;
      }
      return savedUser;
    } catch {
      return null;
    }
  });

  const [currentUserRole, setCurrentUserRole] = useState(() => {
    try {
      const savedUser = localStorage.getItem('kw_currentUser');
      const savedRole = localStorage.getItem('kw_userRole');
      const shiftDate = localStorage.getItem('kw_shiftDate');
      const currentShiftDate = getShiftDate();
      if (savedRole === 'cashier' && savedUser && shiftDate && checkShiftExpiration(shiftDate, currentShiftDate)) {
        return null;
      }
      if (savedRole === 'cashier' && !savedUser) {
        return null;
      }
      return savedRole || null;
    } catch {
      return null;
    }
  });

  const [activeOutletId, setActiveOutletIdState] = useState(() => {
    try {
      return localStorage.getItem('kw_activeOutletId') || null;
    } catch {
      return null;
    }
  });

  const setActiveOutletId = useCallback((id) => {
    setActiveOutletIdState(id || null);
    try {
      if (id) localStorage.setItem('kw_activeOutletId', id);
      else localStorage.removeItem('kw_activeOutletId');
    } catch { /* ignore */ }
  }, []);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutConfirmName, setLogoutConfirmName] = useState('');

  // Authenticated = completed login (admin, or cashier with an active shift user).
  const isAuthenticated = currentUserRole === 'admin' || (currentUserRole === 'cashier' && !!currentShiftUser);

  const handleLogin = useCallback((user, outletId) => {
    const cName = user.charAt(0).toUpperCase() + user.slice(1);
    setCurrentShiftUser(cName);
    localStorage.setItem('kw_currentUser', cName);
    setCurrentUserRole('cashier');
    localStorage.setItem('kw_userRole', 'cashier');

    const shiftDate = getShiftDate();
    localStorage.setItem('kw_shiftDate', shiftDate);

    if (outletId) {
      setActiveOutletIdState(outletId);
      try {
        localStorage.setItem('kw_activeOutletId', outletId);
      } catch { /* ignore */ }
    }
  }, []);

  const selectCashierRole = useCallback(() => {
    setCurrentUserRole('cashier');
    localStorage.setItem('kw_userRole', 'cashier');
  }, []);

  const selectAdminRole = useCallback(async (pwd) => {
    try {
      const res = await loginAdmin(pwd);
      if (res?.success) {
        setAuthToken(res.token);
        setCurrentUserRole('admin');
        localStorage.setItem('kw_userRole', 'admin');
        return { success: true };
      } else {
        swalError('Password Salah', res?.error || 'Password admin tidak sesuai.');
        return { success: false, error: res?.error };
      }
    } catch (e) {
      swalError('Koneksi Gagal', 'Tidak dapat terhubung ke server.');
      return { success: false, error: e };
    }
  }, []);

  const resetRole = useCallback(() => {
    setCurrentUserRole(null);
    localStorage.removeItem('kw_userRole');
  }, []);

  const handleLogout = useCallback(() => {
    setLogoutConfirmName('');
    setShowLogoutConfirm(true);
  }, []);

  const clearSessionState = useCallback(() => {
    setAuthToken(null);
    clearEscalationToken();
    localStorage.removeItem('kw_currentUser');
    localStorage.removeItem('kw_shiftQNo');
    localStorage.removeItem('kw_userRole');
    localStorage.removeItem('kw_activeOutletId');
    setCurrentShiftUser(null);
    setCurrentUserRole(null);
    setActiveOutletIdState(null);
    if (typeof onSessionCleared === 'function') {
      onSessionCleared();
    }
  }, [onSessionCleared]);

  const doLogout = useCallback(() => {
    if (logoutConfirmName.trim().toLowerCase() !== (currentShiftUser || '').toLowerCase()) {
      return false;
    }
    clearSessionState();
    setShowLogoutConfirm(false);
    return true;
  }, [logoutConfirmName, currentShiftUser, clearSessionState]);

  return {
    isAuthenticated,
    currentUserRole,
    currentShiftUser,
    activeOutletId,
    setActiveOutletId,
    setCurrentUserRole,
    setCurrentShiftUser,
    handleLogin,
    selectCashierRole,
    selectAdminRole,
    resetRole,
    handleLogout,
    clearSessionState,
    doLogout,
    showLogoutConfirm,
    setShowLogoutConfirm,
    logoutConfirmName,
    setLogoutConfirmName
  };
}
