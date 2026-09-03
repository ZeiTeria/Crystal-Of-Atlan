import { useEffect, useState } from 'react';
import { errorMessage } from './errorMessage';
import { configError } from './lib/supabase';
import { getSession, signOut, onAuthChange } from './lib/auth';
import { loadProfile, type Profile } from './data/profile';
import { loadAppSettings } from './data/roster';
import { toSettings } from './data/loadPlanInput';
import Countdown from './ui/Countdown';
import type { PlanInput } from './engine/types';
import PlanScreen from './screens/PlanScreen';
import { PHONE, useMediaQuery } from './ui/useMediaQuery';
import DungeonsScreen from './screens/DungeonsScreen';
import type { Session } from '@supabase/supabase-js';
import LandingScreen from './screens/LandingScreen';
import { LogoMark } from './ui/Shared';
import './App.css';
import ErrorBanner from './ui/ErrorBanner';

export type View = 'board' | 'log' | 'dungeons';

const TABS: { view: View; label: string; adminOnly?: boolean }[] = [
  { view: 'log', label: 'Character' },
  { view: 'board', label: 'Plan' },
  { view: 'dungeons', label: 'Dungeons', adminOnly: true },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<View>('log');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isPhone = useMediaQuery(PHONE);
  // The countdown belongs to the whole app, not to one screen: it was a strip
  // under the header on every tab, repeating the tab's own name beside it.
  const [resetSettings, setResetSettings] = useState<PlanInput['settings'] | null>(null);

  useEffect(() => {
    let mounted = true;
    getSession()
      .then((s) => {
        if (mounted) setSession(s);
      })
      .catch((err: unknown) => {
        if (mounted) setError(errorMessage(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    const unsubscribe = onAuthChange((s) => {
      if (mounted) setSession(s);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setResetSettings(null);
      return;
    }
    let live = true;
    loadAppSettings()
      .then((row) => {
        if (live) setResetSettings(toSettings(row));
      })
      // The countdown is not worth an error banner; the screens report their own.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    let mounted = true;
    loadProfile()
      .then((p) => {
        if (mounted) setProfile(p);
      })
      .catch((err: unknown) => {
        if (mounted) setError(errorMessage(err));
      });
    return () => {
      mounted = false;
    };
  }, [session]);

  if (configError) {
    return (
      <div className="app-container">
        <h1>Crystal Of Atlan</h1>
        <ErrorBanner message={configError} />
      </div>
    );
  }

  if (loading) return <div className="app-container">Loading...</div>;

  if (!session) {
    return <LandingScreen error={error} />;
  }

  const tabs = TABS.filter((t) => !t.adminOnly || profile?.is_admin);

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <div className="brand">
            <LogoMark />
            <span className="brand-text">CRYSTAL OF ATLAN</span>
          </div>
          {!isPhone && (
          <div className="coa-tabs">
            {tabs.map((t) => (
              <button
                key={t.view}
                type="button"
                className={`coa-tab ${view === t.view ? 'active' : ''}`}
                aria-current={view === t.view ? 'page' : undefined}
                onClick={() => setView(t.view)}
              >
                {t.label}
              </button>
            ))}
          </div>
          )}
        </div>
        <div className="header-right">
          {resetSettings && (
            <span className="header-reset">
              Resets in <Countdown settings={resetSettings} />
            </span>
          )}
          <div className="user-profile">
            {session.user.user_metadata?.avatar_url ? (
              <img src={session.user.user_metadata.avatar_url} alt="User Avatar" className="user-avatar" />
            ) : null}
            <span className="user-name">{session.user.user_metadata?.custom_claims?.global_name || profile?.discord_username || session.user.email}</span>
            {profile?.is_admin && <span className="admin-tag">ADMIN</span>}
          </div>
          <button type="button" className="sign-out-btn" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <ErrorBanner message={error} />

      <div className="app-content">
        {(view === 'board' || view === 'log') && <PlanScreen activeView={view} />}
        {view === 'dungeons' && profile?.is_admin && <DungeonsScreen />}
      </div>
      
      {isPhone && (
      <div className="mobile-tab-bar">
        {tabs.map((t) => (
          <button
            key={t.view}
            type="button"
            className={`mobile-tab ${view === t.view ? 'active' : ''}`}
            aria-current={view === t.view ? 'page' : undefined}
            onClick={() => setView(t.view)}
          >
            {t.label}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
