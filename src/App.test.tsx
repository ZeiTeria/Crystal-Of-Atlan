// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import App from './App';
import { stubMatchMedia } from './ui/testing/matchMedia';

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

  /*
   * The regression this guards is severe and was live: `PHONE` was 720px while
   * App.css hid `.coa-tabs` at <=768px. Between 721 and 768 the desktop tabs
   * were hidden by CSS and the mobile bar was never rendered by JS, so the app
   * had NO navigation and the user could not leave the tab they were on.
   *
   * jsdom does no layout, so this cannot test the 48px band directly. It tests
   * the invariant that made the band fatal: exactly one navigation renders,
   * whichever tree is chosen. Together with the breakpoint assertion in
   * useMediaQuery.test.ts (which pins PHONE to the CSS's 768px), the gap is
   * closed from both ends.
   */
  it.each([
    ['desktop', false, 'coa-tabs', 'mobile-tab-bar'],
    ['phone', true, 'mobile-tab-bar', 'coa-tabs'],
  ])('renders exactly one navigation on %s', async (_label, isPhone, present, absent) => {
    stubMatchMedia(isPhone);
    currentSession = session;
    currentProfile = { discord_username: 'zei', is_admin: false };
    const { container } = render(<App />);
    await screen.findByText('plan screen');

    expect(container.querySelector(`.${present}`)).not.toBeNull();
    expect(container.querySelector(`.${absent}`)).toBeNull();
    // and the nav that IS rendered actually carries the tabs
    expect(
      container.querySelector(`.${present}`)?.querySelectorAll('button').length,
    ).toBeGreaterThan(0);
  });
});
