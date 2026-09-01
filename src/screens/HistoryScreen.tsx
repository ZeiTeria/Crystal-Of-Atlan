import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '../hooks/useMutation';
import Button from '../ui/Button';
import { currentGameAccountId, listCharacters } from '../data/accounts';
import { listDungeons } from '../data/dungeons';
import { deleteRun, listRecentRuns, type RunRow } from '../data/runs';
import { gold } from './planText';

export default function HistoryScreen() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [characterNames, setCharacterNames] = useState<Map<string, string>>(new Map());
  const [dungeonNames, setDungeonNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const refreshFn = useCallback(async () => {
    const accountId = await currentGameAccountId();
    const [characters, dungeons] = await Promise.all([
      listCharacters(accountId),
      listDungeons(),
    ]);
    setCharacterNames(new Map(characters.map((c) => [c.id, c.name])));
    setDungeonNames(new Map(dungeons.map((d) => [d.id, d.name])));
    setRuns(await listRecentRuns(characters.map((c) => c.id)));
  }, []);

  const { busy, error, mutate, refresh } = useMutation(refreshFn);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function undo(run: RunRow) {
    await mutate(async () => {
      await deleteRun(run.id);
    });
  }

  if (loading) return <p>Loading history...</p>;

  const groupedRuns = new Map<string, RunRow[]>();
  for (const run of runs) {
    const date = new Date(run.ran_at).toLocaleDateString();
    const group = groupedRuns.get(date) ?? [];
    group.push(run);
    groupedRuns.set(date, group);
  }

  return (
    <section>
      <h2>History</h2>
      {error && <div className="error-message">Error: {error}</div>}
      {runs.length === 0 && <p className="muted">No runs logged yet.</p>}

      {Array.from(groupedRuns.entries()).map(([date, dayRuns]) => (
        <div key={date}>
          <h3>{date}</h3>
          <table style={{ marginBottom: '24px' }}>
            <tbody>
              {dayRuns.map((run) => (
                <tr key={run.id}>
                  <td>{new Date(run.ran_at).toLocaleTimeString()}</td>
                  <td>{characterNames.get(run.character_id) ?? run.character_id}</td>
                  <td>{dungeonNames.get(run.dungeon_id) ?? run.dungeon_id}</td>
                  <td>{gold(run.gold_earned)}</td>
                  <td>
                    <div className="row-actions">
                      <Button variant="outline"
                        disabled={busy}
                        aria-label={`Undo ${dungeonNames.get(run.dungeon_id) ?? 'run'}`}
                        onClick={() => void undo(run)}
                      >
                        Undo
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
