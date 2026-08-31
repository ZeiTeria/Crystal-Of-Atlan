import { useEffect, useState } from 'react';
import { supabase, configError } from './lib/supabase';
import { getSession, signInWithDiscord, signOut, onAuthChange } from './lib/auth';
import type { Session } from '@supabase/supabase-js';
import './App.css';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ discord_username: string | null; is_admin: boolean } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadInitialSession() {
      try {
        const currentSession = await getSession();
        if (mounted) {
          setSession(currentSession);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }

    loadInitialSession();

    const unsubscribe = onAuthChange((newSession) => {
      if (mounted) {
        setSession(newSession);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }

    let mounted = true;

    async function fetchProfile() {
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('discord_username, is_admin')
          .single();

        if (profileError) throw profileError;

        if (mounted && data) {
          // data has type { discord_username: string | null; is_admin: boolean }
          setProfile(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [session]);

  const handleSignIn = async () => {
    try {
      setError(null);
      await signInWithDiscord();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSignOut = async () => {
    try {
      setError(null);
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (configError) {
    return (
      <div className="app-container">
        <h1>Crystal Of Atlan</h1>
        <div className="error-message">Error: {configError}</div>
      </div>
    );
  }

  if (loading) {
    return <div className="app-container">Loading...</div>;
  }

  return (
    <div className="app-container">
      <h1>Crystal Of Atlan</h1>
      
      {error && <div className="error-message">Error: {error}</div>}

      {!session ? (
        <button onClick={handleSignIn} className="button">
          Sign in with Discord
        </button>
      ) : (
        <div className="profile-container">
          <div className="profile-info">
            <span className="username">{profile?.discord_username || session.user.email}</span>
            {profile?.is_admin && <span className="admin-badge">Admin</span>}
          </div>
          <button onClick={handleSignOut} className="button button-outline">
            Sign out
          </button>
        </div>
      )}

      <p className="footer-text">Planner coming next.</p>
    </div>
  );
}
