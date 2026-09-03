import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '../hooks/useMutation';
import Button from '../ui/Button';
import { suggestAbbreviation } from './abbreviate';
import { sortOrderPatches } from '../ui/reorder';
import { useSortableList } from '../ui/useSortableList';
import {
  createDungeon,
  deleteDungeon,
  listDungeons,
  updateDungeon,
  type DungeonRow,
  type NewDungeon,
} from '../data/dungeons';

import {
  loadAppSettings,
  maxCharacters as readMaxCharacters,
  setMaxCharacters,
  type AppSettingsRow,
} from '../data/roster';
import type { Tier } from '../engine/types';
import ErrorBanner from '../ui/ErrorBanner';

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

const TIERS: Tier[] = ['none', 'solo', 'story', 'elite', 'legend'];

const BLANK: NewDungeon = {
  name: '',
  group_name: null,
  short_name: null,
  account_attempts: 18,
  character_attempts: 3,
  reset_weekday: 1,
  gold_solo: 0,
  gold_story: 0,
  gold_elite: 0,
  gold_legend: 0,
  is_active: true,
  default_tier: 'elite',
  default_min_runs: 1,
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
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<AppSettingsRow | null>(null);

  const refreshFn = useCallback(async () => {
    setSettings(await loadAppSettings());
    setDungeons(await listDungeons());
  }, []);

  const { busy, error, mutate, refresh } = useMutation(refreshFn);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  const { order, activeId, handleProps } = useSortableList({
    ids: dungeons.map((d) => d.id),
    onReorder: (ids) => void commitOrder(ids),
  });
  const byId = new Map(dungeons.map((d) => [d.id, d]));
  const ordered = order.map((id) => byId.get(id)).filter((d) => d !== undefined);

  /** Edits are written on blur, so a half-typed number never reaches the database. */
  async function save(id: string, patch: Partial<NewDungeon>) {
    await mutate(async () => {
      await updateDungeon(id, patch);
    });
  }

  async function add() {
    if (draft.name.trim() === '') return;
    await mutate(async () => {
      await createDungeon({ ...draft, name: draft.name.trim() });
      setDraft(BLANK);
    });
  }

  async function remove(dungeon: DungeonRow) {
    if (
      !window.confirm(
        `Delete ${dungeon.name}? Every logged run of it, for every character, is deleted too.`,
      )
    )
      return;
    await mutate(async () => {
      await deleteDungeon(dungeon.id);
    });
  }

  /**
   * Rewrites every row's sort_order rather than swapping a pair: a swap leaves
   * the rest of the list unevenly spaced and the gaps eventually close.
   *
   * Not transactional - Supabase's JS client has no multi-row update without an
   * RPC - so an interrupted reorder can leave the list half-renumbered. That is
   * recoverable by reordering again, which is why it is acceptable here; it
   * would not be for anything that has to balance.
   */
  async function commitOrder(orderedIds: string[]) {
    await mutate(async () => {
      await Promise.all(
        sortOrderPatches(orderedIds).map((p) => updateDungeon(p.id, { sort_order: p.sort_order })),
      );
    });
  }

  if (loading) return <p>Loading catalogue...</p>;

  return (
    <section>
      <h2>Dungeons</h2>
      <ErrorBanner message={error} />

      <div className="admin-setting">
        <label htmlFor="max-characters">Characters allowed per account</label>
        <input
          id="max-characters"
          type="number"
          min={1}
          max={200}
          key={readMaxCharacters(settings)}
          defaultValue={readMaxCharacters(settings)}
          disabled={busy}
          onBlur={(e) => {
            const next = Number(e.target.value);
            if (!Number.isInteger(next) || next < 1 || next === readMaxCharacters(settings)) return;
            void mutate(async () => {
              await setMaxCharacters(next);
              setSettings(await loadAppSettings());
            });
          }}
        />
        <span className="muted">
          What the game allows, so it lives here rather than in the code. Lowering it below the
          number an account already has does not delete anyone - it only stops more being added.
        </span>
      </div>

      {dungeons.length === 0 && <p className="muted">No dungeons in the catalogue yet.</p>}

      <table className="datatable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Group</th>
            <th>Short</th>
            <th>Account/wk</th>
            <th>Character/wk</th>
            <th>Resets</th>
            {GOLD_COLUMNS.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
            <th>Active</th>
            <th>Default Tier</th>
            <th>Default Min</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ordered.map((d) => (
            <tr
              key={d.id}
              data-sortable-id={d.id}
              className={activeId === d.id ? 'sorting' : undefined}
            >
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
                  aria-label={`${d.name} short label`}
                  defaultValue={d.short_name ?? ''}
                  size={5}
                  placeholder={suggestAbbreviation(d.name, d.group_name)}
                  onBlur={(e) => {
                    // Empty means "use the suggestion", so it stores null rather
                    // than an empty string - a deliberate label is never
                    // overwritten, and an absent one is never frozen.
                    const next = e.target.value.trim();
                    const value = next === '' ? null : next;
                    if (value !== d.short_name) void save(d.id, { short_name: value });
                  }}
                />
              </td>
              <td>
                <input
                  aria-label={`${d.name} group`}
                  defaultValue={d.group_name ?? ''}
                  list="dungeon-groups"
                  placeholder="none"
                  onBlur={(e) => {
                    // An emptied field stores null, never '': an empty-string
                    // family would be treated as real and banded together with
                    // every other ungrouped dungeon.
                    const next = e.target.value.trim();
                    const value = next === '' ? null : next;
                    if (value !== d.group_name) void save(d.id, { group_name: value });
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
              {GOLD_COLUMNS.map((c) => (
                <td key={c.key}>
                  <input
                    type="number"
                    aria-label={`${d.name} ${c.label} gold`}
                    defaultValue={d[c.key]}
                    // 36 figures get typed into fields already holding a 0;
                    // without this every one needs the 0 cleared first.
                    onFocus={(e) => e.target.select()}
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
                <select
                  aria-label={`${d.name} default tier`}
                  value={d.default_tier}
                  onChange={(e) => void save(d.id, { default_tier: e.target.value as Tier })}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  aria-label={`${d.name} default min runs`}
                  value={d.default_min_runs}
                  min={0}
                  max={d.character_attempts}
                  onChange={(e) => void save(d.id, { default_min_runs: Number(e.target.value) })}
                />
              </td>
              <td>
                <div className="row-actions">
                  <span {...handleProps(d.id, `Reorder ${d.name}`)}>⠿</span>
                  <Button variant="outline"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => void remove(d)}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <datalist id="dungeon-groups">
        {[...new Set(dungeons.map((d) => d.group_name).filter((g) => g !== null))].map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

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
        <select
          aria-label="New dungeon default tier"
          value={draft.default_tier}
          onChange={(e) => setDraft({ ...draft, default_tier: e.target.value as Tier })}
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          aria-label="New dungeon default min runs"
          value={draft.default_min_runs}
          min={0}
          max={draft.character_attempts}
          onChange={(e) => setDraft({ ...draft, default_min_runs: Number(e.target.value) })}
        />
        <Button
          disabled={busy || draft.name.trim() === ''}
          onClick={() => void add()}
        >
          Add dungeon
        </Button>
      </div>
    </section>
  );
}
