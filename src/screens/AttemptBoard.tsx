import React from 'react';
import type { PlanInput, PlanResult, Character, Dungeon } from '../engine/types';
import { Portrait, DiamondDot, getClassHue, getGroupHue } from '../ui/Shared';
import { gold } from './planText';
import './AttemptBoard.css';

import { matrixColumns } from './columns';

interface AttemptBoardProps {
  input: PlanInput;
  result: PlanResult;
  onAddClick?: () => void;
}

export default function AttemptBoard({ input, result, onAddClick }: AttemptBoardProps) {
  if (result.status === 'infeasible') {
    return <div>Plan infeasible</div>;
  }

  const { characters, dungeons: rawDungeons, accountAttemptsLeft } = input;
  
  // Sort dungeons newest first (highest sort_order)
  const dungeons = matrixColumns(rawDungeons);
  
  // Compute account totals
  const totalUsed = result.totals.attempts;
  const totalCap = dungeons.reduce((sum, d) => sum + d.accountAttempts, 0); // Simplified total cap

  // Compute roster stats
  const rosterStats = characters.map(c => {
    const assignments = result.assignments.filter(a => a.characterId === c.id);
    const runs = assignments.reduce((sum, a) => sum + a.runs, 0);
    const earned = input.settings.goldCap - (input.goldHeadroom[c.id] ?? input.settings.goldCap);
    const cap = input.settings.goldCap;
    return { c, runs, earned, cap };
  });

  // Compute board cards
  const board = dungeons.map(d => {
    const assignments = result.assignments.filter(a => a.dungeonId === d.id);
    const used = assignments.reduce((sum, a) => sum + a.runs, 0);
    
    // slots array
    const slots = [];
    for (const a of assignments) {
      for (let i = 0; i < a.runs; i++) {
        slots.push({ tier: a.tier, type: 'filled' });
      }
    }
    // padding remaining unusable attempts (simplified logic here)
    const emptyCount = d.accountAttempts - used;
    for (let i = 0; i < emptyCount; i++) {
      slots.push({ type: 'empty' });
    }

    const who = assignments.map(a => {
      const char = characters.find(c => c.id === a.characterId);
      return {
        name: char?.name ?? 'Unknown',
        hue: getClassHue(char?.class, char?.name),
        n: a.runs,
        gold: a.goldTotal,
      };
    });

    return {
      id: d.id,
      name: d.name,
      group: d.group_name ?? 'UNKNOWN',
      used,
      cap: d.accountAttempts,
      charCap: d.characterAttempts,
      slots,
      who,
      each: d.gold.elite, // simplified fallback
    };
  });

  const totalAttemptsLeft = Object.values(accountAttemptsLeft).reduce((sum, val) => sum + val, 0);

  return (
    <div className="attempt-board">
      <div className="board-summary-strip">
        <div className="summary-left">
          <span className="summary-label">ATTEMPTS LEFT OVER</span>
          <div className="summary-numbers">
            <strong>{totalAttemptsLeft}</strong>
            <span>/ {totalCap}</span>
          </div>
          <span className="summary-note">
            <span className="empty-box" /> Nothing else can be spent.
          </span>
        </div>
        
        <div className="roster-tiles">
          {rosterStats.map(({ c, runs, earned, cap }) => {
            const hue = getClassHue(c.class, c.name);
            const capped = earned >= cap;
            return (
              <div key={c.id} className="roster-tile">
                <div className="tile-top">
                  <Portrait name={c.name} hue={hue} dim={runs === 0} />
                  <div className="tile-name-col">
                    <strong>{c.name}</strong>
                    <span>{runs} runs</span>
                  </div>
                </div>
                <div className="tile-bottom">
                  <div className="tile-gold-row">
                    <span style={{ color: capped ? 'var(--warn)' : 'var(--text-dim)' }}>
                      {gold(earned)}
                    </span>
                    <span>{gold(cap)}</span>
                  </div>
                  <div className="tile-meter">
                    <div 
                      className="meter-fill" 
                      style={{ 
                        width: `${Math.min(100, (earned / cap) * 100)}%`,
                        backgroundColor: capped ? 'var(--warn)' : hue 
                      }} 
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="add-character-btn" onClick={onAddClick}>+ Add</div>
        </div>
      </div>

      <div className="board-grid">
        {board.map(b => (
          <div key={b.id} className="board-card">
            <div className="card-header">
              <div className="card-title">
                <span className="group-tag" style={{ color: getGroupHue(b.group) }}>{b.group}</span>
                <strong>{b.name}</strong>
              </div>
              <div className="card-used">
                <strong>{b.used}</strong>
                <span>/ {b.cap}</span>
              </div>
            </div>
            
            <div className="card-slots">
              {b.slots.map((s, i) => (
                <span 
                  key={i} 
                  className={`slot ${s.type}`} 
                  style={s.type === 'filled' ? { backgroundColor: `var(--tier-${s.tier})` } : {}}
                />
              ))}
            </div>

            <div className="card-who-list">
              {b.who.map((w, i) => (
                <div key={i} className="who-row">
                  <DiamondDot hue={w.hue} />
                  <span className="who-name">{w.name}</span>
                  <span className="who-n">{w.n}×</span>
                  <span className="who-gold">{gold(w.gold)}</span>
                </div>
              ))}
            </div>

            <div className="card-footer">
              <span>{gold(b.each)} per run</span>
              <span>Max {b.charCap} / char</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
