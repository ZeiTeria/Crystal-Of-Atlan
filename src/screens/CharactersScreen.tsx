import { useCallback, useEffect, useState } from 'react';
import {
  createCharacter,
  currentGameAccountId,
  deleteCharacter,
  listCharacters,
  renameCharacter,
  type CharacterRow,
} from '../data/accounts';

export default function CharactersScreen() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [characters, setCharacters] = useState<CharacterRow[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (id: string) => {
    try {
      setCharacters(await listCharacters(id));
      setError(null);
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    currentGameAccountId()
      .then(async (id) => {
        if (!mounted) return;
        setAccountId(id);
        await refresh(id);
      })
      .catch((err: unknown) => {
        if (mounted) {
          setError(String(err));
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [refresh]);

  async function add() {
    const name = draft.trim();
    if (name === '' || !accountId) return;
    try {
      await createCharacter(accountId, name);
      setDraft('');
      setError(null);
    } catch (err: unknown) {
      setError(String(err));
    }
    await refresh(accountId);
  }

  async function rename(character: CharacterRow, next: string) {
    const name = next.trim();
    if (name === '' || name === character.name || !accountId) return;
    try {
      await renameCharacter(character.id, name);
      setError(null);
    } catch (err: unknown) {
      setError(String(err));
    }
    await refresh(accountId);
  }

  async function remove(character: CharacterRow) {
    if (!accountId) return;
    const ok = window.confirm(
      `Delete ${character.name}? Its unlocked tiers and all its logged runs go too.`,
    );
    if (!ok) return;
    try {
      await deleteCharacter(character.id);
      setError(null);
    } catch (err: unknown) {
      setError(String(err));
    }
    await refresh(accountId);
  }

  if (loading) return <p>Loading characters...</p>;

  return (
    <section>
      <h2>Characters</h2>
      {error && <div className="error-message">Error: {error}</div>}

      {characters.length === 0 && <p className="muted">No characters yet.</p>}

      <table>
        <tbody>
          {characters.map((c) => (
            <tr key={c.id}>
              <td>
                <input
                  aria-label={`${c.name} name`}
                  defaultValue={c.name}
                  onBlur={(e) => void rename(c, e.target.value)}
                />
              </td>
              <td>
                <div className="row-actions">
                  <button
                    className="button button-outline"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => void remove(c)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Add a character</h3>
      <div className="row-actions">
        <input
          aria-label="New character name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Character name"
        />
        <button className="button" onClick={() => void add()}>
          Add character
        </button>
      </div>
    </section>
  );
}
