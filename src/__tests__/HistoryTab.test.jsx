import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HistoryTab from '../features/transactions/components/HistoryTab';
import { getShiftDate } from '../lib/shift';

describe('HistoryTab - Immutability & Role Based Permissions', () => {
  const mockTxns = [
    {
      id: 'txn-1',
      no: '001',
      nama: 'John Doe',
      shift: 'PAGI',
      tanggal: getShiftDate(),
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

    // Verify row action buttons: Print Struk is present; Hapus Bill and Edit are hidden for cashier
    expect(screen.getByTitle('Print Struk')).toBeInTheDocument();
    expect(screen.queryByTitle('Hapus Bill')).toBeNull();
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

  it('filters transactions by outlet and displays revenue breakdown per outlet for admin', () => {
    const multiOutletTxns = [
      {
        id: 'txn-1',
        no: '001',
        nama: 'John Doe',
        shift: 'PAGI',
        outletId: 'outlet-pusat',
        tanggal: getShiftDate(),
        startTime: Date.now() - 3600000,
        endTime: Date.now(),
        items: '1x Stroller',
        totalBase: 20000,
        grandTotal: 0,
        totalAll: 20000,
        payAwal: 'cash'
      },
      {
        id: 'txn-2',
        no: '002',
        nama: 'Jane Doe',
        shift: 'SORE',
        outletId: 'outlet-cabang',
        tanggal: getShiftDate(),
        startTime: Date.now() - 1800000,
        endTime: Date.now(),
        items: '1x Scooter',
        totalBase: 35000,
        grandTotal: 0,
        totalAll: 35000,
        payAwal: 'qris'
      }
    ];

    const mockOutlets = [
      { id: 'outlet-pusat', nama: 'Outlet Pusat' },
      { id: 'outlet-cabang', nama: 'Outlet Cabang' }
    ];

    const { rerender } = render(
      <HistoryTab
        transactions={multiOutletTxns}
        onPrintTxn={vi.fn()}
        onDeleteTxn={vi.fn()}
        currentUserRole="admin"
        outlets={mockOutlets}
      />
    );

    // Filter dropdown exists
    const outletSelect = screen.getByLabelText(/Filter Outlet/i);
    expect(outletSelect).toBeInTheDocument();
    expect(screen.getByText(/Semua Outlet/i)).toBeInTheDocument();

    // Breakdown per outlet should be visible when "Semua Outlet" is selected
    expect(screen.getByText(/Breakdown Pendapatan per Outlet/i)).toBeInTheDocument();
    expect(screen.getByText(/Outlet Pusat:/i)).toBeInTheDocument();
    expect(screen.getByText(/Outlet Cabang:/i)).toBeInTheDocument();

    // Filter to outlet-cabang
    fireEvent.change(outletSelect, { target: { value: 'outlet-cabang' } });

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).toBeNull();
  });
});
