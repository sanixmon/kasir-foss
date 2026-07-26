import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import TrackingPage from '../components/TrackingPage';

vi.mock('../supabase', () => ({
  sb: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') })
        })
      })
    })
  }
}));

describe('TrackingPage - QR Scan Bug Fix & Offline Storage Fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('finds and renders active session from localStorage when offline or before cloud sync finishes', async () => {
    const mockSession = {
      id: 'test-session-123',
      nama: 'Budi Santoso',
      items: [{ code: 'sc1', qty: 2 }],
      startTime: Date.now() - 60000,
      tanggal: '2026-07-26',
      payAwal: 'qris',
      queueNo: 5
    };
    localStorage.setItem('kw_sessions', JSON.stringify([mockSession]));

    // Render with dirty ID (simulating QR reader trailing slash/params)
    render(<TrackingPage trackingId="test-session-123/?utm_source=qr" />);

    await waitFor(() => {
      expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    });

    expect(screen.getByText(/Sewa Sedang Berjalan/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sesi tidak ditemukan atau sudah dihapus/i)).not.toBeInTheDocument();
  });

  it('finds and renders finished transaction from localStorage when scanned after bill completion', async () => {
    const mockTxn = {
      id: 'test-txn-456',
      no: 10,
      nama: 'Siti Rahma',
      tanggal: '26/07/2026',
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
      items: 'SC1×1',
      ot: '-',
      otDur: '-',
      totalBase: 25000,
      totalOT: 0,
      totalAll: 25000,
      payAwal: 'cash'
    };
    localStorage.setItem('kw_txns', JSON.stringify([mockTxn]));

    render(<TrackingPage trackingId="test-txn-456" />);

    await waitFor(() => {
      expect(screen.getByText('Siti Rahma')).toBeInTheDocument();
    });

    expect(screen.getByText('Sewa Selesai')).toBeInTheDocument();
    expect(screen.getByText('Txn: #10')).toBeInTheDocument();
    expect(screen.queryByText(/Sesi tidak ditemukan atau sudah dihapus/i)).not.toBeInTheDocument();
  });

  it('displays error message and Retry/Refresh button when ID is truly absent', async () => {
    render(<TrackingPage trackingId="non-existent-id" />);

    await waitFor(() => {
      expect(screen.getByText(/Sesi tidak ditemukan atau sudah dihapus/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    const retryBtn = screen.getByRole('button', { name: /Coba Lagi \/ Refresh/i });
    expect(retryBtn).toBeInTheDocument();

    // Clicking retry triggers a re-fetch attempt without crash
    fireEvent.click(retryBtn);
  });
});
