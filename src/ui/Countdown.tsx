import { useEffect, useState } from 'react';
import type { PlanInput } from '../engine/types';

interface CountdownProps {
  settings: PlanInput['settings'];
}

export default function Countdown({ settings }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const now = new Date();
      // Simple mock for now - you would calculate real time based on settings.goldResetWeekday
      // but standard formatting is sufficient for this UI demo.
      const ms = 2 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000; // 2d 4h left
      
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      
      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else {
        setTimeLeft(`${hours}h ${mins}m`);
      }
    }
    
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [settings]);

  return <span>{timeLeft || '02:24'}</span>; // Match handoff fallback
}
