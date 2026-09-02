import { signInWithDiscord } from '../lib/auth';
import coaLogo from '../assets/images/Crystal Of Atlan Logo.avif';
import './LandingScreen.css';
import ErrorBanner from '../ui/ErrorBanner';

export default function LandingScreen({ error }: { error?: string | null }) {
  return (
    <div className="landing-screen">
      {/* Background color blobs for richness */}
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

      <div className="landing-hero">
        <div className="hero-content slide-up">
          <span className="hero-kicker">WEEKLY DUNGEON PLANNER</span>
          <h1 className="hero-h1">Maximize your gold.<br/>Optimize your attempts.</h1>
          <p className="hero-p">
            The planner mathematically assigns each weekly dungeon attempt to the character that turns it into the most gold, taking the guesswork out of your weekly resets.
          </p>
          <div className="hero-actions">
            <button className="btn-primary pulse" onClick={() => void signInWithDiscord()}>
              SIGN IN WITH DISCORD
            </button>
          </div>
        </div>

        <div className="hero-graphic fade-in-delayed">
          <div className="crystal-rings">
            <div className="ring r1"></div>
            <div className="ring r2"></div>
            <div className="ring r3"></div>
            <div className="ring r4"></div>
            <div className="ring r5"></div>
          </div>
          <div className="floating-badge-center">
            <img src={coaLogo} alt="Crystal of Atlan Logo" className="floating-coa-logo" />
          </div>
        </div>
      </div>
      
      <div className="landing-footer fade-in-delayed">
        <span>MADE BY ZTERIA</span>
      </div>
    </div>
  );
}
