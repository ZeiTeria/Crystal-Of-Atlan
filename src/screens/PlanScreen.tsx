import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '../hooks/useMutation';
import Button from '../ui/Button';
import { currentGameAccountId } from '../data/accounts';
import { loadPlanInput } from '../data/loadPlanInput';
import {
  attemptCeiling,
  explainCeiling,
  goldCapCeiling,
  noContention,
  type Reason,
} from '../engine/ceilings';
import { solveOptimal } from '../engine/solver';
import type { PaidTier, PlanInput, PlanResult, Tier } from '../engine/types';
import { describeConflict, describeReason, gold, type Names } from './planText';
import InfoDot from '../ui/InfoDot';
import DensityToggle from '../ui/DensityToggle';
import { useDensity } from '../ui/density';
import { suggestAbbreviation } from './abbreviate';
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
 * Why a cell's gold cannot be trusted, or null when it can.
 *
 * Deliberately per CELL and per TIER, not per dungeon: a dungeon can know
 * exactly what elite pays and nothing about legend, and a character running it
 * at elite has a figure that is simply correct. Flagging the whole dungeon
 * marked those cells too, which trains the eye to ignore the mark.
 *
 * It points at @zteria rather than the Dungeons tab because the catalogue is
 * admin-only: telling a player to edit a screen they cannot open is worse than
 * saying nothing.
 */
function goldWarning(
  dungeon: { name: string; goldEstimated: PaidTier[]; goldUnknown: boolean },
  tier: Tier | undefined,
): string | null {
  if (dungeon.goldUnknown) {
    return `${dungeon.name} has no gold figures at all, so this plan cannot weigh it against anything else. Contact @zteria on Discord to get it filled in.`;
  }
  if (!tier || tier === 'none') return null;
  if (!dungeon.goldEstimated.includes(tier)) return null;
  return `${dungeon.name} has no gold figure for ${tier}. Another difficulty's figure is standing in, so this row is an estimate. Contact @zteria on Discord to get it filled in.`;
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
  const [density] = useDensity();

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

  // No `mutate`: the Plan is read-only now. Solving is a refresh, not a write.
  const { busy, error, refresh: solve } = useMutation(solveFn);

  useEffect(() => {
    void solve().catch(() => setSolved(null));
  }, [solve]);

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

  // The tier a character enters a dungeon at, which is what decides whether the
  // gold figure behind a cell is real.
  const tierOf = new Map(input.grid.map((g) => [`${g.characterId}:${g.dungeonId}`, g.tier]));

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

          <div className="row-actions density-row">
            <DensityToggle />
            <span className="muted">Newest dungeon first, matching the Grid.</span>
          </div>

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
                            <span className="sub num cellgold-line">
                              {gold(a.goldPerRun)} each &middot; {gold(a.goldTotal)} total
                              {(() => {
                                const why = d
                                  ? goldWarning(d, tierOf.get(`${shownCharacter.id}:${d.id}`))
                                  : null;
                                return why ? <InfoDot label={why}>{why}</InfoDot> : null;
                              })()}
                            </span>
                          </div>
                          <div className="act">
                            <span className="big num">{a.runs}</span>
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
            <table className={`datatable matrix plan-matrix ${density === 'simple' ? 'matrix-simple' : ''}`}>
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
                    <th key={d.id} scope="col" title={d.name}>
                      {density === 'simple'
                        ? (d.short_name ?? suggestAbbreviation(d.name, d.group_name))
                        : d.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {input.characters.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">
                      <span className="who-name">{c.name}</span>
                      {(() => {
                        // Gold sits with the name rather than in a list above the
                        // table: it is a property of the character, and the row
                        // header is the one place already carrying those.
                        const cap = input.settings.goldCap;
                        const earned = cap - (input.goldHeadroom[c.id] ?? cap);
                        const capped = earned >= cap;
                        return (
                          <>
                            <span className={capped ? 'who-gold num warning-text' : 'who-gold num'}>
                              {gold(earned)} / {gold(cap)}
                              {capped ? ' · capped' : ''}
                            </span>
                            <Meter value={earned} max={cap} tone={capped ? 'warn' : 'accent'} />
                          </>
                        );
                      })()}
                    </th>
                    {columns.map((d) => {
                      const assignment = result.assignments.find(
                        (a) => a.characterId === c.id && a.dungeonId === d.id,
                      );
                      if (!assignment) {
                        return (
                          <td key={d.id} className="muted center runcell runs-0">
                            -
                          </td>
                        );
                      }
                      return (
                        <td key={d.id} className={`runcell runs-${Math.min(assignment.runs, 3)}`}>
                          <div className="cellstack">
                            <strong className="runs num">{assignment.runs}x</strong>
                            <span className="cellgold-line">
                              <span className="muted cellgold num">
                                {gold(assignment.goldTotal)}
                              </span>
                              {(() => {
                                const why = goldWarning(d, tierOf.get(`${c.id}:${d.id}`));
                                return why ? <InfoDot label={why}>{why}</InfoDot> : null;
                              })()}
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

          <h3>Attempts left over</h3>
          <p className="muted">
            How many of this week's remaining attempts the plan does not use. A "?" says why
            the leftover is not zero; nothing to explain means nothing is wasted.
          </p>
          <table className="datatable leftovers">
            <thead>
              <tr>
                <th scope="col">Dungeon</th>
                <th scope="col" className="num">
                  Left over / remaining
                </th>
              </tr>
            </thead>
            <tbody>
              {columns.map((d) => {
                const remaining = input.accountAttemptsLeft[d.id] ?? 0;
                const planned = result.assignments
                  .filter((a) => a.dungeonId === d.id)
                  .reduce((sum, a) => sum + a.runs, 0);
                const leftOver = Math.max(0, remaining - planned);
                // Prefer the solver's own account of this dungeon; fall back to
                // the general reason, which is always one of these three.
                const reason = solved.reasons.find(
                  (r) => 'dungeonId' in r && r.dungeonId === d.id,
                );
                const why = reason
                  ? describeReason(reason, names)
                  : `${leftOver} attempts on ${d.name} are left unused. Either no character has it unlocked at a difficulty worth running, or the characters that do have hit their own weekly limit or their gold cap.`;
                return (
                  <tr key={d.id}>
                    <th scope="row" title={d.name}>
                      {density === 'simple'
                        ? (d.short_name ?? suggestAbbreviation(d.name, d.group_name))
                        : d.name}
                    </th>
                    <td className="num">
                      <span className="leftover-line">
                        <span className={leftOver > 0 ? 'warning-text' : undefined}>
                          {leftOver} / {remaining}
                        </span>
                        {leftOver > 0 && <InfoDot label={why}>{why}</InfoDot>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {solved.reasons.some((r) => r.kind === 'gold-cap-reached') && (
            <ul className="muted">
              {solved.reasons
                .filter((r) => r.kind === 'gold-cap-reached')
                .map((r, i) => (
                  <li key={i}>{describeReason(r, names)}</li>
                ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
