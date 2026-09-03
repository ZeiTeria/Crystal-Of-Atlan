import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createCharacter,
  currentGameAccountId,
  listCharacters,
  type CharacterRow,
} from '../data/accounts';
import { setGridCells, type GridRow } from '../data/grid';
import { maxCharacters } from '../data/roster';
import { loadPlanState } from '../data/loadPlanInput';
import {
  attemptCeiling,
  explainCeiling,
  goldCapCeiling,
  noContention,
  type Reason,
} from '../engine/ceilings';
import { solveOptimal } from '../engine/solver';
import type { PlanInput, PlanResult, Tier } from '../engine/types';
import { useMutation } from '../hooks/useMutation';
import Button from '../ui/Button';
import ErrorBanner from '../ui/ErrorBanner';
import AddCharacterModal from './AddCharacterModal';
import AttemptBoard from './AttemptBoard';
import QuestLog from './QuestLog';
import { describeConflict, describeReason, type Names } from './planText';

interface Solved {
  input: PlanInput;
  result: PlanResult;
  roster: CharacterRow[];
  gridRows: GridRow[];
  /** How many characters this account may have. An admin setting. */
  maxCharacters: number;
  reasons: Reason[];
  relaxed: boolean;
  goldCeiling: number;
  attemptsCeiling: number;
}

interface PlanScreenProps {
  activeView?: 'board' | 'log';
}

