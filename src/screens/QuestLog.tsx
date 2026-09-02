import { useEffect, useRef, useState } from 'react';
import {
  deleteCharacter,
  renameCharacter,
  setCharacterOrder,
  toggleCharacterActive,
  type CharacterRow,
} from '../data/accounts';
import { setGridCell } from '../data/grid';
import type { PlanAssignment, PlanInput, Tier } from '../engine/types';
import Button from '../ui/Button';
import CharacterPicker from '../ui/CharacterPicker';
import InfoDot from '../ui/InfoDot';
import { Portrait } from '../ui/Shared';
import { getClassHue } from '../ui/hues';
import TierGem from '../ui/TierGem';
import { PHONE, useMediaQuery } from '../ui/useMediaQuery';
import { sortOrderPatches } from '../ui/reorder';
import { useSortableList } from '../ui/useSortableList';
import { matrixColumns } from './columns';
import { goldWarning } from './goldWarning';
import { gold } from './planText';
import './QuestLog.css';

const TIERS: Tier[] = ['none', 'solo', 'story', 'elite', 'legend'];

interface QuestLogProps {
  input: PlanInput;
  assignments: PlanAssignment[];
  /** Every character on the account, parked ones included - the plan input has
   *  already dropped those, and a roster you cannot unpark from is a trap. */
  roster: CharacterRow[];
  /** Runs a write, then re-reads everything. Owned by the screen above. */
  mutate: (write: () => Promise<void>) => Promise<void>;
  onAddClick?: () => void;
}

/**
 * One character at a time: what it is set to run, and what the plan does with
 * that. This is also where the roster is managed - renaming, parking, deleting
 * and reordering all live beside the character they act on rather than on a
 * separate screen.
 */
/** How long a run of stepper clicks is allowed to settle before it is written. */
const STEP_SETTLE_MS = 350;

