import { useCallback, useEffect, useState } from 'react';
import {
  createDungeon,
  deleteDungeon,
  listDungeons,
  updateDungeon,
  type DungeonRow,
  type NewDungeon,
} from '../data/dungeons';

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

const BLANK: NewDungeon = {
  name: '',
  account_attempts: 18,
  character_attempts: 3,
  reset_weekday: 1,
  quest_coverage: false,
  gold_solo: 0,
  gold_story: 0,
  gold_elite: 0,
  gold_legend: 0,
  is_active: true,
};

// Each column carries its own patch builder. A computed key over a union of
// literal types widens to `{ [x: string]: number }`, which is not assignable to
// `Partial<NewDungeon>` - so `{ [c.key]: n }` does not typecheck.
const GOLD_COLUMNS = [
  { key: 'gold_solo', label: 'solo', patch: (v: number): Partial<NewDungeon> => ({ gold_solo: v }) },
  { key: 'gold_story', label: 'story', patch: (v: number): Partial<NewDungeon> => ({ gold_story: v }) },
  { key: 'gold_elite', label: 'elite', patch: (v: number): Partial<NewDungeon> => ({ gold_elite: v }) },
  { key: 'gold_legend', label: 'legend', patch: (v: number): Partial<NewDungeon> => ({ gold_legend: v }) },
] as const;

export default function DungeonsScreen() {
  const [dungeons, setDungeons] = useState<DungeonRow[]>([]);
  const [draft, setDraft] = useState<NewDungeon>(BLANK);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setDungeons(await listDungeons());
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

  /** Edits are written on blur, so a half-typed number never reaches the database. */
  async function save(id: string, patch: Partial<NewDungeon>) {
    try {
      await updateDungeon(id, patch);
      setError(null);
    } catch (err: unknown) {
      setError(String(err));
    }
    await refresh();
  }

  async function add() {
    if (draft.name.trim() === '') return;
    try {
      await createDungeon({ ...draft, name: draft.name.trim() });
      setDraft(BLANK);
      setError(null);
    } catch (err: unknown) {
      setError(String(err));
    }
    await refresh();
  }

  async function remove(dungeon: DungeonRow) {
    if (!window.confirm(`Delete ${dungeon.name}? This cannot be undone.`)) return;
    try {
      await deleteDungeon(dungeon.id);
      setError(null);
    } catch (err: unknown) {
      setError(String(err));
    }
    await refresh();
  }

  if (loading) return <p>Loading catalogue...</p>;

  return (
    <section>
      <h2>Dungeons</h2>
      {error && <div className="error-message">Error: {error}</div>}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Account/wk</th>
            <th>Character/wk</th>
            <th>Resets</th>
            <th>Quest</th>
            {GOLD_COLUMNS.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            <th>Active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {dungeons.map((d) => (
            <tr key={d.id}>
              <td>
                <input
                  aria-label={`${d.name} name`}
                  defaultValue={d.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name !== '' && name !== d.name) void save(d.id, { name });
                  }}
                />
              </td>
              <td>
                <input
                  type="number"
                  aria-label={`${d.name} account attempts`}
                  defaultValue={d.account_attempts}
                  onBlur={(e) => void save(d.id, { account_attempts: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="number"
                  aria-label={`${d.name} character attempts`}
                  defaultValue={d.character_attempts}
                  onBlur={(e) => void save(d.id, { character_attempts: Number(e.target.value) })}
                />
              </td>
              <td>
                <select
                  aria-label={`${d.name} reset weekday`}
                  value={d.reset_weekday}
                  onChange={(e) => void save(d.id, { reset_weekday: Number(e.target.value) })}
                >
                  {WEEKDAYS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label={`${d.name} counts for the weekly quest`}
                  checked={d.quest_coverage}
                  onChange={(e) => void save(d.id, { quest_coverage: e.target.checked })}
                />
              </td>
              {GOLD_COLUMNS.map((c) => (
                <td key={c.key}>
                  <input
                    type="number"
                    aria-label={`${d.name} ${c.label} gold`}
                    defaultValue={d[c.key]}
                    onBlur={(e) => void save(d.id, c.patch(Number(e.target.value)))}
                  />
                </td>
              ))}
              <td>
                <input
                  type="checkbox"
                  aria-label={`${d.name} active`}
                  checked={d.is_active}
                  onChange={(e) => void save(d.id, { is_active: e.target.checked })}
                />
              </td>
              <td>
                <div className="row-actions">
                  <button
                    className="button button-outline"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => void remove(d)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Add a dungeon</h3>
      <p className="muted">
        Gold values can be filled in later; the name is the only thing needed to create one.
      </p>
      <div className="row-actions">
        <input
          aria-label="New dungeon name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Dungeon name"
        />
        <button className="button" onClick={() => void add()}>
          Add dungeon
        </button>
      </div>
    </section>
  );
}
