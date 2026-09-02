import React, { useState } from 'react';
import type { Dungeon, GridEntry, Tier } from '../engine/types';
import { Portrait } from '../ui/Shared';
import { getClassHue } from '../ui/hues';
import { CHARACTER_CLASSES } from '../data/classes';
import { TIER_TEMPLATES, templateCells } from './gridTemplate';
import './AddCharacterModal.css';

interface AddCharacterModalProps {
  dungeons: Dungeon[];
  /** Every character's current tiers, so a new one can be copied from one. */
  grid: GridEntry[];
  characters: { id: string; name: string }[];
  onClose: () => void;
  onAdd: (name: string, characterClass: string, tiers: Record<string, Tier>) => Promise<void>;
}

const TIERS: Tier[] = ['none', 'solo', 'story', 'elite', 'legend'];

function defaultTiers(dungeons: Dungeon[]): Record<string, Tier> {
  const initial: Record<string, Tier> = {};
  for (const d of dungeons) initial[d.id] = d.default_tier;
  return initial;
}

export default function AddCharacterModal({
  dungeons,
  grid,
  characters,
  onClose,
  onAdd,
}: AddCharacterModalProps) {
  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>(CHARACTER_CLASSES[0]?.name ?? 'Sugariff');
  const [template, setTemplate] = useState('blank');
  const [tiers, setTiers] = useState<Record<string, Tier>>(() => defaultTiers(dungeons));

  /**
   * Starting point for the tier rows. A copy takes what the source DISPLAYS,
   * defaults included - copying only its stored rows would leave the two
   * matching by coincidence and diverging the moment a default changed.
   */
  function applyTemplate(value: string) {
    setTemplate(value);
    const cells = templateCells(value, {
      targetId: 'new',
      dungeons,
      lookup: (characterId, dungeonId) => {
        const row = grid.find((g) => g.characterId === characterId && g.dungeonId === dungeonId);
        return row ? { tier: row.tier, min_runs: row.minRuns } : undefined;
      },
    });
    if (cells.length === 0) {
      setTiers(defaultTiers(dungeons));
      return;
    }
    const next: Record<string, Tier> = {};
    for (const cell of cells) next[cell.dungeon_id] = cell.tier;
    setTiers(next);
  }

  const hue = getClassHue(selectedClass);
  const unlockedCount = Object.values(tiers).filter(t => t !== 'none').length;
  
  const canAdd = name.trim().length > 0;
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    if (!canAdd || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(name.trim(), selectedClass, tiers);
      onClose();
    } catch (err) {
      console.error(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="add-character-panel">
        <div className="ac-header">
          <div className="ac-header-left">
            <Portrait name={name.trim()} hue={hue} size={44} characterClass={selectedClass} />
            <div className="ac-header-text">
              <span className="ac-title">{name.trim() || 'New character'}</span>
              <span className="ac-sub">Joins the roster with 0 gold this week</span>
            </div>
          </div>
          <button type="button" className="ac-close" aria-label="Close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="ac-config-row">
          <div className="ac-input-group ac-border-right">
            <span className="ac-label">NAME</span>
            <input
              className="ac-text-input"
              aria-label="New character name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Character name"
              autoFocus
            />
          </div>
          <div className="ac-input-group">
            <span className="ac-label">START FROM</span>
            <select
              aria-label="Template"
              className="ac-template"
              value={template}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="blank">Template: none</option>
              <optgroup label="Every dungeon at">
                {TIER_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
              {characters.length > 0 && (
                <optgroup label="Copy a character">
                  {characters.map((c) => (
                    <option key={c.id} value={`char:${c.id}`}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="ac-input-group">
            <span className="ac-label">CLASS</span>
            <div className="ac-class-grid">
              {CHARACTER_CLASSES.map((c) => {
                const isSelected = selectedClass === c.name;
                return (
                  <button
                    type="button"
                    key={c.name}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedClass(c.name)}
                    className={`ac-class-chip ${isSelected ? 'selected' : ''}`}
                    style={{ '--c-hue': c.hue } as React.CSSProperties}
                  >
                    <img src={c.icon} alt="" className="ac-class-mark" />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="ac-tiers-section">
          <div className="ac-tiers-header">
            <span className="ac-label">HIGHEST TIER CLEARED</span>
            <span className="ac-helper">Leave a dungeon on "none" and the solver will never send this character there.</span>
          </div>
          <div className="ac-tiers-list">
            {dungeons.map(d => (
              <div key={d.id} className="ac-tier-row">
                <span className="ac-group-tag" style={{ color: `var(--group-${(d.group_name || '').toLowerCase()})` }}>
                  {d.group_name}
                </span>
                <span className="ac-dungeon-name">{d.name}</span>
                <div className="ac-segmented">
                  {TIERS.map(t => {
                    const selected = tiers[d.id] === t;
                    return (
                      <button
                        type="button"
                        key={t}
                        aria-label={`${d.name} at ${t}`}
                        aria-pressed={selected}
                        onClick={() => setTiers((prev) => ({ ...prev, [d.id]: t }))}
                        className={`ac-segment ${selected ? 'selected' : ''}`}
                        style={selected ? { color: `var(--tier-${t})` } : {}}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ac-footer">
          <span className="ac-count">{unlockedCount} of {dungeons.length} dungeons unlocked</span>
          <div className="ac-actions">
            <button type="button" className="ac-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="ac-submit"
              disabled={!canAdd || submitting}
              onClick={() => void handleAdd()}
            >
              Add character
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
