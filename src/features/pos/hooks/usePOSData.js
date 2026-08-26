import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllData } from '../../../api';
import { normalizeSession, normalizeTxn } from '../../../lib/utils';
import { getShiftDate } from '../../../lib/shift';
import { useRealtimeStream } from '../../realtime/useRealtimeStream';

/**
 * Custom hook for managing POS data synchronization, normalization, realtime SSE stream, and polling lifecycle.
 * Source of truth for server-derived entities (sessions, transactions, users, outlets, deletionLogs).
 */
export function usePOSData(options = {}) {
  const {
    isAuthenticated = true,
    activeOutletId = null,
    pollingIntervalMs = 5000,
    onUnauthorized,
    onShiftDateChange
  } = options;

  const [activeSessions, setActiveSessions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [deletionLogs, setDeletionLogs] = useState([]);
  const [apiConnected, setApiConnected] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('');

  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;

  const onShiftDateChangeRef = useRef(onShiftDateChange);
  onShiftDateChangeRef.current = onShiftDateChange;

  const loadData = useCallback(async () => {
    try {
      setIsSyncing(true);

      // Reset nomor antrian lokal saat berganti shift/hari
      const currentShiftDate = getShiftDate();
      const storedShiftDate = localStorage.getItem('kw_shiftDate');
      if (storedShiftDate !== currentShiftDate) {
        localStorage.setItem('kw_shiftDate', currentShiftDate);
        localStorage.removeItem('kw_shiftQNo');
        if (typeof onShiftDateChangeRef.current === 'function') {
          onShiftDateChangeRef.current();
        }
      }

      const data = await fetchAllData();
      if (data && !data.error) {
        const sessions = Array.isArray(data.sessions)
          ? data.sessions.map(normalizeSession).filter(Boolean)
          : [];
        const txns = Array.isArray(data.transactions)
          ? data.transactions.map(normalizeTxn).filter(Boolean).sort((a, b) => (a.no || 0) - (b.no || 0))
          : [];

        setActiveSessions(sessions);
        setTransactions(txns);

        if (Array.isArray(data.users)) {
          setUsers(data.users);
        }

        if (Array.isArray(data.outlets)) {
          setOutlets(data.outlets);
        }

        setApiConnected(true);
        setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
      }
    } catch (err) {
      if (err?.status === 401 || err?.code === 'UNAUTHORIZED') {
        // Token missing/expired -> force a clean re-login
        if (typeof onUnauthorizedRef.current === 'function') {
          onUnauthorizedRef.current();
        }
        return;
      }
      console.error('API polling error:', err);
      setApiConnected(false);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handleRealtimeEvent = useCallback((event) => {
    // When a realtime SSE mutation event arrives, refresh data immediately
    loadData();
  }, [loadData]);

  const { isConnected: isStreamConnected } = useRealtimeStream(
    activeOutletId,
    handleRealtimeEvent,
    { enabled: isAuthenticated }
  );

  // Poll the server as fallback and initial sync once authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
    const interval = setInterval(loadData, pollingIntervalMs);
    return () => clearInterval(interval);
  }, [isAuthenticated, pollingIntervalMs, loadData]);

  return {
    activeSessions,
    setActiveSessions,
    transactions,
    setTransactions,
    users,
    setUsers,
    outlets,
    setOutlets,
    deletionLogs,
    setDeletionLogs,
    apiConnected,
    setApiConnected,
    isSyncing,
    lastSyncTime,
    loadData,
    refresh: loadData,
    isStreamConnected
  };
}
