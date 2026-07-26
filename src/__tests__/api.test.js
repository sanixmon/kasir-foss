import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAllData, addSession, editSession, claimSession, deleteSession, setApiUrl } from '../api';

describe('Apps Script API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setApiUrl('https://script.google.com/test/exec');
  });

  it('fetchAllData performs GET request to Apps Script URL', async () => {
    const mockData = { sessions: [], transactions: [], serverTime: 123456789 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    const result = await fetchAllData();
    expect(global.fetch).toHaveBeenCalledWith('https://script.google.com/test/exec');
    expect(result).toEqual(mockData);
  });

  it('addSession sends add_session payload', async () => {
    const sessionData = { nama: 'Test Renter', items: [{ code: 'A', qty: 1 }] };
    const mockResponse = { success: true, session: { id: 's1', ...sessionData } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const result = await addSession(sessionData);
    expect(global.fetch).toHaveBeenCalledWith('https://script.google.com/test/exec', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'add_session', payload: sessionData })
    }));
    expect(result).toEqual(mockResponse);
  });

  it('claimSession sends claim_session payload', async () => {
    const claimData = { sessionId: 's1', grandTotal: 50000 };
    const mockResponse = { success: true, transaction: { id: 't1', ...claimData } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const result = await claimSession(claimData);
    expect(global.fetch).toHaveBeenCalledWith('https://script.google.com/test/exec', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'claim_session', payload: claimData })
    }));
    expect(result).toEqual(mockResponse);
  });
});
