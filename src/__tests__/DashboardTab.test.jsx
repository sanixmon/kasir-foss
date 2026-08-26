import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardTab from '../components/DashboardTab';

vi.mock('../lib/swal', () => ({
  swalWarning: vi.fn()
}));

import { swalWarning } from '../lib/swal';

describe('DashboardTab UI & Operational Rental Starter', () => {
  const mockProps = {
    activeSessions: [
      {
        id: 's-1',
        nama: 'Alice',
        queueNo: 1,
        payAwal: 'cash',
        startTime: Date.now() - 30 * 60 * 1000, // 30 min ago (Normal on 60 min limit)
        items: [{ code: 'ST', qty: 1 }]
      },
      {
        id: 's-2',
        nama: 'Bob',
        queueNo: 2,
        payAwal: 'qris',
        startTime: Date.now() - 65 * 60 * 1000, // 65 min ago (Overtime on 60 min limit)
        items: [{ code: 'SD', qty: 2 }]
      },
      {
        id: 's-3',
        nama: 'Charlie',
        queueNo: 0,
        payAwal: 'cash',
        startTime: Date.now() - 120 * 60 * 1000, // 120 min ago (Critical overtime on 60 min limit)
        items: [{ code: 'SJ', qty: 1 }]
      }
    ],
    onStartSewa: vi.fn().mockResolvedValue(true),
    getImgUrl: vi.fn().mockReturnValue('https://example.com/item.png'),
    onSelesaiSewa: vi.fn(),
    onShowQR: vi.fn(),
    onPrintSesi: vi.fn(),
    onEditSesi: vi.fn(),
    currentUserRole: 'cashier',
    outlets: [{ id: 'outlet-pusat', nama: 'Outlet Pusat' }]
  };

  it('renders rental starter with mobile keyboard optimizations and touch friendly inputs', () => {
    render(<DashboardTab {...mockProps} />);

    const nameInput = screen.getByPlaceholderText(/Masukkan nama penyewa/i);
    expect(nameInput).toBeDefined();
    expect(nameInput.getAttribute('autoCapitalize')).toBe('words');
    expect(nameInput.getAttribute('autoCorrect')).toBe('off');
    expect(nameInput.getAttribute('spellCheck')).toBe('false');
  });

  it('allows toggling payment method between Cash and QRIS', () => {
    render(<DashboardTab {...mockProps} />);

    const cashRadio = screen.getByRole('radio', { name: /cash/i });
    const qrisRadio = screen.getByRole('radio', { name: /qris/i });

    expect(cashRadio.checked).toBe(true);
    expect(qrisRadio.checked).toBe(false);

    fireEvent.click(qrisRadio);
    expect(qrisRadio.checked).toBe(true);
    expect(cashRadio.checked).toBe(false);
  });

  it('increments and decrements item quantities with touch controls', () => {
    render(<DashboardTab {...mockProps} />);

    const plusButtons = screen.getAllByRole('button', { name: /Tambah/i });
    const minusButtons = screen.getAllByRole('button', { name: /Kurangi/i });

    expect(plusButtons.length).toBeGreaterThan(0);
    // Click plus on the first item (e.g. ST)
    fireEvent.click(plusButtons[0]);

    const qtyVals = screen.getAllByText('1');
    expect(qtyVals.length).toBeGreaterThan(0);

    // Click minus on the first item
    fireEvent.click(minusButtons[0]);
  });

  it('validates required fields before calling onStartSewa', async () => {
    render(<DashboardTab {...mockProps} />);

    const startBtn = screen.getByRole('button', { name: /Mulai Sewa Sekarang/i });

    // 1. Submit with empty name
    fireEvent.click(startBtn);
    expect(swalWarning).toHaveBeenCalledWith('Nama Kosong', 'Masukkan nama penyewa!');

    // 2. Submit with name but no item selected
    const nameInput = screen.getByPlaceholderText(/Masukkan nama penyewa/i);
    fireEvent.change(nameInput, { target: { value: 'Budi' } });
    fireEvent.click(startBtn);
    expect(swalWarning).toHaveBeenCalledWith('Item Belum Dipilih', 'Pilih minimal satu item!');

    // 3. Select item and submit
    const plusButtons = screen.getAllByRole('button', { name: /Tambah/i });
    fireEvent.click(plusButtons[0]);
    await act(async () => {
      fireEvent.click(startBtn);
    });

    expect(mockProps.onStartSewa).toHaveBeenCalledWith('Budi', [{ code: 'ST', qty: 1 }], 'cash');
  });

  it('renders active session timer cards with tabular-numeric monospace duration and clean status badges', () => {
    render(<DashboardTab {...mockProps} />);

    // Queue badges
    expect(screen.getByText('#1')).toBeDefined();
    expect(screen.getByText('#2')).toBeDefined();

    // Clean status badges (Normal, Overtime, Critical)
    expect(screen.getByText('Normal')).toBeDefined();
    expect(screen.getByText('Overtime')).toBeDefined();
    expect(screen.getByText('Critical')).toBeDefined();

    // No cartoonish zombie text
    expect(screen.queryByText(/⚠️ ZOMBIE/i)).toBeNull();

    // Customer names
    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.getByText('Bob')).toBeDefined();
    expect(screen.getByText('Charlie')).toBeDefined();
  });

  it('triggers one-tap action buttons (Selesai, QR, Print, Edit)', () => {
    render(<DashboardTab {...mockProps} />);

    const selesaiButtons = screen.getAllByRole('button', { name: /Selesai/i });
    fireEvent.click(selesaiButtons[0]);
    expect(mockProps.onSelesaiSewa).toHaveBeenCalledWith(mockProps.activeSessions[0]);

    const qrButtons = screen.getAllByRole('button', { name: /Tampilkan QR/i });
    fireEvent.click(qrButtons[0]);
    expect(mockProps.onShowQR).toHaveBeenCalledWith(mockProps.activeSessions[0]);

    const printButtons = screen.getAllByRole('button', { name: /Print Struk/i });
    fireEvent.click(printButtons[0]);
    expect(mockProps.onPrintSesi).toHaveBeenCalledWith(mockProps.activeSessions[0]);

    const editButtons = screen.getAllByRole('button', { name: /Edit Sesi/i });
    fireEvent.click(editButtons[0]);
    expect(mockProps.onEditSesi).toHaveBeenCalledWith(mockProps.activeSessions[0]);
  });

  it('filters active sessions by search query', () => {
    render(<DashboardTab {...mockProps} />);

    const searchInput = screen.getByPlaceholderText(/Cari nama atau antrian/i);
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(screen.getByText('Alice')).toBeDefined();
    expect(screen.queryByText('Bob')).toBeNull();
    expect(screen.queryByText('Charlie')).toBeNull();
  });
});