export default function PlanScreen({ activeView = 'board' }: PlanScreenProps) {
  const [solved, setSolved] = useState<Solved | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  // The account cannot change while this screen is mounted, so it is resolved
  // once rather than on every refresh - and every write causes a refresh.
  const accountRef = useRef<string | null>(null);

  const accountId = useCallback(async () => {
    accountRef.current ??= await currentGameAccountId();
    return accountRef.current;
  }, []);

  const solveFn = useCallback(async () => {
    try {
      // ONE read. It returns the rows as well as the engine's input, because
      // the screens need what the engine drops - parked characters, and grid
      // rows whose tier is `none`. Asking for those separately fetched
      // characters, the grid and the settings a second time apiece.
      const state = await loadPlanState(await accountId());
      const result = await solveOptimal(state.input);
      setSolved({
        input: state.input,
        result,
        roster: state.characters,
        gridRows: state.grid,
        maxCharacters: maxCharacters(state.settings),
        reasons: explainCeiling(state.input, result),
        relaxed: noContention(state.input),
        goldCeiling: goldCapCeiling(state.input),
        attemptsCeiling: await attemptCeiling(state.input),
      });
    } catch (err: unknown) {
      setSolved(null);
      throw err;
    }
  }, [accountId]);

  const { busy, error, mutate, refresh: solve } = useMutation(solveFn);

  /**
   * Re-reads the roster and nothing else.
   *
   * A rename, a class or a reorder cannot change the plan - the solver never
   * reads any of them - so paying for five tables and a wasm solve to see a
   * new name appear is waste the user can feel. Anything that DOES move the
   * plan (a tier, a minimum, parking, adding, deleting) goes through `mutate`.
   */
  const relabelFn = useCallback(async () => {
    const roster = await listCharacters(await accountId());
    setSolved((was) => (was ? { ...was, roster } : was));
  }, [accountId]);

  const { error: relabelError, mutate: relabel } = useMutation(relabelFn);

  useEffect(() => {
    void solve().catch(() => setSolved(null));
  }, [solve]);

  async function handleAddCharacter(
    name: string,
    characterClass: string | null,
    tiers: Record<string, Tier>,
  ) {
    if (!solved) return;
    // Checked here as well as on the controls: the form can be open when the
    // roster fills from somewhere else, and RLS has no opinion about a cap.
    if (solved.roster.length >= solved.maxCharacters) return;
    await mutate(async () => {
      const created = await createCharacter(await accountId(), name, characterClass);
      // Seeding the grid is part of creating the character, inside the same
      // mutation, so a failure here surfaces and refreshes like any other
      // rather than leaving a character that silently did not get its tiers.
      //
      // EVERY dungeon gets a row, including ones left exactly on the default.
      // A dungeon's default is a template for making a character, not a live
      // link to it: once the character exists its tiers are its own, and
      // editing the catalogue later must not reach back and change what a
      // player already told us about a character they have played.
      const cells = solved.input.dungeons.map((d) => ({
        character_id: created.id,
        dungeon_id: d.id,
        tier: tiers[d.id] ?? d.default_tier,
        min_runs: d.default_min_runs,
        max_runs: null,
      }));
      if (cells.length > 0) await setGridCells(cells);
    });
  }

  if (!solved) {
    return (
      <section className="plan-empty">
        <p>{error ? `Error: ${error}` : 'Solving...'}</p>
        {error && (
          <Button disabled={busy} onClick={() => void solve()}>
            Retry
          </Button>
        )}
      </section>
    );
  }

  const { input, result, roster, gridRows } = solved;
  const atCap = roster.length >= solved.maxCharacters;
  const names: Names = {
    character: (id) => input.characters.find((c) => c.id === id)?.name ?? id,
    dungeon: (id) => input.dungeons.find((d) => d.id === id)?.name ?? id,
  };

  const modal = showAddModal && !atCap && (
    <AddCharacterModal
      dungeons={input.dungeons}
      grid={input.grid}
      characters={roster}
      onClose={() => setShowAddModal(false)}
      onAdd={handleAddCharacter}
    />
  );

  if (roster.length === 0) {
    return (
      <section className="plan-empty">
        <h2>Plan</h2>
        <p className="muted">Add a character to plan for.</p>
        <Button onClick={() => setShowAddModal(true)}>Add character</Button>
        {modal}
      </section>
    );
  }

  return (
    <div className={activeView === 'log' ? 'plan-screen is-log' : 'plan-screen'}>
      <ErrorBanner message={error ?? relabelError} />

      {input.grid.length === 0 ? (
        <p className="muted">
          Nothing is unlocked yet — set each character&rsquo;s tier per dungeon in the Character
          view.
        </p>
      ) : result.status === 'infeasible' ? (
        <section className="plan-infeasible">
          <p>These requirements cannot all be met:</p>
          <ul>
            {result.conflicts.map((c, i) => (
              <li key={i}>{describeConflict(c, names)}</li>
            ))}
          </ul>
          <p className="muted">Lower a minimum in the Character view, then come back.</p>
        </section>
      ) : (
        <>
          {solved.relaxed && (
            <p className="plan-relaxed">
              <strong>No choices to make</strong> — every character can simply run its maximum.
            </p>
          )}

          {activeView === 'board' ? (
            <AttemptBoard
              input={input}
              assignments={result.assignments}
              totals={result.totals}
              reasons={solved.reasons}
              goldCeiling={solved.goldCeiling}
              attemptsCeiling={solved.attemptsCeiling}
              names={names}
              atCap={atCap}
              maxCharacters={solved.maxCharacters}
              onAddClick={() => setShowAddModal(true)}
            />
          ) : (
            <QuestLog
              input={input}
              assignments={result.assignments}
              gridRows={gridRows}
              roster={roster}
              mutate={mutate}
              relabel={relabel}
              atCap={atCap}
              maxCharacters={solved.maxCharacters}
              onAddClick={() => setShowAddModal(true)}
            />
          )}

          {solved.reasons.some((r) => r.kind === 'gold-cap-reached') && (
            <ul className="muted plan-reasons">
              {solved.reasons
                .filter((r) => r.kind === 'gold-cap-reached')
                .map((r, i) => (
                  <li key={i}>{describeReason(r, names)}</li>
                ))}
            </ul>
          )}
        </>
      )}

      {modal}
    </div>
  );
}
