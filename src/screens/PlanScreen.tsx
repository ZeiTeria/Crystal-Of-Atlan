import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '../hooks/useMutation';
import Button from '../ui/Button';
import { currentGameAccountId } from '../data/accounts';
import { loadPlanInput } from '../data/loadPlanInput';
import { logRun, logRuns } from '../data/runs';
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
import { nextReset } from '../engine/resetWindow';
import Meter from '../ui/Meter';
import { groupSpans, matrixColumns } from './columns';
import CharacterPicker from '../ui/CharacterPicker';
import { PHONE, useMediaQuery } from '../ui/useMediaQuery';
import ErrorBanner from '../ui/ErrorBanner';

/**
 * Time left until the gold cap resets. The boundary is recomputed from the
 * ticking clock rather than passed in, so the display rolls straight over to
 * the following week the moment one reset passes.
 */
function Countdown({ settings }: { settings: PlanInput['settings'] }) {
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
    <span className="num">
      {days}d {hours}h {minutes.toString().padStart(2, '0')}m {seconds.toString().padStart(2, '0')}s
    </span>
  );
}

/**
 * A note for a dungeon whose gold is partly guessed, or null when every tier
 * has a real figure. Shown as a title so the reason is one hover away rather
 * than taking a column, and the figure itself still reads normally.
 */
