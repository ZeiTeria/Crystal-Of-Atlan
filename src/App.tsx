import { useEffect, useState } from 'react';
import { errorMessage } from './errorMessage';
import { configError } from './lib/supabase';
import { getSession, signInWithDiscord, signOut, onAuthChange } from './lib/auth';
import { loadProfile, type Profile } from './data/profile';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Tabs from './ui/Tabs';
import ThemeToggle from './ui/ThemeToggle';
import PlanScreen from './screens/PlanScreen';
import DungeonsScreen from './screens/DungeonsScreen';
import type { Session } from '@supabase/supabase-js';
import LandingScreen from './screens/LandingScreen';
import { LogoMark } from './ui/Shared';
import './App.css';
import ErrorBanner from './ui/ErrorBanner';

export type View = 'board' | 'log' | 'grid' | 'dungeons';

const TABS: { view: View; label: string; adminOnly?: boolean }[] = [
  { view: 'board', label: 'Plan' },
  { view: 'log', label: 'Character' },
  { view: 'dungeons', label: 'Dungeons', adminOnly: true },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<View>('board');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <div className="coa-tabs">
            {tabs.map(t => (
              <span 
                key={t.view} 
                className={`coa-tab ${view === t.view ? 'active' : ''}`}
                onClick={() => setView(t.view)}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>
        <div className="header-right">
          <div className="user-profile">
            {session.user.user_metadata?.avatar_url ? (
              <img src={session.user.user_metadata.avatar_url} alt="User Avatar" className="user-avatar" />
            ) : null}
            <span className="user-name">{session.user.user_metadata?.custom_claims?.global_name || profile?.discord_username || session.user.email}</span>
            {profile?.is_admin && <span className="admin-tag">ADMIN</span>}
          </div>
          <span className="sign-out-btn" onClick={() => void signOut()}>Sign out</span>
        </div>
      </header>

      <ErrorBanner message={error} />

      <div className="app-content">
        {(view === 'board' || view === 'log') && <PlanScreen activeView={view} />}
        {view === 'dungeons' && profile?.is_admin && <DungeonsScreen />}
      </div>
      
      <div className="mobile-tab-bar">
        {tabs.map(t => (
          <span 
            key={t.view} 
            className={`mobile-tab ${view === t.view ? 'active' : ''}`}
            onClick={() => setView(t.view)}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
