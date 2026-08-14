let APPS_SCRIPT_URL = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APPS_SCRIPT_URL
  ? import.meta.env.VITE_APPS_SCRIPT_URL
  : '/api';

export function setApiUrl(url) {
  APPS_SCRIPT_URL = url;
}

export async function apiCall(action, payload = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, payload }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
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

export const fetchAllData = async (timeoutMs = 8000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(APPS_SCRIPT_URL, { signal: controller.signal });
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('GET fetchAllData failed or timed out, trying POST fallback...', err);
  } finally {
    clearTimeout(timer);
  }
  return apiCall('fetch_data', {}, timeoutMs);
};

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
export const loginCashier = (username, password) => apiCall('login_cashier', { username, password });
export const backupDatabase = () => apiCall('backup_db');
export const getDeletionLogs = () => apiCall('get_deletion_logs', {});
export const addDeletionLog = (payload) => apiCall('add_deletion_log', payload);
