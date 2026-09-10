import { signInWithDiscord } from '../lib/auth';
import coaLogo from '../assets/images/Crystal Of Atlan Logo.avif';
import './LandingScreen.css';
import ErrorBanner from '../ui/ErrorBanner';

export default function LandingScreen({ error }: { error?: string | null }) {
  return (
    <div className="landing-screen">
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
      <div className="bg-blob blob-3"></div>

      <div className="landing-header fade-in">
        <div className="brand">
          <img src={coaLogo} alt="Crystal of Atlan Logo" className="brand-logo-img" />
          <span className="brand-text">CRYSTAL OF ATLAN</span>
        </div>
      </div>

      <ErrorBanner message={error ?? null} />

      <div className="landing-hero" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div className="hero-content slide-up" style={{ alignItems: 'center' }}>
          <h1 className="hero-h1">Welcome to Crystal of Atlan</h1>
          <p className="hero-p" style={{ maxWidth: '600px' }}>
            Sign in to start planning your dailies and weeklies.
          </p>
          <div className="hero-actions" style={{ marginTop: '2rem' }}>
            <button className="btn-primary" onClick={() => void signInWithDiscord()}>
              Sign In with Discord
            </button>
          </div>
        </div>
      </div>
      
      <div className="landing-footer fade-in-delayed">
        <span>MADE BY ZTERIA</span>
      </div>
    </div>
  );
}
