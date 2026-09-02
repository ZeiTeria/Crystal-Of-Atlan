import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '../hooks/useMutation';
import Button from '../ui/Button';
import { currentGameAccountId, createCharacter } from '../data/accounts';
import { setGridCell } from '../data/grid';
import { loadPlanInput } from '../data/loadPlanInput';
import {
  attemptCeiling,
  explainCeiling,
  goldCapCeiling,
  noContention,
  type Reason,
} from '../engine/ceilings';
import { solveOptimal } from '../engine/solver';
import type { PlanInput, PlanResult } from '../engine/types';
import ErrorBanner from '../ui/ErrorBanner';
import AttemptBoard from './AttemptBoard';
import QuestLog from './QuestLog';

import AddCharacterModal from './AddCharacterModal';
import type { Tier } from '../engine/types';
import Countdown from '../ui/Countdown';

interface Solved {
  input: PlanInput;
  result: PlanResult;
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

  const handleUpdateMinRuns = async (charId: string, dId: string, currentTier: string, minRuns: number) => {
    await setGridCell(charId, dId, { tier: currentTier as Tier, min_runs: minRuns });
    void solve();
  };

  const handleAddCharacter = async (name: string, classStr: string, tiers: Record<string, Tier>) => {
    const accountId = await currentGameAccountId();
    // createCharacter expects specific literal string types for Tier
    await createCharacter(accountId, name, classStr, tiers as any);
    void solve();
  };

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

  const { busy, error, refresh: solve } = useMutation(solveFn);

  useEffect(() => {
    void solve().catch(() => setSolved(null));
  }, [solve]);

  if (!solved) {
    return (
      <div style={{ padding: 20 }}>
        <p>{error ? `Error: ${error}` : 'Solving...'}</p>
        {error && (
          <Button disabled={busy} onClick={() => void solve()}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  const { input, result } = solved;

  if (input.characters.length === 0) {
    return (
      <section style={{ padding: 20 }}>
        <h2>Plan</h2>
        <p className="muted">Add a character to plan for.</p>
        <Button onClick={() => setShowAddModal(true)} style={{ marginTop: 20 }}>
          Add Character
        </Button>
        {showAddModal && (
          <AddCharacterModal 
            dungeons={input.dungeons} 
            onClose={() => setShowAddModal(false)} 
            onAdd={handleAddCharacter} 
          />
        )}
      </section>
    );
  }

  if (input.grid.length === 0) {
    return (
      <section style={{ padding: 20 }}>
        <h2>Plan</h2>
        <p className="muted">
          Nothing is unlocked yet — set each character's tier per dungeon on the Grid tab.
        </p>
      </section>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      <ErrorBanner message={error} />
      
      <div className="mobile-only-header">
        <span className="mobile-title">{activeView === 'board' ? 'Plan' : 'Character'}</span>
        <span className="mobile-countdown"><Countdown settings={solved.input.settings} /></span>
      </div>

      {activeView === 'board' ? (
        <AttemptBoard input={solved.input} result={solved.result} onAddClick={() => setShowAddModal(true)} />
      ) : (
        <QuestLog 
          input={solved.input} 
          result={solved.result} 
          onAddClick={() => setShowAddModal(true)} 
          onUpdateMinRuns={handleUpdateMinRuns}
        />
      )}
      
      {showAddModal && (
        <AddCharacterModal 
          dungeons={input.dungeons} 
          onClose={() => setShowAddModal(false)} 
          onAdd={handleAddCharacter} 
        />
      )}
    </div>
  );
}
