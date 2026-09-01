import { useCallback, useEffect, useState } from 'react';
import { currentGameAccountId, listCharacters, type CharacterRow } from '../data/accounts';
import { listDungeons, type DungeonRow } from '../data/dungeons';
import { listGrid, setGridCell, type GridRow } from '../data/grid';
import type { Tier } from '../engine/types';

const TIERS: Tier[] = ['none', 'solo', 'story', 'elite', 'legend'];

function cellKey(characterId: string, dungeonId: string): string {
  return `${characterId}:${dungeonId}`;
}

export default function GridScreen() {
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [dungeons, setDungeons] = useState<DungeonRow[]>([]);
  const [grid, setGrid] = useState<Map<string, GridRow>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const accountId = await currentGameAccountId();
      const [chars, dungs] = await Promise.all([listCharacters(accountId), listDungeons()]);
      const rows = await listGrid(chars.map((c) => c.id));
      setCharacters(chars);
      setDungeons(dungs.filter((d) => d.is_active));
      setGrid(new Map(rows.map((r) => [cellKey(r.character_id, r.dungeon_id), r])));
      setError(null);
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function write(
    characterId: string,
    dungeonId: string,
    patch: { tier?: Tier; min_runs?: number },
  ) {
    try {
      await setGridCell(characterId, dungeonId, patch);
      setError(null);
    } catch (err: unknown) {
      setError(String(err));
    }
    await refresh();
  }

  if (loading) return <p>Loading grid...</p>;

  if (characters.length === 0) {
    return (
      <section>
        <h2>Grid</h2>
        <p className="muted">Add a character first — the grid is characters against dungeons.</p>
      </section>
    );
  }

  if (dungeons.length === 0) {
    return (
      <section>
        <h2>Grid</h2>
        <p className="muted">No active dungeons in the catalogue yet.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>Grid</h2>
      <p className="muted">
        Tier is what that character has unlocked; <strong>none</strong> means it cannot enter.
        Minimum runs is a hard floor — the planner refuses a plan that cannot meet it, rather
        than quietly dropping it.
      </p>
      {error && <div className="error-message">Error: {error}</div>}

      <table>
        <thead>
          <tr>
            <th>Character</th>
            {dungeons.map((d) => (
              <th key={d.id}>{d.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {characters.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.name}</th>
              {dungeons.map((d) => {
                const row = grid.get(cellKey(c.id, d.id));
                const tier: Tier = row?.tier ?? 'none';
                const minRuns = row?.min_runs ?? 0;
                return (
                  <td key={d.id}>
                    <select
                      aria-label={`${c.name} tier in ${d.name}`}
                      value={tier}
                      onChange={(e) => void write(c.id, d.id, { tier: e.target.value as Tier })}
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      aria-label={`${c.name} minimum runs in ${d.name}`}
                      defaultValue={minRuns}
                      onBlur={(e) => {
                        const next = Number(e.target.value);
                        if (next !== minRuns) void write(c.id, d.id, { min_runs: next });
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
