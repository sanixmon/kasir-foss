import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePOSData } from '../usePOSData';
import * as api from '../../../../api';

vi.mock('../../../../api', () => ({
  fetchAllData: vi.fn()
}));

describe('usePOSData Hook Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not poll when isAuthenticated is false', async () => {
    api.fetchAllData.mockResolvedValue({
      sessions: [],
      transactions: [],
      users: []
    });

    const { result } = renderHook(() =>
      usePOSData({ isAuthenticated: false })
    );

    expect(api.fetchAllData).not.toHaveBeenCalled();
    expect(result.current.activeSessions).toEqual([]);
    expect(result.current.transactions).toEqual([]);
  });

  it('performs initial fetch and populates state when isAuthenticated is true', async () => {
    api.fetchAllData.mockResolvedValue({
      sessions: [
        {
          id: 's-1',
          queueNo: 1,
          nama: 'Budi',
          items: [{ code: 'SA', qty: 1 }],
          startTime: 1700000000000,
          tanggal: '2026-08-25',
          payAwal: 'cash'
        }
      ],
      transactions: [
        {
          id: 't-2',
          no: 2,
          nama: 'Joko',
          totalAll: 50000
        },
        {
          id: 't-1',
          no: 1,
          nama: 'Andi',
          totalAll: 35000
        }
      ],
      users: [{ username: 'admin', role: 'admin' }]
    });

    const { result } = renderHook(() =>
      usePOSData({ isAuthenticated: true })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(api.fetchAllData).toHaveBeenCalledTimes(1);
    expect(result.current.activeSessions).toHaveLength(1);
    expect(result.current.activeSessions[0].nama).toBe('Budi');
    // Transactions must be sorted by "no" ascending
    expect(result.current.transactions).toHaveLength(2);
    expect(result.current.transactions[0].no).toBe(1);
    expect(result.current.transactions[1].no).toBe(2);
    expect(result.current.users).toHaveLength(1);
    expect(result.current.apiConnected).toBe(true);
  });

  it('polls every 5000ms and cleans up interval on unmount', async () => {
    api.fetchAllData.mockResolvedValue({
      sessions: [],
      transactions: [],
      users: []
    });

    const { unmount } = renderHook(() =>
      usePOSData({ isAuthenticated: true, pollingIntervalMs: 5000 })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.fetchAllData).toHaveBeenCalledTimes(1);

    // Advance 5 seconds -> second poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(api.fetchAllData).toHaveBeenCalledTimes(2);

    // Advance another 5 seconds -> third poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(api.fetchAllData).toHaveBeenCalledTimes(3);

    // Unmount -> timer cleanup
    unmount();

    // Advance time further -> no new calls
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(api.fetchAllData).toHaveBeenCalledTimes(3);
  });

  it('calls onUnauthorized when API returns 401 error', async () => {
    const onUnauthorized = vi.fn();
    const err401 = new Error('HTTP error! status: 401');
    err401.status = 401;
    err401.code = 'UNAUTHORIZED';
    api.fetchAllData.mockRejectedValue(err401);

    renderHook(() =>
      usePOSData({ isAuthenticated: true, onUnauthorized })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('sets apiConnected to false gracefully on network failure without throwing', async () => {
    api.fetchAllData.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      usePOSData({ isAuthenticated: true })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.apiConnected).toBe(false);
    expect(result.current.isSyncing).toBe(false);
  });
});
