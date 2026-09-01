import { useDensity, type Density } from './density';
import './DensityToggle.css';

const OPTIONS: { value: Density; label: string }[] = [
  { value: 'simple', label: 'Simple' },
  { value: 'detailed', label: 'Detailed' },
];

export default function DensityToggle() {
  const [density, setDensity] = useDensity();
  return (
    <div className="densitytoggle" role="group" aria-label="Table detail">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={density === option.value}
          onClick={() => setDensity(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
