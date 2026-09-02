// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import App from './App';

const session = { user: { id: 'u1', email: 'me@example.com' } } as Session;
let currentSession: Session | null = null;
let currentProfile: { discord_username: string | null; is_admin: boolean } | null = null;

vi.mock('./lib/auth', () => ({
  getSession: () => Promise.resolve(currentSession),
  signInWithDiscord: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
  onAuthChange: () => () => {},
}));

vi.mock('./data/profile', () => ({
  loadProfile: () => Promise.resolve(currentProfile),
}));

// Every screen is stubbed: this test is about the shell, not their contents.
vi.mock('./screens/PlanScreen', () => ({ default: () => <div>plan screen</div> }));
vi.mock('./screens/DungeonsScreen', () => ({ default: () => <div>dungeons screen</div> }));

afterEach(() => {
  cleanup();
  currentSession = null;
  currentProfile = null;
});

describe('App shell', () => {
  it('offers Discord sign-in when signed out', async () => {
    const { findByRole } = render(<App />);
    expect(await findByRole('button', { name: /sign in with discord/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^plan$/i })).toBeNull();
  });

  it('shows the plan first once signed in', async () => {
    currentSession = session;
    currentProfile = { discord_username: 'zei', is_admin: false };
    const { findByText } = render(<App />);
    expect(await findByText('plan screen')).toBeDefined();
  });

  it('hides the dungeons tab from a non-admin', async () => {
    currentSession = session;
    currentProfile = { discord_username: 'zei', is_admin: false };
    render(<App />);
    expect(await screen.findByRole('button', { name: /^plan$/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^dungeons$/i })).toBeNull();
  });

  it('shows the dungeons tab to an admin', async () => {
    currentSession = session;
    currentProfile = { discord_username: 'zei', is_admin: true };
    render(<App />);
    expect(await screen.findByRole('button', { name: /^dungeons$/i })).toBeDefined();
  });
});
