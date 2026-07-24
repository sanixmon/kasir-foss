import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LiveClock from '../components/LiveClock';

describe('LiveClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 24, 10, 30, 0)); // July 24, 2026 10:30:00
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders time and updates every second', () => {
    render(<LiveClock />);
    expect(screen.getByText('10:30:00')).toBeInTheDocument();
    
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    expect(screen.getByText('10:30:01')).toBeInTheDocument();
  });
});
