import { useState, useCallback } from 'react';
import { verifyAdminPassword, setEscalationToken, clearEscalationToken } from '../../../api';

/**
 * Custom hook for temporary admin privilege escalation.
 * Handles password verification modal state, temporary escalation token assignment, and pending action dispatching.
 */
export function useAdminEscalation() {
  const [pendingAction, setPendingAction] = useState(null);

  const requestEscalation = useCallback((action) => {
    setPendingAction(action);
  }, []);

  const cancelEscalation = useCallback(() => {
    setPendingAction(null);
  }, []);

  const verifyAndEscalate = useCallback(async (password) => {
    const res = await verifyAdminPassword(password);
    if (res?.valid && res?.token) {
      setEscalationToken(res.token);
    }
    return res;
  }, []);

  const executePendingAction = useCallback(({ onEditSession, onDeleteTxn }) => {
    if (!pendingAction) return;

    if (pendingAction.type === 'editSession') {
      if (typeof onEditSession === 'function') {
        onEditSession(pendingAction.session);
      }
      setPendingAction(null);
      clearEscalationToken(); // editSession is not admin-only
    } else if (pendingAction.type === 'deleteTxn') {
      if (typeof onDeleteTxn === 'function') {
        onDeleteTxn(pendingAction.id);
      }
      setPendingAction(null);
    }
  }, [pendingAction]);

  return {
    pendingAction,
    setPendingAction,
    requestEscalation,
    cancelEscalation,
    verifyAndEscalate,
    executePendingAction
  };
}
