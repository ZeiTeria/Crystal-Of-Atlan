import './CharacterPicker.css';

/**
 * Which character the phone layouts are showing. The desktop matrices show all
 * twelve at once; at 390px the axis has to flip to one at a time, and this is
 * how you move between them.
 */
export default function CharacterPicker({
  characters,
  selectedId,
  onSelect,
  onAdd,
}: {
  characters: { id: string; name: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd?: () => void;
}) {
  return (
    <div className="picker" role="tablist" aria-label="Character">
      {characters.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={c.id === selectedId}
          className={c.id === selectedId ? 'picker-tab on' : 'picker-tab'}
          onClick={() => onSelect(c.id)}
        >
          {c.name}
        </button>
      ))}
      {onAdd && (
        <button type="button" className="picker-tab picker-add" onClick={onAdd} aria-label="Add character">
          +
        </button>
      )}
    </div>
  );
}
