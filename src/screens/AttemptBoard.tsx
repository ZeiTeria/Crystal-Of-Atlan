import { useState } from 'react';
import type { Reason } from '../engine/ceilings';
import type { PlanAssignment, PlanInput, PlanTotals, Tier } from '../engine/types';
import CharacterPicker from '../ui/CharacterPicker';
import InfoDot from '../ui/InfoDot';
import { DiamondDot, Portrait } from '../ui/Shared';
import { getClassHue, getGroupHue } from '../ui/hues';
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
  /** The roster is full, so adding is offered but refused. */
  atCap?: boolean;
  maxCharacters?: number;
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
  atCap,
  maxCharacters,
  onAddClick,
}: AttemptBoardProps) {
  const isPhone = useMediaQuery(PHONE);
  const [shownId, setShownId] = useState<string | null>(null);
  // Pointing at a character picks its attempts out of every card at once,
  // which is the only way to read "what does THIS one actually do this week"
  // off a board sorted by dungeon.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  // The binding ceiling: whichever cap runs out first.
  const ceiling = Math.min(goldCeiling, attemptsCeiling);

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
      <div className={hoveredId ? 'board-summary-strip is-picking' : 'board-summary-strip'}>
        <div className="summary-left">
          <span className="summary-label">Attempts used</span>
          <span className="summary-numbers">
            <strong>{totalRemaining - totalLeftOver}</strong>
            <span>/ {totalRemaining}</span>
          </span>
          <span className="summary-note">
            {totalLeftOver > 0 ? (
              <>
                <span className="empty-box" /> {totalLeftOver} cannot be spent — marked on the
                cards below.
              </>
            ) : (
              'Every remaining attempt is spent.'
            )}
          </span>
        </div>

        <div className="roster-tiles">
          {characters.map((c) => {
            const hue = getClassHue(c.class, c.name);
            const mine = assignments.filter((a) => a.characterId === c.id);
            const runs = mine.reduce((sum, a) => sum + a.runs, 0);
            const cap = settings.goldCap;
            // The gold this character's PLAN earns, not what it has earned.
            // Runs are never logged, so the second was permanently zero and
            // every one of these meters sat empty.
            const planned = mine.reduce((sum, a) => sum + a.goldTotal, 0);
            const capped = planned >= cap;
            return (
              <div
                key={c.id}
                className={hoveredId && hoveredId !== c.id ? 'roster-tile dim' : 'roster-tile'}
                style={hoveredId === c.id ? { backgroundColor: `${hue}14` } : undefined}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="tile-top">
                  <Portrait name={c.name} hue={hue} dim={runs === 0} characterClass={c.class} />
                  <div className="tile-name-col">
                    <strong>{c.name}</strong>
                    <span className="tile-runs">
                      <strong style={{ color: runs > 0 ? hue : undefined }}>{runs}</strong> runs
                    </span>
                  </div>
                </div>
                <div className="tile-bottom">
                  <div className="tile-gold-row">
                    <span className={capped ? 'warning-text' : undefined}>{gold(planned)}</span>
                    <span>{capped ? 'at cap' : `${Math.round((planned / cap) * 100)}% of cap`}</span>
                  </div>
                  <div className="tile-meter">
                    <div
                      className="meter-fill"
                      style={{
                        width: `${Math.min(100, (planned / cap) * 100)}%`,
                        backgroundColor: capped ? 'var(--warn)' : hue,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="add-character-btn"
            disabled={atCap}
            title={atCap ? `The roster is full at ${maxCharacters} characters.` : undefined}
            onClick={onAddClick}
          >
            {atCap ? `${characters.length} / ${maxCharacters}` : '+ Add'}
          </button>
        </div>
      </div>

      <div className="board-ceiling">
        <div className="ceiling-stat">
          <span className="ceiling-label">Runs planned</span>
          <strong className="ceiling-figure">{totals.attempts}</strong>
          <span className="ceiling-sub">
            over {dungeons.length} dungeons, {characters.length} characters
          </span>
        </div>

        <div className="ceiling-stat ceiling-gold">
          <span className="ceiling-label">Gold</span>
          <strong className="ceiling-figure">{gold(totals.gold)}</strong>
          <span className="ceiling-sub">
            of {gold(ceiling)} possible
            {ceiling > 0 && ` · ${Math.round((totals.gold / ceiling) * 100)}%`}
          </span>
          <span className="ceiling-bar">
            <span
              className="ceiling-bar-fill"
              style={{ width: `${ceiling > 0 ? Math.min(100, (totals.gold / ceiling) * 100) : 0}%` }}
            />
          </span>
        </div>

        {/* One element on purpose: the two ceilings only mean something read as
            one sentence, against each other. */}
        <p className="ceiling-note">
          The caps allow at most {gold(ceiling)} ({gold(goldCeiling)} by the gold cap,{' '}
          {gold(attemptsCeiling)} by attempts).
        </p>
      </div>

      {isPhone && (
        <CharacterPicker
          characters={characters}
          selectedId={shown?.id ?? null}
          onSelect={setShownId}
        />
      )}

      <div className="board-section">
        <h3 className="section-head">
          By dungeon
          <span className="section-sub">who runs each one, and what is left over</span>
        </h3>
        <div className={hoveredId ? 'board-grid is-picking' : 'board-grid'}>
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
                {mine.flatMap((a) => {
                  const tier = tierOf.get(`${a.characterId}:${d.id}`) ?? d.default_tier;
                  const faded = hoveredId !== null && hoveredId !== a.characterId;
                  return Array.from({ length: a.runs }, (_, i) => (
                    <span
                      key={`${a.characterId}-${i}`}
                      className={faded ? 'slot filled dim' : 'slot filled'}
                      data-character={a.characterId}
                      title={`${names.character(a.characterId)} at ${tier}`}
                      style={{ backgroundColor: `var(--tier-${tier})` }}
                    />
                  ));
                })}
                {Array.from({ length: leftOver }, (_, i) => (
                  <span key={`empty-${i}`} className="slot empty" />
                ))}
              </div>

              <div className="card-who-list">
                {mine
                  .filter((a) => !isPhone || !shown || a.characterId === shown.id)
                  .map((a) => {
                    const character = characters.find((c) => c.id === a.characterId);
                    const tier = tierOf.get(`${a.characterId}:${d.id}`) ?? d.default_tier;
                    const cellWarning = dungeonWarning ? null : goldWarning(d, tier);
                    return (
                      <div
                        key={a.characterId}
                        className={
                          hoveredId !== null && hoveredId !== a.characterId
                            ? 'who-row dim'
                            : 'who-row'
                        }
                      >
                        <DiamondDot hue={getClassHue(character?.class, character?.name)} />
                        <span className="who-name">{names.character(a.characterId)}</span>
                        <span className="who-tier" style={{ color: `var(--tier-${tier})` }}>
                          {tier}
                        </span>
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

      {/*
        The board answers "who runs this dungeon". This answers the question the
        other way round - "what does THIS character run, and how often" - which
        is the one you ask when you sit down to actually play one of them.
      */}
      <div className="by-character">
        <h3 className="section-head">
          By character
          <span className="section-sub">what each one runs, and how many times</span>
        </h3>
        <div className="by-character-grid">
          {characters.map((c) => {
            const hue = getClassHue(c.class, c.name);
            const mine = assignments.filter((a) => a.characterId === c.id);
            const runs = mine.reduce((sum, a) => sum + a.runs, 0);
            const planned = mine.reduce((sum, a) => sum + a.goldTotal, 0);
            // Dungeon order, so every card reads down in the same sequence as
            // the board above it.
            const rows = dungeons
              .map((d) => ({ d, a: mine.find((x) => x.dungeonId === d.id) }))
              .filter((r): r is { d: (typeof dungeons)[number]; a: PlanAssignment } => !!r.a);
            return (
              <div
                key={c.id}
                className={hoveredId && hoveredId !== c.id ? 'char-card dim' : 'char-card'}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="char-card-head">
                  <Portrait name={c.name} hue={hue} size={28} dim={runs === 0} characterClass={c.class} />
                  <span className="char-card-name">{c.name}</span>
                  <span className="char-card-total">
                    <strong style={{ color: runs > 0 ? hue : undefined }}>{runs}</strong> runs
                  </span>
                </div>
                {rows.length === 0 ? (
                  <p className="char-card-none">Nothing planned this week.</p>
                ) : (
                  <>
                    <div className="char-card-rows">
                      {rows.map(({ d, a }) => {
                        const tier = tierOf.get(`${c.id}:${d.id}`) ?? d.default_tier;
                        return (
                          <div className="char-row" key={d.id}>
                            <span className="char-row-name" title={d.name}>
                              {d.short_name ?? d.name}
                            </span>
                            <span
                              className="char-row-tier"
                              style={{ color: `var(--tier-${tier})` }}
                            >
                              {tier}
                            </span>
                            <strong className="char-row-runs">{a.runs}&times;</strong>
                            <span className="char-row-gold">{gold(a.goldTotal)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="char-card-foot">
                      <span>{rows.length} dungeons</span>
                      <span className="char-card-gold">{gold(planned)}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
