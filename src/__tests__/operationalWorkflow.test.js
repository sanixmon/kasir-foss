import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  setApiUrl,
  setAuthToken,
  getAuthToken,
  setActiveOutletId,
  getActiveOutletId,
  setEscalationToken,
  clearEscalationToken,
  loginCashier,
  addSession,
  claimSession,
  deleteTxn,
  fetchOutlets
} from '../api';

describe('Operational POS Workflow & Multi-Outlet Lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setApiUrl('http://localhost:8080/api');
    setAuthToken(null);
    clearEscalationToken();
    setActiveOutletId(null);
  });

  it('executes full operational workflow: login -> select outlet -> create session -> partial claim -> admin delete', async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    // 1. Cashier Login
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        user: { username: 'kasir1', role: 'cashier', outletId: 'outlet-1' },
        token: 'token-cashier-xyz'
      })
    });

    const loginRes = await loginCashier('kasir1', 'password123', 'outlet-1');
    expect(loginRes.success).toBe(true);
    setAuthToken(loginRes.token);
    setActiveOutletId('outlet-1');

    expect(getAuthToken()).toBe('token-cashier-xyz');
    expect(getActiveOutletId()).toBe('outlet-1');

    // 2. Add Session with multi-outlet headers
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        session: {
          id: 's-op-1',
          outletId: 'outlet-1',
          nama: 'Budi Rental',
          items: [{ id: 'ps5', name: 'PS5 2 Jam', price: 20000 }]
        }
      })
    });

    const addRes = await addSession({
      id: 's-op-1',
      outletId: 'outlet-1',
      nama: 'Budi Rental',
      items: [{ id: 'ps5', name: 'PS5 2 Jam', price: 20000 }]
    });

    expect(addRes.success).toBe(true);
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:8080/api', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Authorization': 'Bearer token-cashier-xyz',
        'X-Outlet-ID': 'outlet-1'
      })
    }));

    // 3. Claim Session (Checkout)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        transaction: {
          id: 't-op-1',
          no: 42,
          outletId: 'outlet-1',
          nama: 'Budi Rental',
          grandTotal: 20000
        }
      })
    });

    const claimRes = await claimSession({
      sessionId: 's-op-1',
      outletId: 'outlet-1',
      grandTotal: 20000,
      cash: 20000
    });

    expect(claimRes.success).toBe(true);
    expect(claimRes.transaction.no).toBe(42);

    // 4. Admin Escalation for deletion
    setEscalationToken('admin-escalated-token-789');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    const deleteRes = await deleteTxn({ id: 't-op-1', outletId: 'outlet-1' });
    expect(deleteRes.success).toBe(true);

    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:8080/api', expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': 'Bearer admin-escalated-token-789'
      })
    }));

    // 5. Cleanup escalation token restores cashier session
    clearEscalationToken();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, outlets: [] })
    });

    await fetchOutlets();
    expect(fetchMock).toHaveBeenLastCalledWith('http://localhost:8080/api', expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': 'Bearer token-cashier-xyz'
      })
    }));
  });
});
