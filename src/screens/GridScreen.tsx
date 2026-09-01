import { useCallback, useEffect, useState } from 'react';
import { useMutation } from '../hooks/useMutation';
import Meter from '../ui/Meter';
import TierGem from '../ui/TierGem';
import { groupSpans, matrixColumns } from './columns';
import { sortOrderPatches } from '../ui/reorder';
import { useSortableList } from '../ui/useSortableList';
import CharacterPicker from '../ui/CharacterPicker';
import { PHONE, useMediaQuery } from '../ui/useMediaQuery';
import Button from '../ui/Button';
import {
  currentGameAccountId,
  listCharacters,
  createCharacter,
  deleteCharacter,
  renameCharacter,
  toggleCharacterActive,
  setCharacterOrder,
  type CharacterRow,
} from '../data/accounts';
import { listDungeons, type DungeonRow } from '../data/dungeons';
import { listGrid, setGridCell, setGridCells, type GridRow } from '../data/grid';
import type { Tier } from '../engine/types';
import ErrorBanner from '../ui/ErrorBanner';

const TIERS: Tier[] = ['none', 'solo', 'story', 'elite', 'legend'];

function cellKey(characterId: string, dungeonId: string): string {
  return `${characterId}:${dungeonId}`;
}

export default function GridScreen() {
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [dungeons, setDungeons] = useState<DungeonRow[]>([]);
  const [grid, setGrid] = useState<Map<string, GridRow>>(new Map());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [phoneCharacterId, setPhoneCharacterId] = useState<string | null>(null);
  const isPhone = useMediaQuery(PHONE);
  const [loading, setLoading] = useState(true);

  const refreshFn = useCallback(async () => {
    const aid = await currentGameAccountId();
    setAccountId(aid);
    const [chars, dungs] = await Promise.all([listCharacters(aid), listDungeons()]);
    const rows = await listGrid(chars.map((c) => c.id));
    setCharacters(chars);
    setDungeons(dungs.filter((d) => d.is_active));
    setGrid(new Map(rows.map((r) => [cellKey(r.character_id, r.dungeon_id), r])));
  }, []);

  const { busy, error, mutate, refresh } = useMutation(refreshFn);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function commitCharacterOrder(orderedIds: string[]) {
    await mutate(async () => {
      await setCharacterOrder(sortOrderPatches(orderedIds));
    });
  }

  const { order, activeId, handleProps } = useSortableList({
    ids: characters.map((c) => c.id),
    onReorder: (ids) => void commitCharacterOrder(ids),
  });
  const byId = new Map(characters.map((c) => [c.id, c]));
  const orderedCharacters = order.map((id) => byId.get(id)).filter((c) => c !== undefined);

  // The phone shows one character at a time. Falls back to the first rather
  // than showing nothing when the selection names a character since deleted.
  const shownCharacter =
    orderedCharacters.find((c) => c.id === phoneCharacterId) ?? orderedCharacters[0];

  async function addCharacter() {
    const name = draft.trim();
    if (name === '' || !accountId) return;
    await mutate(async () => {
      await createCharacter(accountId, name);
      setDraft('');
    });
  }

  async function rename(character: CharacterRow, next: string) {
    const name = next.trim();
    if (name === '' || name === character.name) return;
    await mutate(async () => {
      await renameCharacter(character.id, name);
    });
  }

  async function toggleActive(character: CharacterRow, is_active: boolean) {
    await mutate(async () => {
      await toggleCharacterActive(character.id, is_active);
    });
  }

  async function remove(character: CharacterRow) {
    const ok = window.confirm(
      `Delete ${character.name}? Its unlocked tiers and all its logged runs go too.`,
    );
    if (!ok) return;
    await mutate(async () => {
      await deleteCharacter(character.id);
    });
  }

  /**
   * Writes the whole cell, never a patch. What is on screen for an untouched
   * pair comes from the dungeon's defaults, so the caller passes the current
   * displayed values alongside the change - otherwise the upsert would insert
   * schema defaults for whatever was left out. See setGridCell.
   */
  /**
   * Copies the source character's whole row - what is DISPLAYED, not just its
   * stored grid rows. An untouched pair has no row and shows the dungeon's
   * defaults, so copying stored rows alone would leave the target matching only
   * by coincidence, and diverging the moment a dungeon default changed.
   */
  async function copyFrom(sourceId: string, target: CharacterRow) {
    const source = characters.find((c) => c.id === sourceId);
    if (!source) return;

    const ok = window.confirm(
      `Copy ${source.name}'s tiers and minimum runs onto ${target.name}? ` +
        `${target.name}'s current grid is replaced.`,
    );
    if (!ok) return;

    await mutate(async () => {
      // Iterates every dungeon, not the ordered columns: this is about data,
      // and must cover the catalogue whatever order it happens to be shown in.
      await setGridCells(
        dungeons.map((d) => {
          const row = grid.get(cellKey(sourceId, d.id));
          return {
            character_id: target.id,
            dungeon_id: d.id,
            tier: row?.tier ?? d.default_tier,
            min_runs: row?.min_runs ?? d.default_min_runs,
          };
        }),
      );
    });
  }

  async function write(
    characterId: string,
    dungeonId: string,
    cell: { tier: Tier; min_runs: number },
  ) {
    await mutate(async () => {
      await setGridCell(characterId, dungeonId, cell);
    });
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
        <p className="muted">
          No active dungeons in the catalogue yet — an admin has to add dungeons first.
        </p>
      </section>
    );
  }

  // Newest dungeon leftmost - deliberately the opposite of the Dungeons tab.
  const columns = matrixColumns(dungeons);
  const spans = groupSpans(columns);

  const dungeonTotals = new Map<string, number>();
  for (const d of dungeons) {
    let sum = 0;
    for (const c of characters) {
      if (c.is_active !== false) {
        sum += grid.get(cellKey(c.id, d.id))?.min_runs ?? d.default_min_runs;
      }
    }
    dungeonTotals.set(d.id, sum);
  }

  return (
    <section>
      <h2>Grid</h2>
      <p className="muted">
        Tier is what that character has unlocked; <strong>none</strong> means it cannot enter.
        Minimum runs is a hard floor — the planner refuses a plan that cannot meet it, rather
        than quietly dropping it.
      </p>
      <p className="muted">
        Newest dungeon first, so one you just added is the leftmost column — the opposite of
        the Dungeons tab, which appends to the bottom.
      </p>
      <ErrorBanner message={error} />

      {isPhone ? (
        <>
          <CharacterPicker
            characters={orderedCharacters}
            selectedId={shownCharacter?.id ?? null}
            onSelect={setPhoneCharacterId}
          />
          {shownCharacter && (
            <div className="pcard gridcard">
              {columns.map((d, i) => {
                const c = shownCharacter;
                const row = grid.get(cellKey(c.id, d.id));
                const tier: Tier = row?.tier ?? d.default_tier;
                const minRuns = row?.min_runs ?? d.default_min_runs;
                const headChanged = i === 0 || columns[i - 1]?.group_name !== d.group_name;
                return (
                  <div key={d.id}>
                    {headChanged && (
                      <div className="grouphead">{d.group_name ?? 'Ungrouped'}</div>
                    )}
                    <div className="gridrow">
                      <span className="dn2">
                        <TierGem tier={tier} />
                        {d.name}
                      </span>
                      <select
                        aria-label={`${c.name} tier in ${d.name}`}
                        value={tier}
                        onChange={(e) =>
                          void write(c.id, d.id, {
                            tier: e.target.value as Tier,
                            min_runs: minRuns,
                          })
                        }
                        disabled={c.is_active === false}
                      >
                        {TIERS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input
                        key={minRuns}
                        type="number"
                        min={0}
                        max={d.character_attempts}
                        aria-label={`${c.name} minimum runs in ${d.name}`}
                        defaultValue={minRuns}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (next !== minRuns) void write(c.id, d.id, { tier, min_runs: next });
                        }}
                        disabled={c.is_active === false}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
      <table className="datatable">
        <thead>
          <tr className="groupband">
            <th />
            {spans.map((span, i) => (
              <th key={i} colSpan={span.span} className={span.label ? 'grouped' : undefined}>
                {span.label}
              </th>
            ))}
          </tr>
          <tr>
            <th>Character</th>
            {columns.map((d) => {
              const currentTotal = dungeonTotals.get(d.id) ?? 0;
              const isOverLimit = currentTotal > d.account_attempts;
              const isAtLimit = currentTotal === d.account_attempts;
              return (
                <th key={d.id}>
                  {d.name}
                  <br />
                  <span className={isOverLimit ? 'error-text' : isAtLimit ? 'warning-text' : 'muted'}>
                    {currentTotal} / {d.account_attempts}
                  </span>
                  <Meter
                    value={currentTotal}
                    max={d.account_attempts}
                    tone={isOverLimit ? 'danger' : isAtLimit ? 'warn' : 'accent'}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {orderedCharacters.map((c) => (
            <tr
              key={c.id}
              data-sortable-id={c.id}
              className={
                [c.is_active === false ? 'is-parked' : '', activeId === c.id ? 'sorting' : '']
                  .filter(Boolean)
                  .join(' ') || undefined
              }
            >
              <th scope="row">
                <div className="row-actions">
                  <span {...handleProps(c.id, `Reorder ${c.name}`)}>⠿</span>
                  <input
                    type="checkbox"
                    checked={c.is_active !== false}
                    aria-label={`Include ${c.name} in plan`}
                    onChange={(e) => void toggleActive(c, e.target.checked)}
                  />
                  <input
                    aria-label={`${c.name} name`}
                    defaultValue={c.name}
                    onBlur={(e) => void rename(c, e.target.value)}
                    className="name-field"
                    disabled={c.is_active === false}
                  />
                  <Button variant="outline"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => void remove(c)}
                  >
                    ×
                  </Button>
                  {characters.length > 1 && (
                    <select
                      aria-label={`Copy grid onto ${c.name} from`}
                      value=""
                      disabled={busy || c.is_active === false}
                      onChange={(e) => {
                        const from = e.target.value;
                        // Reset first: the select is a command, not a value, so
                        // it must not sit showing the last source it was used with.
                        e.target.value = '';
                        if (from) void copyFrom(from, c);
                      }}
                    >
                      <option value="">Copy from…</option>
                      {characters
                        .filter((other) => other.id !== c.id)
                        .map((other) => (
                          <option key={other.id} value={other.id}>
                            {other.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </th>
              {columns.map((d) => {
                const row = grid.get(cellKey(c.id, d.id));
                const tier: Tier = row?.tier ?? d.default_tier;
                const minRuns = row?.min_runs ?? d.default_min_runs;
                
                const currentTotal = dungeonTotals.get(d.id) ?? 0;
                const isOverLimit = currentTotal > d.account_attempts;
                const maxAllowedByAccount = Math.max(minRuns, d.account_attempts - currentTotal + minRuns);
                const maxAllowed = Math.min(d.character_attempts, maxAllowedByAccount);

                return (
                  <td key={d.id}>
                    <TierGem tier={tier} />
                    <select
                      aria-label={`${c.name} tier in ${d.name}`}
                      value={tier}
                      onChange={(e) =>
                        void write(c.id, d.id, { tier: e.target.value as Tier, min_runs: minRuns })
                      }
                      disabled={c.is_active === false}
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      key={minRuns}
                      type="number"
                      className={isOverLimit ? 'error-input' : ''}
                      min={0}
                      max={maxAllowed}
                      aria-label={`${c.name} minimum runs in ${d.name}`}
                      defaultValue={minRuns}
                      // On blur, not on change: a write here refreshes the
                      // grid, which remounts this input on its `key` and takes
                      // the focus with it, so writing per keystroke loses every
                      // digit after the first.
                      onBlur={(e) => {
                        const next = Number(e.target.value);
                        if (next !== minRuns) void write(c.id, d.id, { tier, min_runs: next });
                      }}
                      disabled={c.is_active === false}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      )}

      <h3>Add a character</h3>
      <div className="row-actions">
        <input
          aria-label="New character name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Character name"
        />
        <Button
          disabled={busy || draft.trim() === ''}
          onClick={() => void addCharacter()}
        >
          Add character
        </Button>
      </div>
    </section>
  );
}