function estimateNote(dungeon: { name: string; goldEstimated: string[] }): string | null {
  if (dungeon.goldEstimated.length === 0) return null;
  const tiers = dungeon.goldEstimated.join(', ');
  return (
    `Needs data: ${dungeon.name} has no gold figure for ${tiers}. ` +
    `Another tier's figure is standing in, so this plan is an estimate. ` +
    `Fill it in on the Dungeons tab.`
  );
}

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
  const [phoneCharacterId, setPhoneCharacterId] = useState<string | null>(null);
  const isPhone = useMediaQuery(PHONE);

  const solveFn = useCallback(async () => {
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
    } catch (err: unknown) {
      setSolved(null);
      throw err;
    }
  }, []);

  const { busy, error, mutate, refresh: solve } = useMutation(solveFn);

  useEffect(() => {
    void solve().catch(() => setSolved(null));
  }, [solve]);

  async function markDone(characterId: string, dungeonId: string, goldPerRun: number) {
    await mutate(async () => {
      await logRun(characterId, dungeonId, goldPerRun);
    });
  }

  async function markAllDone(characterId: string, dungeonId: string, goldPerRun: number, count: number) {
    if (count <= 0) return;
    await mutate(async () => {
      const runs = Array(count).fill({ character_id: characterId, dungeon_id: dungeonId, gold_earned: goldPerRun });
      await logRuns(runs);
    });
  }

  if (!solved) {
    return (
      <>
        <p>{error ? `Error: ${error}` : 'Solving...'}</p>
        {error && (
          <Button disabled={busy} onClick={() => void solve()}>
            Retry
          </Button>
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

  // Same order as the Grid: newest dungeon leftmost.
  const columns = matrixColumns(input.dungeons);
  const spans = groupSpans(columns);

  // The phone shows one character at a time. Falls back to the first rather
  // than showing nothing when the selection names a character that has since
  // been deleted or parked.
  const shownCharacter =
    input.characters.find((c) => c.id === phoneCharacterId) ?? input.characters[0];

  return (
    <section>
      <div className="plan-head">
        <h2>Plan</h2>
        <span className="muted plan-countdown">
          Resets in: <strong><Countdown settings={input.settings} /></strong>
        </span>
      </div>
      <ErrorBanner message={error} />

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

          <p className="muted">Newest dungeon first, matching the Grid.</p>

          <h3>Weekly Gold Progress</h3>
          <ul className="goldlist">
            {input.characters.map((c) => {
              const cap = input.settings.goldCap;
              const headroom = input.goldHeadroom[c.id] ?? cap;
              const earned = cap - headroom;
              const isCapped = earned >= cap;
              return (
                <li key={c.id}>
                  <strong>{c.name}</strong>: <span className="num">{gold(earned)}</span> /{' '}
                  <span className="num">{gold(cap)}</span>{' '}
                  {isCapped && <span className="warning-text">(Capped!)</span>}
                  <Meter value={earned} max={cap} tone={isCapped ? 'warn' : 'accent'} />
                </li>
              );
            })}
          </ul>

          {isPhone ? (
            <>
              <CharacterPicker
                characters={input.characters}
                selectedId={shownCharacter?.id ?? null}
                onSelect={setPhoneCharacterId}
              />
              {shownCharacter && (
                <div className="pcard">
                  {(() => {
                    const mine = result.assignments.filter(
                      (a) => a.characterId === shownCharacter.id,
                    );
                    if (mine.length === 0) {
                      return <p className="muted">Nothing planned for {shownCharacter.name}.</p>;
                    }
                    return mine.map((a) => {
                      const d = columns.find((x) => x.id === a.dungeonId);
                      return (
                        <div className="prow" key={a.dungeonId}>
                          <div className="info">
                            <span className="dn">{d?.name ?? a.dungeonId}</span>
                            <span
                              className={d && estimateNote(d) ? 'sub num needsdata' : 'sub num'}
                              title={(d && estimateNote(d)) || undefined}
                            >
                              {gold(a.goldPerRun)} each &middot; {gold(a.goldTotal)} total
                              {d && estimateNote(d) ? ' ?' : ''}
                            </span>
                          </div>
                          <div className="act">
                            <span className="big num">{a.runs}</span>
                            <Button
                              disabled={busy}
                              aria-label={`Log one run of ${d?.name ?? ''} by ${shownCharacter.name}`}
                              onClick={() => void markDone(a.characterId, a.dungeonId, a.goldPerRun)}
                            >
                              Log 1
                            </Button>
                            {a.runs > 1 && (
                              <Button
                                variant="outline"
                                disabled={busy}
                                aria-label={`Log all ${a.runs} runs of ${d?.name ?? ''} by ${shownCharacter.name}`}
                                onClick={() =>
                                  void markAllDone(a.characterId, a.dungeonId, a.goldPerRun, a.runs)
                                }
                              >
                                All
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </>
          ) : (
          <div className="datatable-scroll plan-scroll matrix-scroll">
            <table className="datatable matrix plan-matrix">
              <thead>
                <tr className="groupband">
                  <th />
                  {spans.map((span, i) => (
                    <th key={i} colSpan={span.span} className={span.label ? 'grouped' : undefined}>
                      {span.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th scope="col" className="plan-who">
                    Character
                  </th>
                  {columns.map((d) => (
                    <th key={d.id} scope="col">
                      {d.name}
                      {estimateNote(d) && (
                        <span className="needsdata" title={estimateNote(d) ?? undefined}>
                          {' '}
                          ?
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {input.characters.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">{c.name}</th>
                    {columns.map((d) => {
                      const assignment = result.assignments.find(
                        (a) => a.characterId === c.id && a.dungeonId === d.id,
                      );
                      if (!assignment) {
                        return (
                          <td key={d.id} className="muted center">
                            -
                          </td>
                        );
                      }
                      return (
                        <td key={d.id}>
                          <div className="cellstack">
                            <strong className="runs num">{assignment.runs}x</strong>
                            <div className="row-actions rowbtns">
                              <Button
                                disabled={busy}
                                aria-label={`Log one run of ${d.name} by ${c.name}`}
                                onClick={() => void markDone(c.id, d.id, assignment.goldPerRun)}
                              >
                                Log 1
                              </Button>
                              {assignment.runs > 1 && (
                                <Button variant="outline"
                                  disabled={busy}
                                  aria-label={`Log all ${assignment.runs} runs of ${d.name} by ${c.name}`}
                                  onClick={() =>
                                    void markAllDone(c.id, d.id, assignment.goldPerRun, assignment.runs)
                                  }
                                >
                                  All
                                </Button>
                              )}
                            </div>
                            <span
                              className={
                                estimateNote(d) ? 'muted cellgold num needsdata' : 'muted cellgold num'
                              }
                              title={estimateNote(d) ?? undefined}
                            >
                              {gold(assignment.goldTotal)}
                              {estimateNote(d) ? ' ?' : ''}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

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