export default function QuestLog({
  input,
  assignments,
  roster,
  mutate,
  onAddClick,
}: QuestLogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isPhone = useMediaQuery(PHONE);

  // What the steppers show while a write is still on its way.
  //
  // A write re-reads the whole plan and re-solves it, which is a wasm round
  // trip - waiting for that before moving the number made every click feel
  // broken, and disabling the buttons meanwhile made a run of clicks
  // impossible. So the number moves at once and the write follows, once the
  // clicking stops.
  const [pending, setPending] = useState<Record<string, number>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const running = timers.current;
    return () => {
      for (const timer of Object.values(running)) clearTimeout(timer);
    };
  }, []);

  const byId = new Map(roster.map((c) => [c.id, c]));
  const { order, activeId, handleProps } = useSortableList({
    ids: roster.map((c) => c.id),
    onReorder: (ids) => void mutate(() => setCharacterOrder(sortOrderPatches(ids))),
  });
  const characters = order.map((id) => byId.get(id)).filter((c) => c !== undefined);

  // Falls back to the first rather than showing nothing when the selection
  // names a character that has since been deleted.
  const selected = characters.find((c) => c.id === selectedId) ?? characters[0];

  if (!selected) {
    return (
      <section className="quest-log-container">
        <p className="muted">Add a character to plan for.</p>
        <Button onClick={onAddClick}>Add character</Button>
      </section>
    );
  }

  const dungeons = matrixColumns(input.dungeons);
  const parked = selected.is_active === false;

  const tierOf = new Map<string, Tier>(
    input.grid.map((g) => [`${g.characterId}:${g.dungeonId}`, g.tier]),
  );
  const minRunsOf = new Map<string, number>(
    input.grid.map((g) => [`${g.characterId}:${g.dungeonId}`, g.minRuns]),
  );

  const cap = input.settings.goldCap;
  const earned = cap - (input.goldHeadroom[selected.id] ?? cap);
  const capped = earned >= cap;
  const runsThisWeek = assignments
    .filter((a) => a.characterId === selected.id)
    .reduce((sum, a) => sum + a.runs, 0);
  const hue = getClassHue(selected.class, selected.name);

  /**
   * Writes the whole cell, never a patch. What is on screen for an untouched
   * pair comes from the dungeon's defaults, so both values go with every write
   * - otherwise the upsert inserts schema defaults for whatever was left out,
   * which is how a tier change used to reset the minimum to zero.
   */
  function write(dungeonId: string, cell: { tier: Tier; min_runs: number }) {
    if (!selected) return;
    void mutate(() => setGridCell(selected.id, dungeonId, cell));
  }

  /** Moves the number now; writes it once the clicking has stopped. */
  function stepMinRuns(dungeonId: string, tier: Tier, next: number) {
    if (!selected) return;
    const characterId = selected.id;
    setPending((p) => ({ ...p, [dungeonId]: next }));

    const running = timers.current[dungeonId];
    if (running) clearTimeout(running);
    timers.current[dungeonId] = setTimeout(() => {
      delete timers.current[dungeonId];
      void mutate(() => setGridCell(characterId, dungeonId, { tier, min_runs: next })).finally(
        () => {
          // The refreshed props now carry this value, so the local one steps
          // aside rather than shadowing a later change from anywhere else.
          setPending(({ [dungeonId]: _dropped, ...rest }) => rest);
        },
      );
    }, STEP_SETTLE_MS);
  }

  // Group order follows the column order, so the log and the board agree.
  const groups: { name: string; dungeons: typeof dungeons }[] = [];
  for (const d of dungeons) {
    const name = d.group_name ?? 'Ungrouped';
    const last = groups[groups.length - 1];
    if (last && last.name === name) last.dungeons.push(d);
    else groups.push({ name, dungeons: [d] });
  }

  return (
    <div className="quest-log-container">
      {isPhone ? (
        <CharacterPicker
          characters={characters}
          selectedId={selected.id}
          onSelect={setSelectedId}
        />
      ) : (
        <div className="quest-sidebar">
          <div className="roster-header">Roster</div>
          <div className="roster-list">
            {characters.map((c) => {
              const cHue = getClassHue(c.class, c.name);
              const cRuns = assignments
                .filter((a) => a.characterId === c.id)
                .reduce((sum, a) => sum + a.runs, 0);
              const cEarned = cap - (input.goldHeadroom[c.id] ?? cap);
              const cParked = c.is_active === false;
              return (
                <div
                  key={c.id}
                  data-sortable-id={c.id}
                  className={[
                    'roster-item',
                    c.id === selected.id ? 'selected' : '',
                    cParked ? 'is-parked' : '',
                    activeId === c.id ? 'sorting' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ '--hue': cHue } as React.CSSProperties}
                >
                  <button
                    type="button"
                    className="roster-item-content"
                    aria-label={`Show ${c.name}`}
                    aria-current={c.id === selected.id ? 'true' : undefined}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <Portrait name={c.name} hue={cHue} size={28} dim={cParked} />
                    <span className="roster-item-info">
                      <span className="roster-item-top">
                        <span className="roster-name">{c.name}</span>
                        <span className="roster-runs">
                          {cParked ? 'parked' : `${cRuns}×`}
                        </span>
                      </span>
                      <span className="roster-item-meter-bg">
                        <span
                          className="roster-item-meter-fill"
                          style={{
                            width: `${Math.min(100, (cEarned / cap) * 100)}%`,
                            background: cEarned >= cap ? 'var(--warn)' : cHue,
                          }}
                        />
                      </span>
                    </span>
                  </button>
                  <span {...handleProps(c.id, `Reorder ${c.name}`)}>
                    &#10286;
                  </span>
                </div>
              );
            })}
          </div>
          <button type="button" className="roster-add" onClick={onAddClick}>
            + Add character
          </button>
        </div>
      )}

      <div className="quest-main">
        <div className="quest-header">
          <div className="quest-header-left">
            <Portrait name={selected.name} hue={hue} size={52} dim={parked} />
            <div className="quest-header-text">
              <input
                className="qh-name"
                aria-label={`${selected.name} name`}
                defaultValue={selected.name}
                key={selected.id + selected.name}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next === '' || next === selected.name) return;
                  void mutate(() => renameCharacter(selected.id, next));
                }}
              />
              <span className="qh-sub">
                {parked
                  ? 'Parked — left out of the plan until you put it back.'
                  : `${runsThisWeek} runs this week${capped ? ' · gold cap reached' : ''}`}
              </span>
            </div>
          </div>
          <div className="quest-header-right">
            <div className="qh-gold-line">
              <span className={capped ? 'qh-gold-val warning-text' : 'qh-gold-val'}>
                {gold(earned)}
              </span>
              <span className="qh-gold-cap">/ {gold(cap)}</span>
            </div>
            <div className="qh-meter-bg">
              <div
                className="qh-meter-fill"
                style={{
                  width: `${Math.min(100, (earned / cap) * 100)}%`,
                  background: capped ? 'var(--warn)' : hue,
                }}
              />
            </div>
            <div className="qh-actions">
              <label className="qh-park">
                <input
                  type="checkbox"
                  checked={!parked}
                  aria-label={`Include ${selected.name} in plan`}
                  onChange={(e) =>
                    void mutate(() => toggleCharacterActive(selected.id, e.target.checked))
                  }
                />
                In the plan
              </label>
              <Button
                variant="quiet"
                aria-label={`Delete ${selected.name}`}
                onClick={() => {
                  const ok = window.confirm(
                    `Delete ${selected.name}? Its unlocked tiers and all its logged runs go too.`,
                  );
                  if (ok) void mutate(() => deleteCharacter(selected.id));
                }}
              >
                &times;
              </Button>
            </div>
          </div>
        </div>

        <div className="quest-body">
          {dungeons.length === 0 && (
            <p className="muted">
              No active dungeons in the catalogue yet — an admin has to add dungeons first.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.name} className="dungeon-group">
              <div className="group-heading" style={{ color: `var(--group-${g.name.toLowerCase()})` }}>
                {g.name}
              </div>
              {g.dungeons.map((d) => {
                const key = `${selected.id}:${d.id}`;
                const tier = tierOf.get(key) ?? d.default_tier;
                const minRuns = pending[d.id] ?? minRunsOf.get(key) ?? d.default_min_runs;
                const assignment = assignments.find(
                  (a) => a.characterId === selected.id && a.dungeonId === d.id,
                );
                const runs = assignment?.runs ?? 0;
                const perRun = tier === 'none' ? null : d.gold[tier];
                const usedAccountWide = assignments
                  .filter((a) => a.dungeonId === d.id)
                  .reduce((sum, a) => sum + a.runs, 0);
                const remaining = input.accountAttemptsLeft[d.id] ?? 0;
                const why = goldWarning(d, tier);

                return (
                  <div key={d.id} className={`dungeon-row ${runs === 0 ? 'dimmed' : ''}`}>
                    <div className="dungeon-row-info">
                      <span className="d-icon-col">
                        <TierGem tier={tier} />
                        <span className="d-name">{d.name}</span>
                        {why && <InfoDot label={why}>{why}</InfoDot>}
                      </span>
                      <span className="d-sub">
                        {perRun === null ? 'Not unlocked' : `${gold(perRun)} per run`} &middot;{' '}
                        {usedAccountWide}/{remaining} used account-wide
                      </span>
                    </div>
                    <div className="d-tier">
                      <select
                        aria-label={`${selected.name} tier in ${d.name}`}
                        value={tier}
                        disabled={parked}
                        style={{ color: `var(--tier-${tier})` }}
                        onChange={(e) =>
                          write(d.id, { tier: e.target.value as Tier, min_runs: minRuns })
                        }
                      >
                        {TIERS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="d-stepper">
                      <button
                        type="button"
                        className="stepper-btn"
                        aria-label={`One fewer minimum run of ${d.name} for ${selected.name}`}
                        disabled={parked || minRuns <= 0}
                        onClick={() => stepMinRuns(d.id, tier, minRuns - 1)}
                      >
                        &minus;
                      </button>
                      <span
                        className="stepper-val"
                        aria-label={`${selected.name} minimum runs in ${d.name}`}
                        style={{ color: minRuns > 0 ? hue : 'var(--text-disabled)' }}
                      >
                        {minRuns}
                      </span>
                      <button
                        type="button"
                        className="stepper-btn"
                        aria-label={`One more minimum run of ${d.name} for ${selected.name}`}
                        disabled={parked || minRuns >= d.characterAttempts}
                        onClick={() => stepMinRuns(d.id, tier, minRuns + 1)}
                      >
                        +
                      </button>
                    </div>
                    <div className="d-gold">{runs > 0 ? gold(assignment?.goldTotal ?? 0) : '—'}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
