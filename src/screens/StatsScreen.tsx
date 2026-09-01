import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '../hooks/useMutation';
import { currentGameAccountId, listCharacters } from '../data/accounts';
import { listAllRuns } from '../data/runs';
import { loadPlanInput } from '../data/loadPlanInput';
import { lastReset } from '../engine/resetWindow';
import { gold } from './planText';

export default function StatsScreen() {
  const [loading, setLoading] = useState(true);
  const [weeklyTotals, setWeeklyTotals] = useState<Map<number, number>>(new Map());

  const refreshFn = useCallback(async () => {
    const accountId = await currentGameAccountId();
    const characters = await listCharacters(accountId);
    if (characters.length === 0) {
      setWeeklyTotals(new Map());
      return;
    }

    const input = await loadPlanInput(accountId, new Date());
    const settings = input.settings;

    const runs = await listAllRuns(characters.map((c) => c.id));
    
    // Group by week (timestamp of the reset that started the week)
    const totals = new Map<number, number>();
    for (const run of runs) {
      const reset = lastReset(settings.goldResetWeekday, settings.resetHour, settings.timeZone, new Date(run.ran_at));
      const weekTime = reset.getTime();
      totals.set(weekTime, (totals.get(weekTime) ?? 0) + run.gold_earned);
    }
    
    setWeeklyTotals(totals);
  }, []);

  const { error, refresh } = useMutation(refreshFn);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  if (loading) return <p>Loading stats...</p>;

  // Sort weeks descending (newest first)
  const weeks = Array.from(weeklyTotals.entries()).sort((a, b) => b[0] - a[0]);

  return (
    <section>
      <h2>Historical Stats</h2>
      {error && <div className="error-message">Error: {error}</div>}
      
      {weeks.length === 0 ? (
        <p className="muted">No runs logged yet to show stats.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Week of</th>
              <th style={{ textAlign: 'right' }}>Total Gold Earned</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map(([weekTime, goldTotal]) => {
              const date = new Date(weekTime).toLocaleDateString();
              return (
                <tr key={weekTime}>
                  <td>{date}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    <strong>{gold(goldTotal)}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
