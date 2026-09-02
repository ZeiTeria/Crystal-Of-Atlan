import { useState } from 'react';
import type { Reason } from '../engine/ceilings';
import type { PlanAssignment, PlanInput, PlanTotals, Tier } from '../engine/types';
import CharacterPicker from '../ui/CharacterPicker';
import InfoDot from '../ui/InfoDot';
import { DiamondDot, Portrait, getClassHue, getGroupHue } from '../ui/Shared';
import { PHONE, useMediaQuery } from '../ui/useMediaQuery';
import { matrixColumns } from './columns';
import { goldWarning, leftoverText } from './goldWarning';
import { describeReason, gold, type Names } from './planText';
import './AttemptBoard.css';

interface AttemptBoardProps {
  input: PlanInput;
  assignments: PlanAssignment[];
  totals: PlanTotals;
  reasons: Reason[];
  goldCeiling: number;
  attemptsCeiling: number;
  names: Names;
  onAddClick?: () => void;
}

/**
 * The whole week at a glance: one card per dungeon, every remaining attempt
 * drawn as a slot. A filled slot is coloured by the character that spends it;
 * a hatched one is an attempt the plan cannot use - the same number the summary
 * strip counts and the card's "?" explains.
 */
export default function AttemptBoard({
  input,
  assignments,
  totals,
  reasons,
  goldCeiling,
  attemptsCeiling,
  names,
  onAddClick,
}: AttemptBoardProps) {
  const isPhone = useMediaQuery(PHONE);
  const [shownId, setShownId] = useState<string | null>(null);

  const { characters, accountAttemptsLeft, settings } = input;
  // Same order as the Grid and the Dungeons tab: newest dungeon first.
  const dungeons = matrixColumns(input.dungeons);

  // The tier a character enters a dungeon at, which is what decides whether the
  // gold figure behind its runs is real. loadPlanInput has already merged each
  // dungeon's default in, so the grid is the whole answer.
  const tierOf = new Map<string, Tier>(
    input.grid.map((g) => [`${g.characterId}:${g.dungeonId}`, g.tier]),
  );

  // The phone shows one character at a time. Falls back to the first rather
  // than showing nothing when the selection names a character that has since
  // been deleted or parked.
  const shown = characters.find((c) => c.id === shownId) ?? characters[0];

  let totalLeftOver = 0;
  let totalRemaining = 0;
  for (const d of dungeons) {
    const remaining = accountAttemptsLeft[d.id] ?? 0;
    const used = assignments
      .filter((a) => a.dungeonId === d.id)
      .reduce((sum, a) => sum + a.runs, 0);
    totalRemaining += remaining;
    totalLeftOver += Math.max(0, remaining - used);
  }

  return (
    <div className="attempt-board">
      <div className="board-summary-strip">
        <div className="summary-left">
          <span className="summary-label">Attempts left over</span>
          <span className="summary-numbers">
            <strong>{totalLeftOver}</strong>
            <span>/ {totalRemaining}</span>
          </span>
          <span className="summary-note">
            <span className="empty-box" /> Nothing else can be spent on these.
          </span>
        </div>

        <div className="roster-tiles">
          {characters.map((c) => {
            const hue = getClassHue(c.class, c.name);
            const runs = assignments
              .filter((a) => a.characterId === c.id)
              .reduce((sum, a) => sum + a.runs, 0);
            const cap = settings.goldCap;
            const earned = cap - (input.goldHeadroom[c.id] ?? cap);
            const capped = earned >= cap;
            return (
              <div key={c.id} className="roster-tile">
                <div className="tile-top">
                  <Portrait name={c.name} hue={hue} dim={runs === 0} />
                  <div className="tile-name-col">
                    <strong>{c.name}</strong>
                    <span>{runs} runs planned</span>
                  </div>
                </div>
                <div className="tile-bottom">
                  <div className="tile-gold-row">
                    <span className={capped ? 'warning-text' : undefined}>{gold(earned)}</span>
                    <span>{capped ? 'capped' : `${Math.round((earned / cap) * 100)}%`}</span>
                  </div>
                  <div className="tile-meter">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${Math.min(100, (earned / cap) * 100)}%`,
                        backgroundColor: capped ? 'var(--warn)' : hue,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <button type="button" className="add-character-btn" onClick={onAddClick}>
            + Add
          </button>
        </div>
      </div>

      {/* One element, so every number below reads as one sentence: the plan, and
          the two ceilings that stop it going further. */}
      <p className="board-ceiling">
        Planned: {totals.attempts} runs, {gold(totals.gold)} gold — the caps allow at most{' '}
        {gold(Math.min(goldCeiling, attemptsCeiling))} ({gold(goldCeiling)} by the gold cap,{' '}
        {gold(attemptsCeiling)} by attempts). Weekly-quest pairs covered: {totals.coverage}.
      </p>

      {isPhone && (
        <CharacterPicker
          characters={characters}
          selectedId={shown?.id ?? null}
          onSelect={setShownId}
        />
      )}

      <div className="board-grid">
        {dungeons.map((d) => {
          const mine = assignments.filter((a) => a.dungeonId === d.id);
          const used = mine.reduce((sum, a) => sum + a.runs, 0);
          const remaining = accountAttemptsLeft[d.id] ?? 0;
          const leftOver = Math.max(0, remaining - used);

          // Prefer the solver's own account of this dungeon; fall back to the
          // general reason, which is always one of these three.
          const reason = reasons.find((r) => 'dungeonId' in r && r.dungeonId === d.id);
          const why = reason ? describeReason(reason, names) : leftoverText(d.name, leftOver);

          // A dungeon with no figures at all is one mark on the dungeon, not the
          // same sentence repeated on every character that runs it.
          const dungeonWarning = goldWarning(d, undefined);

          return (
            <div key={d.id} className="board-card">
              <div className="card-header">
                <div className="card-title">
                  <span className="group-tag" style={{ color: getGroupHue(d.group_name) }}>
                    {d.group_name ?? ''}
                  </span>
                  <strong>{d.name}</strong>
                  {dungeonWarning && <InfoDot label={dungeonWarning}>{dungeonWarning}</InfoDot>}
                </div>
                <div className="card-used">
                  <strong>{used}</strong>
                  <span>of {remaining} left</span>
                </div>
              </div>

              <div className="card-slots">
                {mine.flatMap((a) =>
                  Array.from({ length: a.runs }, (_, i) => (
                    <span
                      key={`${a.characterId}-${i}`}
                      className="slot filled"
                      style={{
                        backgroundColor: getClassHue(
                          characters.find((c) => c.id === a.characterId)?.class,
                          names.character(a.characterId),
                        ),
                      }}
                    />
                  )),
                )}
                {Array.from({ length: leftOver }, (_, i) => (
                  <span key={`empty-${i}`} className="slot empty" />
                ))}
              </div>

              <div className="card-who-list">
                {mine
                  .filter((a) => !isPhone || !shown || a.characterId === shown.id)
                  .map((a) => {
                    const character = characters.find((c) => c.id === a.characterId);
                    const cellWarning = dungeonWarning
                      ? null
                      : goldWarning(d, tierOf.get(`${a.characterId}:${d.id}`));
                    return (
                      <div key={a.characterId} className="who-row">
                        <DiamondDot hue={getClassHue(character?.class, character?.name)} />
                        <span className="who-name">{names.character(a.characterId)}</span>
                        <span className="who-n">{a.runs}&times;</span>
                        <span className="who-gold">{gold(a.goldTotal)}</span>
                        {cellWarning && <InfoDot label={cellWarning}>{cellWarning}</InfoDot>}
                      </div>
                    );
                  })}
                {mine.length === 0 && <span className="who-none">Nobody can run this one.</span>}
              </div>

              <div className="card-footer">
                <span className="leftover-line">
                  <span className={leftOver > 0 ? 'warning-text' : undefined}>
                    {leftOver} / {remaining}
                  </span>{' '}
                  left over
                  {leftOver > 0 && <InfoDot label={why}>{why}</InfoDot>}
                </span>
                <span>Max {d.characterAttempts} / char</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
