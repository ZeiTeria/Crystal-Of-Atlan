import { useCallback, useEffect, useState } from 'react';
import { createCharacter, currentGameAccountId, listCharacters, type CharacterRow } from '../data/accounts';
import { listGrid, setGridCells, type GridRow } from '../data/grid';
import { loadAppSettings, maxCharacters } from '../data/roster';
import { loadPlanInput } from '../data/loadPlanInput';
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
import Countdown from '../ui/Countdown';
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

  const solveFn = useCallback(async () => {
    try {
      const accountId = await currentGameAccountId();
      const input = await loadPlanInput(accountId);
      // The roster and the grid are read separately from the plan input, which
      // is the SOLVER's view: it has already dropped parked characters and any
      // pair whose tier is `none`. The log edits the stored rows, so it needs
      // them as stored - otherwise choosing `none` reads back as the dungeon's
      // default on the next refresh.
      const roster = await listCharacters(accountId);
      // In parallel: neither needs the other, and the cap is only ever read.
      const [gridRows, settings] = await Promise.all([
        listGrid(roster.map((c) => c.id)),
        loadAppSettings(),
      ]);
      const result = await solveOptimal(input);
      setSolved({
        input,
        result,
        roster,
        gridRows,
        maxCharacters: maxCharacters(settings),
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
      const accountId = await currentGameAccountId();
      const created = await createCharacter(accountId, name, characterClass);
      // Seeding the grid is part of creating the character, inside the same
      // mutation, so a failure here surfaces and refreshes like any other
      // rather than leaving a character that silently did not get its tiers.
      //
      // Only tiers that DIFFER from the dungeon's default are written, and an
      // explicit `none` against a default of elite is such a difference. A row
      // that merely repeats the default would freeze today's value and stop
      // this character following a later change to the catalogue.
      const cells = solved.input.dungeons
        .filter((d) => (tiers[d.id] ?? d.default_tier) !== d.default_tier)
        .map((d) => ({
          character_id: created.id,
          dungeon_id: d.id,
          tier: tiers[d.id] ?? d.default_tier,
          min_runs: d.default_min_runs,
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
    <div className="plan-screen">
      <div className="plan-head">
        <span className="plan-title">{activeView === 'board' ? 'Plan' : 'Character'}</span>
        <span className="muted plan-countdown">
          Resets in <Countdown settings={input.settings} />
        </span>
      </div>
      <ErrorBanner message={error} />

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
