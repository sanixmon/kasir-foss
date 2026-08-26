import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminEscalation } from '../useAdminEscalation';
import * as api from '../../../../api';

vi.mock('../../../../api', () => ({
  verifyAdminPassword: vi.fn(),
  setEscalationToken: vi.fn(),
  clearEscalationToken: vi.fn()
}));

describe('useAdminEscalation Hook Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests and cancels escalation', () => {
    const { result } = renderHook(() => useAdminEscalation());

    expect(result.current.pendingAction).toBe(null);

    act(() => {
      result.current.requestEscalation({ type: 'deleteTxn', id: 't-1' });
    });
    expect(result.current.pendingAction).toEqual({ type: 'deleteTxn', id: 't-1' });

    act(() => {
      result.current.cancelEscalation();
    });
    expect(result.current.pendingAction).toBe(null);
  });

  it('verifyAndEscalate sets escalation token upon valid password', async () => {
    api.verifyAdminPassword.mockResolvedValue({ valid: true, token: 'esc-token-123' });

    const { result } = renderHook(() => useAdminEscalation());

    let res;
    await act(async () => {
      res = await result.current.verifyAndEscalate('validAdminPass');
    });

    expect(res.valid).toBe(true);
    expect(api.setEscalationToken).toHaveBeenCalledWith('esc-token-123');
  });

  it('verifyAndEscalate does NOT set escalation token upon invalid password', async () => {
    api.verifyAdminPassword.mockResolvedValue({ valid: false });

    const { result } = renderHook(() => useAdminEscalation());

    let res;
    await act(async () => {
      res = await result.current.verifyAndEscalate('wrongPass');
    });

    expect(res.valid).toBe(false);
    expect(api.setEscalationToken).not.toHaveBeenCalled();
  });

  it('executePendingAction dispatches deleteTxn and clears pendingAction', () => {
    const onDeleteTxn = vi.fn();
    const { result } = renderHook(() => useAdminEscalation());

    act(() => {
      result.current.requestEscalation({ type: 'deleteTxn', id: 't-99' });
    });

    act(() => {
      result.current.executePendingAction({ onDeleteTxn });
    });

    expect(onDeleteTxn).toHaveBeenCalledWith('t-99');
    expect(result.current.pendingAction).toBe(null);
  });

  it('executePendingAction dispatches editSession and clears escalation token', () => {
    const onEditSession = vi.fn();
    const { result } = renderHook(() => useAdminEscalation());

    const sessionObj = { id: 's-1', nama: 'Budi' };
    act(() => {
      result.current.requestEscalation({ type: 'editSession', session: sessionObj });
    });

    act(() => {
      result.current.executePendingAction({ onEditSession });
    });

    expect(onEditSession).toHaveBeenCalledWith(sessionObj);
    expect(api.clearEscalationToken).toHaveBeenCalled();
    expect(result.current.pendingAction).toBe(null);
  });
});
