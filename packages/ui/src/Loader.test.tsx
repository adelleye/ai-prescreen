import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { Loader, TypingIndicator } from './Loader';

describe('Loader components', () => {
  it('renders loader with correct ARIA attributes', () => {
    render(<Loader />);

    const loader = screen.getByRole('status');
    expect(loader).toBeTruthy();
    expect(loader.getAttribute('aria-label')).toBe('Loading');
    expect(loader.getAttribute('aria-live')).toBe('polite');
  });

  it('renders different sizes', () => {
    const { rerender } = render(<Loader size="sm" />);
    let loader = screen.getByRole('status');
    expect(loader).toBeTruthy();

    rerender(<Loader size="md" />);
    loader = screen.getByRole('status');
    expect(loader).toBeTruthy();

    rerender(<Loader size="lg" />);
    loader = screen.getByRole('status');
    expect(loader).toBeTruthy();
  });

  it('renders TypingIndicator with correct ARIA attributes', () => {
    render(<TypingIndicator />);

    const indicator = screen.getByRole('status');
    expect(indicator).toBeTruthy();
    expect(indicator.getAttribute('aria-label')).toBe('AI is typing');
    expect(indicator.getAttribute('aria-live')).toBe('polite');
  });

  it('TypingIndicator shows AI avatar', () => {
    render(<TypingIndicator />);

    expect(screen.getByText('AI')).toBeTruthy();
  });
});
