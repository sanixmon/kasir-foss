// src/__tests__/RoleSelection.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoleSelection from '../components/RoleSelection';

describe('RoleSelection Component', () => {
  it('calls onSelectCashier when Portal Kasir is clicked', () => {
    const onSelectCashier = vi.fn();
    render(<RoleSelection onSelectCashier={onSelectCashier} onSelectAdmin={() => {}} />);
    fireEvent.click(screen.getByText(/Portal Kasir/i));
    expect(onSelectCashier).toHaveBeenCalledTimes(1);
  });

  it('shows password prompt when Portal Admin is clicked and calls onSelectAdmin on submit', () => {
    const onSelectAdmin = vi.fn();
    render(<RoleSelection onSelectCashier={() => {}} onSelectAdmin={onSelectAdmin} />);
    
    // Initial state: password input not visible
    expect(screen.queryByPlaceholderText(/Masukkan Password Admin/i)).toBeNull();
    
    // Click Admin
    fireEvent.click(screen.getByText(/Portal Admin/i));
    
    // Password input appears
    const input = screen.getByPlaceholderText(/Masukkan Password Admin/i);
    fireEvent.change(input, { target: { value: 'secret' } });
    
    // Submit
    fireEvent.click(screen.getByText(/Masuk/i));
    expect(onSelectAdmin).toHaveBeenCalledWith('secret');
  });
});
