let APPS_SCRIPT_URL = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APPS_SCRIPT_URL
  ? import.meta.env.VITE_APPS_SCRIPT_URL
  : '/api';

// Auth token is persisted so a page refresh / reopen does NOT force a re-login.
// The SQLite-backed token survives backend restarts; the browser survives refresh.
const AUTH_TOKEN_KEY = 'kw_authToken';

let authToken = (() => {
  try { return localStorage.getItem(AUTH_TOKEN_KEY) || null; } catch { return null; }
})();

// Short-lived admin escalation token (10 min) used for a single destructive
// action (e.g. cashier deleting a txn after admin re-verification). It is kept
// separate and NEVER replaces the main token, so the session isn't clobbered.
let escalationToken = null;

// Active outlet state for scoping requests
const ACTIVE_OUTLET_KEY = 'kw_activeOutletId';
let activeOutletId = (() => {
  try { return localStorage.getItem(ACTIVE_OUTLET_KEY) || null; } catch { return null; }
})();

export function setApiUrl(url) {
  APPS_SCRIPT_URL = url;
}

export function setAuthToken(token) {
  authToken = token || null;
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch { /* localStorage unavailable (private mode) — keep in-memory only */ }
}

export function getAuthToken() {
  return authToken;
}

export function setActiveOutletId(outletId) {
  activeOutletId = outletId || null;
  try {
    if (outletId) localStorage.setItem(ACTIVE_OUTLET_KEY, outletId);
    else localStorage.removeItem(ACTIVE_OUTLET_KEY);
  } catch { /* ignore */ }
}

export function getActiveOutletId() {
  return activeOutletId;
}

export function setEscalationToken(token) {
  escalationToken = token || null;
}

export function clearEscalationToken() {
  escalationToken = null;
}

function authHeaders() {
  const t = escalationToken || authToken;
  const headers = {};
  if (t) headers['Authorization'] = `Bearer ${t}`;
  if (activeOutletId && activeOutletId !== 'all') {
    headers['X-Outlet-ID'] = activeOutletId;
  }
  return headers;
}

export async function apiCall(action, payload = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({ action, payload }),
      signal: controller.signal
    });
    if (!response.ok) {
      let code = null;
      try {
        const body = await response.json();
        code = body?.code || null;
      } catch { /* non-JSON error body */ }
      const err = new Error(`HTTP error! status: ${response.status}`);
      err.status = response.status;
      err.code = code;
      throw err;
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`API call for action ${action} timed out after ${timeoutMs}ms`);
      return { error: 'Request timed out. Silakan coba lagi.' };
    }
    console.error(`API call failed for action ${action}:`, error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const fetchAllData = (timeoutMs = 8000) => apiCall('fetch_data', {}, timeoutMs);

export const addSession = (data) => apiCall('add_session', data);
export const editSession = (data) => apiCall('edit_session', data);
export const claimSession = (data) => apiCall('claim_session', data);
export const deleteSession = (id) => apiCall('delete_session', { id });
export const saveSetting = (key, value) => apiCall('save_setting', { key, value });
export const saveUser = (username, password, role) => apiCall('save_user', { username, password, role });
export const deleteUser = (username) => apiCall('delete_user', { username });
export const deleteTxn = (data) => apiCall('delete_txn', typeof data === 'object' ? data : { id: data });
export const clearAllTxns = () => apiCall('clear_all_txns');
export const verifyAdminPassword = (password) => apiCall('verify_admin', { password });
export const changeAdminPassword = (oldPassword, newPassword) => apiCall('change_admin_pass', { old_password: oldPassword, new_password: newPassword });
export const loginCashier = (username, password, outletId) => apiCall('login_cashier', { username, password, outletId });
export const loginAdmin = (password) => apiCall('login_admin', { password });
export const trackSession = (id) => apiCall('track_session', { id });
export const backupDatabase = () => apiCall('backup_db');
export const getDeletionLogs = () => apiCall('get_deletion_logs', {});
export const addDeletionLog = (payload) => apiCall('add_deletion_log', payload);
export const fetchOutlets = () => apiCall('get_outlets', {});
export const createOutlet = (data) => apiCall('create_outlet', data);
export const deleteOutlet = (id) => apiCall('delete_outlet', { id });
