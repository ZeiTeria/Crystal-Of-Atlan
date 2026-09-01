import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../errorMessage';
import { currentGameAccountId } from '../data/accounts';
import { loadPlanInput } from '../data/loadPlanInput';
import { logRun } from '../data/runs';
import {
  attemptCeiling,
  explainCeiling,
  goldCapCeiling,
  noContention,
  type Reason,
} from '../engine/ceilings';
import { solveOptimal } from '../engine/solver';
import type { PlanInput, PlanResult } from '../engine/types';
import { describeConflict, describeReason, gold, type Names } from './planText';

interface Solved {
  input: PlanInput;
  result: PlanResult;
  reasons: Reason[];
  relaxed: boolean;
  goldCeiling: number;
  attemptsCeiling: number;
}

export default function PlanScreen() {
  const [solved, setSolved] = useState<Solved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const solve = useCallback(async () => {
    setBusy(true);
    // Clear any stale error up front so a Retry shows "Solving..." while the
    // new attempt is in flight, rather than leaving the old failure on screen
    // looking unchanged until this attempt itself settles.
    setError(null);
    try {
      const accountId = await currentGameAccountId();
      const input = await loadPlanInput(accountId);
      const result = await solveOptimal(input);
      setSolved({
        input,
        result,
        reasons: explainCeiling(input, result),
        relaxed: noContention(input),
        goldCeiling: goldCapCeiling(input),
        attemptsCeiling: attemptCeiling(input),
      });
      setError(null);
    } catch (err: unknown) {
      // A failed re-solve leaves `solved` pointing at a plan the database no
      // longer agrees with, so the stale snapshot is dropped rather than kept
      // actionable — every Done button disappears along with it.
      setError(errorMessage(err));
      setSolved(null);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void solve();
  }, [solve]);

  async function markDone(characterId: string, dungeonId: string, goldPerRun: number) {
    // Raised before any await: `disabled={busy}` only takes effect once React
    // re-renders, which happens synchronously before the next click can be
    // dispatched — but only if this is set before the first await, not after.
    setBusy(true);
    try {
      await logRun(characterId, dungeonId, goldPerRun);
      setError(null);
    } catch (err: unknown) {
      setError(errorMessage(err));
      setBusy(false);
      return;
    }
    // Re-solve against what is left, rather than decrementing a local number:
    // one logged run can change which dungeons the rest of the week should use.
    await solve();
  }

  if (!solved) {
    return (
      <>
        <p>{error ? `Error: ${error}` : 'Solving...'}</p>
        {error && (
          <button className="button" disabled={busy} onClick={() => void solve()}>
            Retry
          </button>
        )}
      </>
    );
  }

  const { input, result } = solved;
  const names: Names = {
    character: (id) => input.characters.find((c) => c.id === id)?.name ?? id,
    dungeon: (id) => input.dungeons.find((d) => d.id === id)?.name ?? id,
  };

  if (input.characters.length === 0) {
    return (
      <section>
        <h2>Plan</h2>
        <p className="muted">Add a character to plan for.</p>
      </section>
    );
  }

  if (input.grid.length === 0) {
    return (
      <section>
        <h2>Plan</h2>
        <p className="muted">
          Nothing is unlocked yet — set each character&rsquo;s tier per dungeon on the Grid tab.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2>Plan</h2>
      {error && <div className="error-message">Error: {error}</div>}

      {result.status === 'infeasible' ? (
        <>
          <p>These requirements cannot all be met:</p>
          <ul>
            {result.conflicts.map((c, i) => (
              <li key={i}>{describeConflict(c, names)}</li>
            ))}
          </ul>
          <p className="muted">Lower a minimum on the Grid tab, then come back.</p>
        </>
      ) : (
        <>
          {solved.relaxed && (
            <p>
              <strong>No choices to make</strong> — every character can simply run its maximum.
            </p>
          )}

          <table>
            <thead>
              <tr>
                <th>Character</th>
                <th>Dungeon</th>
                <th>Runs</th>
                <th>Gold each</th>
                <th>Gold total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.assignments.map((a) => (
                <tr key={`${a.characterId}:${a.dungeonId}`}>
                  <td>{names.character(a.characterId)}</td>
                  <td>{names.dungeon(a.dungeonId)}</td>
                  <td>{a.runs}</td>
                  <td>{gold(a.goldPerRun)}</td>
                  <td>{gold(a.goldTotal)}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="button"
                        disabled={busy}
                        aria-label={`Mark one run of ${names.dungeon(a.dungeonId)} by ${names.character(a.characterId)} as done`}
                        onClick={() => void markDone(a.characterId, a.dungeonId, a.goldPerRun)}
                      >
                        Done
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.assignments.length === 0 && (
            <p className="muted">Nothing left to run this week.</p>
          )}

          <h3>This week</h3>
          <ul>
            <li>Runs planned: {result.totals.attempts}</li>
            <li>Weekly-quest pairs covered: {result.totals.coverage}</li>
            <li>
              Gold: {gold(result.totals.gold)} — the caps allow at most{' '}
              {gold(Math.min(solved.goldCeiling, solved.attemptsCeiling))} (
              {gold(solved.goldCeiling)} by the gold cap, {gold(solved.attemptsCeiling)} by
              attempts)
            </li>
          </ul>

          {solved.reasons.length > 0 && (
            <>
              <h3>Why it stops there</h3>
              <ul>
                {solved.reasons.map((r, i) => (
                  <li key={i}>{describeReason(r, names)}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
