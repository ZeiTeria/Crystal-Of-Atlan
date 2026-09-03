import Button from './Button';
import './OnboardingPopup.css';

export default function OnboardingPopup({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay">
      <div className="onboarding-popup">
        <h2>Welcome to the Planner</h2>
        <ol className="onboarding-steps">
          <li>
            <strong>Add a character</strong>
            <p>Give them a name and class, and set which tiers they have cleared.</p>
          </li>
          <li>
            <strong>The Plan page</strong>
            <p>It computes the optimal path for your roster to maximize gold, then attempts, within the weekly cap.</p>
          </li>
          <li>
            <strong>The dungeon data</strong>
            <p>Gold figures are shown below the plan. They include base drops and a blended estimate of stone drops.</p>
          </li>
        </ol>
        <div className="onboarding-actions">
          <Button onClick={onClose}>Get Started</Button>
        </div>
      </div>
    </div>
  );
}

