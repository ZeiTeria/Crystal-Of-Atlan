import React, { useState } from 'react';
import type { Dungeon, Tier } from '../engine/types';
import { Portrait, getClassHue } from '../ui/Shared';
import './AddCharacterModal.css';

interface AddCharacterModalProps {
  dungeons: Dungeon[];
  onClose: () => void;
  onAdd: (name: string, characterClass: string, tiers: Record<string, Tier>) => Promise<void>;
}

const CLASSES = ['Magister', 'Puppet Master', 'Swordsman', 'Musketeer', 'Alchemist', 'Fighter'];
const TIERS: Tier[] = ['none', 'solo', 'story', 'elite', 'legend'];

export default function AddCharacterModal({ dungeons, onClose, onAdd }: AddCharacterModalProps) {
  const [name, setName] = useState('');
  const [selectedClass, setSelectedClass] = useState(CLASSES[0]);
  
  // Default tiers to 'none' for all dungeons
  const [tiers, setTiers] = useState<Record<string, Tier>>(() => {
    const initial: Record<string, Tier> = {};
    for (const d of dungeons) {
      initial[d.id] = d.default_tier;
    }
    return initial;
  });

  const hue = getClassHue(selectedClass);
  const initial = name.trim() ? name.trim()[0].toUpperCase() : '?';
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
            <Portrait name={name} hue={hue} size={44} forceInitial={initial} />
            <div className="ac-header-text">
              <span className="ac-title">{name.trim() || 'New character'}</span>
              <span className="ac-sub">Joins the roster with 0 gold this week</span>
            </div>
          </div>
          <span className="ac-close" onClick={onClose}>&times;</span>
        </div>

        <div className="ac-config-row">
          <div className="ac-input-group ac-border-right">
            <span className="ac-label">NAME</span>
            <input 
              className="ac-text-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Character name"
              autoFocus
            />
          </div>
          <div className="ac-input-group">
            <span className="ac-label">CLASS</span>
            <div className="ac-class-grid">
              {CLASSES.map(c => {
                const cHue = getClassHue(c);
                const isSelected = selectedClass === c;
                return (
                  <div 
                    key={c}
                    onClick={() => setSelectedClass(c)}
                    className={`ac-class-chip ${isSelected ? 'selected' : ''}`}
                    style={{ '--c-hue': cHue } as React.CSSProperties}
                  >
                    {c}
                  </div>
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
                      <span 
                        key={t}
                        onClick={() => setTiers(prev => ({ ...prev, [d.id]: t }))}
                        className={`ac-segment ${selected ? 'selected' : ''}`}
                        style={selected ? { color: `var(--tier-${t})` } : {}}
                      >
                        {t}
                      </span>
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
            <span className="ac-cancel" onClick={onClose}>Cancel</span>
            <button 
              className="ac-submit" 
              disabled={!canAdd || submitting}
              onClick={() => void handleAdd()}
            >
              ADD TO ROSTER
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
