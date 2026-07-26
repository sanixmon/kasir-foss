let APPS_SCRIPT_URL = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_APPS_SCRIPT_URL
  ? import.meta.env.VITE_APPS_SCRIPT_URL
  : 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

export function setApiUrl(url) {
  APPS_SCRIPT_URL = url;
}

export async function apiCall(action, payload = {}) {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ action, payload })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API call failed for action ${action}:`, error);
    throw error;
  }
}

export const fetchAllData = async () => {
  try {
    const response = await fetch(APPS_SCRIPT_URL);
    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.warn('GET fetchAllData failed, trying POST fallback...', err);
  }
  return apiCall('fetch_data');
};
export const addSession = (data) => apiCall('add_session', data);
export const editSession = (data) => apiCall('edit_session', data);
export const claimSession = (data) => apiCall('claim_session', data);
export const deleteSession = (id) => apiCall('delete_session', { id });
