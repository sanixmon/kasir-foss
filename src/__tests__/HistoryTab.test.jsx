import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HistoryTab from '../components/HistoryTab';

describe('HistoryTab - Immutability & Role Based Permissions', () => {
  const mockTxns = [
    {
      id: 'txn-1',
      no: '001',
      nama: 'John Doe',
      shift: 'PAGI',
      tanggal: (() => {
        const d = new Date();
        d.setHours(d.getHours() - 6);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })(),
      startTime: Date.now() - 3600000,
      endTime: Date.now(),
      items: '1x Stroller',
      totalBase: 20000,
      grandTotal: 0,
      totalAll: 20000,
      payAwal: 'cash'
    }
  ];

  it('restricts cashier view to today and shows print and delete-by-bill buttons', () => {
    render(
      <HistoryTab
        transactions={mockTxns}
        onPrintTxn={vi.fn()}
        onDeleteTxn={vi.fn()}
        currentUserRole="cashier"
      />
    );

    // Verify cashier mode badge is visible
    expect(screen.getByText(/Mode Kasir/i)).toBeInTheDocument();
    
    // Verify historical filter dropdown (Harian/Bulanan/Tahunan) is not rendered
    expect(screen.queryByRole('option', { name: 'Bulanan' })).toBeNull();
    expect(screen.queryByText('Export')).toBeNull();

    // Verify row action buttons: Print Struk and Hapus Bill (which triggers admin verification) are present; Edit is hidden
    expect(screen.getByTitle('Print Struk')).toBeInTheDocument();
    expect(screen.getByTitle('Hapus Bill')).toBeInTheDocument();
    expect(screen.queryByTitle('Edit Bill / Transaksi')).toBeNull();
  });

  it('shows full history controls and delete option for admin, BUT NO edit button (immutability rule)', () => {
    const mockDelete = vi.fn();

    render(
      <HistoryTab
        transactions={mockTxns}
        onPrintTxn={vi.fn()}
        onDeleteTxn={mockDelete}
        currentUserRole="admin"
      />
    );

    // Verify mode dropdown, Export button, and Delete button are present
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByTitle('Hapus Bill')).toBeInTheDocument();

    // STRICT BUSINESS RULE: Edit bill button must NEVER be present for anyone, even admin, to prevent value manipulation
    expect(screen.queryByTitle('Edit Bill / Transaksi')).toBeNull();

    // Test delete trigger
    fireEvent.click(screen.getByTitle('Hapus Bill'));
    expect(mockDelete).toHaveBeenCalledWith(mockTxns[0]);
  });

  it('renders "Bersihkan Riwayat" button for admin and triggers onClearHistory', () => {
    const mockClear = vi.fn();

    render(
      <HistoryTab
        transactions={mockTxns}
        onPrintTxn={vi.fn()}
        onDeleteTxn={vi.fn()}
        onClearHistory={mockClear}
        currentUserRole="admin"
      />
    );

    const clearBtn = screen.getByTitle('Bersihkan Semua Riwayat');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(mockClear).toHaveBeenCalledTimes(1);
  });
});
