import { useEffect, useState } from 'react';
import { errorMessage } from './errorMessage';
import { configError } from './lib/supabase';
import { getSession, signInWithDiscord, signOut, onAuthChange } from './lib/auth';
import { loadProfile, type Profile } from './data/profile';
import Badge from './ui/Badge';
import Button from './ui/Button';
import PlanScreen from './screens/PlanScreen';
import GridScreen from './screens/GridScreen';
import HistoryScreen from './screens/HistoryScreen';
import StatsScreen from './screens/StatsScreen';
import DungeonsScreen from './screens/DungeonsScreen';
import type { Session } from '@supabase/supabase-js';
import './App.css';
import ErrorBanner from './ui/ErrorBanner';

export type View = 'plan' | 'grid' | 'history' | 'stats' | 'dungeons';

const TABS: { view: View; label: string; adminOnly?: boolean }[] = [
  { view: 'plan', label: 'Plan' },
  { view: 'grid', label: 'Characters & Grid' },
  { view: 'history', label: 'History' },
  { view: 'stats', label: 'Stats' },
  { view: 'dungeons', label: 'Dungeons', adminOnly: true },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<View>('plan');
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
    return (
      <div className="app-container">
        <h1>Crystal Of Atlan</h1>
        <ErrorBanner message={error} />
        <Button onClick={() => void signInWithDiscord()}>
          Sign in with Discord
        </Button>
      </div>
    );
  }

  const tabs = TABS.filter((t) => !t.adminOnly || profile?.is_admin);

  return (
    <div className="app-container app-wide">
      <header className="app-header">
        <h1>Crystal Of Atlan</h1>
        <div className="profile-info">
          <span className="username">{profile?.discord_username ?? session.user.email}</span>
          {profile?.is_admin && <Badge>Admin</Badge>}
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.view}
            className={tab.view === view ? 'tab tab-active' : 'tab'}
            onClick={() => setView(tab.view)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <ErrorBanner message={error} />

      {view === 'plan' && <PlanScreen />}
      {view === 'grid' && <GridScreen />}
      {view === 'history' && <HistoryScreen />}
      {view === 'stats' && <StatsScreen />}
      {view === 'dungeons' && profile?.is_admin && <DungeonsScreen />}
    </div>
  );
}
