import { useEffect, useState } from 'react';
import { applyTheme, readStoredTheme, storeTheme, type Theme } from './theme';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function choose(next: Theme) {
    storeTheme(next);
    setTheme(next);
  }

  return (
    <div className="themetoggle" role="group" aria-label="Theme">
      {(['dark', 'light'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => choose(option)}
        >
          {option === 'dark' ? 'Dark' : 'Light'}
        </button>
      ))}
    </div>
  );
}
