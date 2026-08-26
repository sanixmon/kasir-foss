import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_EVENTS = [
  'SESSION_ADDED',
  'SESSION_UPDATED',
  'SESSION_DELETED',
  'SESSION_CLAIMED',
  'SETTING_UPDATED',
  'OUTLET_UPDATED',
  'OUTLET_DELETED',
  'DATA_MUTATED'
];

/**
 * React hook that connects to the SSE realtime stream endpoint for an active outlet.
 *
 * @param {string|null} outletId - ID of active outlet (or 'all'/null for global stream)
 * @param {Function} [onEvent] - Callback invoked when a realtime event is received
 * @param {Object} [options] - Additional options (enabled, events, endpoint)
 * @returns {{ isConnected: boolean, error: any, reconnect: Function, close: Function }}
 */
export function useRealtimeStream(outletId, onEvent, options = {}) {
  const {
    enabled = true,
    events = DEFAULT_EVENTS,
    endpoint = '/api/stream'
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const activeOutlet = outletId || 'all';

  const close = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }

    // Close any prior connection
    close();

    const separator = endpoint.includes('?') ? '&' : '?';
    const streamUrl = `${endpoint}${separator}outlet_id=${encodeURIComponent(activeOutlet)}`;

    try {
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      es.onerror = (err) => {
        setIsConnected(false);
        setError(err);
      };

      const handleMessage = (evt) => {
        if (!evt || !evt.data) return;
        try {
          const parsed = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
          if (typeof onEventRef.current === 'function') {
            onEventRef.current(parsed, evt);
          }
        } catch {
          if (typeof onEventRef.current === 'function') {
            onEventRef.current({ type: evt.type || 'message', data: evt.data }, evt);
          }
        }
      };

      es.onmessage = handleMessage;

      const registeredEvents = Array.isArray(events) ? events : DEFAULT_EVENTS;
      registeredEvents.forEach((evtType) => {
        es.addEventListener(evtType, handleMessage);
      });
    } catch (err) {
      console.warn('Failed to initialize EventSource:', err);
      setIsConnected(false);
      setError(err);
    }
  }, [activeOutlet, enabled, endpoint, events, close]);

  useEffect(() => {
    connect();

    return () => {
      close();
    };
  }, [connect, close]);

  return {
    isConnected,
    error,
    reconnect: connect,
    close
  };
}
