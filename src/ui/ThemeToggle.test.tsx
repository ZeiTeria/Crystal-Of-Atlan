// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ThemeToggle from './ThemeToggle';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeToggle', () => {
  it('applies and stores the chosen theme', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: /light/i }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('atlan.theme')).toBe('light');
  });

  it('marks the active choice as pressed', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: /dark/i }));
    expect(screen.getByRole('button', { name: /dark/i }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /light/i }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('restores the stored choice on mount', () => {
    localStorage.setItem('atlan.theme', 'light');
    render(<ThemeToggle />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('leaves the document unstamped when nothing was ever chosen', () => {
    render(<ThemeToggle />);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
