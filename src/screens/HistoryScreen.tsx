import { useCallback, useEffect, useState } from 'react';
import { currentGameAccountId, listCharacters } from '../data/accounts';
import { listDungeons } from '../data/dungeons';
import { deleteRun, listRecentRuns, type RunRow } from '../data/runs';
import { gold } from './planText';

export default function HistoryScreen() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [characterNames, setCharacterNames] = useState<Map<string, string>>(new Map());
  const [dungeonNames, setDungeonNames] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const accountId = await currentGameAccountId();
      const [characters, dungeons] = await Promise.all([
        listCharacters(accountId),
        listDungeons(),
      ]);
      setCharacterNames(new Map(characters.map((c) => [c.id, c.name])));
      setDungeonNames(new Map(dungeons.map((d) => [d.id, d.name])));
      setRuns(await listRecentRuns(characters.map((c) => c.id)));
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

  async function undo(run: RunRow) {
    try {
      await deleteRun(run.id);
      setError(null);
    } catch (err: unknown) {
      setError(String(err));
    }
    await refresh();
  }

  if (loading) return <p>Loading history...</p>;

  return (
    <section>
      <h2>History</h2>
      {error && <div className="error-message">Error: {error}</div>}
      {runs.length === 0 && <p className="muted">No runs logged yet.</p>}

      <table>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td>{new Date(run.ran_at).toLocaleString()}</td>
              <td>{characterNames.get(run.character_id) ?? run.character_id}</td>
              <td>{dungeonNames.get(run.dungeon_id) ?? run.dungeon_id}</td>
              <td>{gold(run.gold_earned)}</td>
              <td>
                <div className="row-actions">
                  <button
                    className="button button-outline"
                    aria-label={`Undo ${dungeonNames.get(run.dungeon_id) ?? 'run'}`}
                    onClick={() => void undo(run)}
                  >
                    Undo
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
