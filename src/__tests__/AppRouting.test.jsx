import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

// Mock Supabase to prevent actual network calls during render
vi.mock('../supabase', () => ({
  sb: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      abortSignal: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn()
    })),
    removeChannel: vi.fn()
  }
}));

describe('App Routing based on Role', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows RoleSelection initially, clicking Kasir shows LoginPage', () => {
    render(<App />);
    expect(screen.getByText(/Portal Kasir/i)).toBeDefined();
    
    fireEvent.click(screen.getByText(/Portal Kasir/i));
    // LoginPage should appear (it has a text "Mulai Shift")
    expect(screen.getByText(/Mulai Shift/i)).toBeDefined();
  });
});
