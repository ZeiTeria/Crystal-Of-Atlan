import React, { useState } from 'react';
import type { PlanInput, PlanResult } from '../engine/types';
import { Portrait, getClassHue } from '../ui/Shared';
import './QuestLog.css';

interface QuestLogProps {
  input: PlanInput;
  result: PlanResult;
  onAddClick?: () => void;
  onUpdateMinRuns?: (charId: string, dId: string, currentTier: string, minRuns: number) => void;
}

export default function QuestLog({ input, result, onAddClick, onUpdateMinRuns }: QuestLogProps) {
  const { characters, dungeons } = input;
  const [selectedId, setSelectedId] = useState<string>(characters[0]?.id ?? '');

  if (result.status === 'infeasible') {
    return <div>Plan infeasible</div>;
  }

  if (characters.length === 0) return <div>No characters</div>;

  const selectedChar = characters.find(c => c.id === selectedId) || characters[0];
  const charAssignments = result.assignments.filter(a => a.characterId === selectedChar.id);
  const runsCount = charAssignments.reduce((sum, a) => sum + a.runs, 0);
  
  const cap = input.settings.goldCap;
  const earned = cap - (input.goldHeadroom[selectedChar.id] ?? cap);

  const distinctGroups = Array.from(new Set(dungeons.map(d => d.group_name || 'OTHER')));
  const groups = distinctGroups.map(g => {
    return {
      name: g,
      items: dungeons.filter(d => (d.group_name || 'OTHER') === g).map(d => {
        const assignment = charAssignments.find(a => a.dungeonId === d.id);
        const gridEntry = input.grid.find(ge => ge.dungeonId === d.id && ge.characterId === selectedChar.id);
        const minRuns = gridEntry ? gridEntry.minRuns : 0;
        const runs = assignment ? assignment.runs : 0;
        const tier = gridEntry && gridEntry.tier !== 'none' ? gridEntry.tier : (assignment ? assignment.tier : 'story'); // fallback display
        const totalUsed = result.assignments.filter(a => a.dungeonId === d.id).reduce((sum, a) => sum + a.runs, 0);
        return {
          id: d.id,
          name: d.name,
          tier: runs > 0 ? tier : (d.default_tier !== 'none' ? d.default_tier : 'story'),
          runs,
          minRuns,
          gold: runs > 0 ? assignment!.goldTotal : 0,
          goldPerRun: d.gold.elite, // simplifcation
          usedTotal: totalUsed,
          capTotal: d.accountAttempts,
          charCap: d.characterAttempts
        };
      })
    };
  }).filter(g => g.items.length > 0);

  return (
    <div className="quest-log-container">
      <div className="quest-sidebar">
        <div className="roster-header">ROSTER</div>
        <div className="roster-list">
          {characters.map(c => {
            const assign = result.assignments.filter(a => a.characterId === c.id);
            const rCount = assign.reduce((sum, a) => sum + a.runs, 0);
            const rEarned = cap - (input.goldHeadroom[c.id] ?? cap);
            const pct = Math.min(100, (rEarned / cap) * 100);
            const isSelected = c.id === selectedId;
            const hue = getClassHue(c.class, c.name);
            return (
              <div 
                key={c.id} 
                className={`roster-item ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedId(c.id)}
                style={{ '--hue': hue } as React.CSSProperties}
              >
                <div className="roster-item-content">
                  <Portrait name={c.name} hue={hue} size={28} />
                  <div className="roster-item-info">
                    <div className="roster-item-top">
                      <span className="roster-name">{c.name}</span>
                      <span className="roster-runs">{rCount}x</span>
                    </div>
                    <div className="roster-item-meter-bg">
                      <div className="roster-item-meter-fill" style={{ width: `${pct}%`, background: rEarned >= cap ? '#F9E57A' : hue }}></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div 
          className="roster-item" 
          onClick={onAddClick}
          style={{ opacity: 0.6, marginTop: 'auto', borderTop: '1px solid var(--line-strong)' }}
        >
          <div className="roster-item-content">
            <div style={{ width: 28, height: 28, border: '1px dashed var(--text-faint)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}>+</div>
            <div className="roster-item-info">
              <span className="roster-name" style={{ color: 'var(--text-dim)' }}>Add Character</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="quest-main">
        <div className="quest-header">
          <div className="quest-header-left">
            <Portrait name={selectedChar.name} hue={getClassHue(selectedChar.class, selectedChar.name)} size={52} />
            <div className="quest-header-text">
              <span className="qh-name">{selectedChar.name}</span>
              <span className="qh-sub">{runsCount} runs this week {earned >= cap ? '· gold cap reached' : ''}</span>
            </div>
          </div>
          <div className="quest-header-right">
            <div className="qh-gold-line">
              <span className="qh-gold-val">{earned.toLocaleString('en-US')}</span>
              <span className="qh-gold-cap">/ {cap.toLocaleString('en-US')}</span>
            </div>
            <div className="qh-meter-bg">
              <div className="qh-meter-fill" style={{ width: `${Math.min(100, (earned / cap) * 100)}%`, background: earned >= cap ? '#F9E57A' : getClassHue(selectedChar.class, selectedChar.name) }}></div>
            </div>
          </div>
        </div>
        
        <div className="quest-body">
          {groups.map(g => (
            <div key={g.name} className="dungeon-group">
              <div className="group-heading" style={{ color: `var(--group-${g.name.toLowerCase()})` }}>
                {g.name}
              </div>
              {g.items.map(d => (
                <div key={d.id} className={`dungeon-row ${d.runs === 0 ? 'dimmed' : ''}`}>
                  <div className="dungeon-row-info">
                    <div className="d-icon-col" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div className={`tier-gem tier-${d.tier}`}></div>
                      <span className="d-name">{d.name}</span>
                    </div>
                    <span className="d-sub">{d.goldPerRun.toLocaleString('en-US')} per run · {d.usedTotal}/{d.capTotal} used account-wide</span>
                  </div>
                  <div className="d-tier">
                    <select 
                      value={d.tier}
                      onChange={(e) => onUpdateGrid?.(selectedChar.id, d.id, e.target.value, d.minRuns)}
                      style={{ background: 'transparent', color: `var(--tier-${d.tier})`, border: 'none', outline: 'none', font: 'inherit', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none' }}
                    >
                      <option value="none" style={{ color: 'var(--tier-none)' }}>None</option>
                      <option value="solo" style={{ color: 'var(--tier-solo)' }}>Solo</option>
                      <option value="story" style={{ color: 'var(--tier-story)' }}>Story</option>
                      <option value="elite" style={{ color: 'var(--tier-elite)' }}>Elite</option>
                      <option value="legend" style={{ color: 'var(--tier-legend)' }}>Legend</option>
                    </select>
                  </div>
                  <div className="d-stepper">
                    <button 
                      className="stepper-btn" 
                      onClick={() => onUpdateGrid?.(selectedChar.id, d.id, d.tier, Math.max(0, d.minRuns - 1))}
                    >−</button>
                    <span className="stepper-val" style={{ color: d.minRuns > 0 ? getClassHue(selectedChar.class, selectedChar.name) : '#3A414D' }}>
                      {d.minRuns}
                    </span>
                    <button 
                      className="stepper-btn" 
                      onClick={() => onUpdateGrid?.(selectedChar.id, d.id, d.tier, Math.min(d.charCap, d.minRuns + 1))}
                    >+</button>
                  </div>
                  <div className="d-gold">{d.runs > 0 ? d.gold.toLocaleString('en-US') : '—'}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
