import { useEffect, useState } from 'react';
import { nextReset } from '../engine/resetWindow';
import type { PlanInput } from '../engine/types';

/**
 * Time left until the gold cap resets. The boundary is recomputed from the
 * ticking clock rather than passed in, so the display rolls straight over to
 * the following week the moment one reset passes.
 */
export default function Countdown({ settings }: { settings: PlanInput['settings'] }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Strictly ahead of `now` by construction, so this can never read zero.
  const diff =
    nextReset(settings.goldResetWeekday, settings.resetHour, settings.timeZone, now).getTime()
    - now.getTime();

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return (
    <span className="num countdown">
      {days}d {hours}h {minutes.toString().padStart(2, '0')}m {seconds.toString().padStart(2, '0')}s
    </span>
  );
}
