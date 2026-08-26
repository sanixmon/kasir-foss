import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRealtimeStream } from '../useRealtimeStream';

describe('useRealtimeStream Hook', () => {
  let mockInstances = [];

  class MockEventSource {
    constructor(url) {
      this.url = url;
      this.listeners = {};
      this.onopen = null;
      this.onerror = null;
      this.onmessage = null;
      this.readyState = 0;
      this.close = vi.fn(() => {
        this.readyState = 2;
      });
      mockInstances.push(this);
    }

    addEventListener(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    }

    removeEventListener(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      }
    }

    dispatchEvent(event, data) {
      const evt = { type: event, data: typeof data === 'object' ? JSON.stringify(data) : data };
      if (event === 'message' && this.onmessage) {
        this.onmessage(evt);
      }
      if (this.listeners[event]) {
        this.listeners[event].forEach(cb => cb(evt));
      }
    }

    simulateOpen() {
      this.readyState = 1;
      if (this.onopen) {
        this.onopen();
      }
    }

    simulateError(err = new Error('SSE Connection Error')) {
      this.readyState = 2;
      if (this.onerror) {
        this.onerror(err);
      }
    }
  }

  beforeEach(() => {
    mockInstances = [];
    global.EventSource = vi.fn().mockImplementation(function(url) {
      return new MockEventSource(url);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('subscribes to EventSource with active outlet_id', () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useRealtimeStream('outlet-1', onEvent));

    expect(global.EventSource).toHaveBeenCalledWith(expect.stringContaining('outlet_id=outlet-1'));
    unmount();
  });

  it('subscribes to EventSource with default "all" if outlet_id is not specified', () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useRealtimeStream(null, onEvent));

    expect(global.EventSource).toHaveBeenCalledWith(expect.stringContaining('outlet_id=all'));
    unmount();
  });

  it('updates isConnected when connection opens or errors', () => {
    const onEvent = vi.fn();
    const { result } = renderHook(() => useRealtimeStream('outlet-1', onEvent));

    expect(result.current.isConnected).toBe(false);

    expect(mockInstances.length).toBe(1);
    const es = mockInstances[0];

    act(() => {
      es.simulateOpen();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      es.simulateError();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('parses JSON data and triggers callback on message and custom events', () => {
    const onEvent = vi.fn();
    renderHook(() => useRealtimeStream('outlet-1', onEvent));

    const es = mockInstances[0];
    act(() => {
      es.simulateOpen();
    });

    const mockPayload = { type: 'SESSION_ADDED', outletId: 'outlet-1', payload: { id: 's1', nama: 'Test' } };
    act(() => {
      es.dispatchEvent('SESSION_ADDED', mockPayload);
    });

    expect(onEvent).toHaveBeenCalledWith(mockPayload, expect.anything());
  });

  it('closes existing EventSource and reconnects when outletId changes', () => {
    const onEvent = vi.fn();
    const { rerender } = renderHook(({ outletId }) => useRealtimeStream(outletId, onEvent), {
      initialProps: { outletId: 'outlet-1' }
    });

    expect(mockInstances.length).toBe(1);
    const es1 = mockInstances[0];

    rerender({ outletId: 'outlet-2' });

    expect(es1.close).toHaveBeenCalled();
    expect(global.EventSource).toHaveBeenCalledWith(expect.stringContaining('outlet_id=outlet-2'));
  });

  it('cleans up and closes EventSource on unmount', () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useRealtimeStream('outlet-1', onEvent));

    expect(mockInstances.length).toBe(1);
    const es = mockInstances[0];

    unmount();

    expect(es.close).toHaveBeenCalled();
  });
});
