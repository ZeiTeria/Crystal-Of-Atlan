import type { Dungeon } from '../engine/types';
import { PAID_TIERS } from '../engine/types';
import { gold } from '../screens/planText';
import { getGroupHue } from './hues';
import './PublicDungeonTable.css';

interface PublicDungeonTableProps {
  dungeons: Dungeon[];
}

export default function PublicDungeonTable({ dungeons }: PublicDungeonTableProps) {
  return (
    <div className="public-dungeon-table-container">
      <h3 className="section-head">
        Reference: Gold per Run
        <span className="section-sub">blended effective figures, including base and average stone drops</span>
      </h3>
      <table className="public-dungeon-table">
        <thead>
          <tr>
            <th>Dungeon</th>
            {PAID_TIERS.map(t => (
              <th key={t} style={{ color: `var(--tier-${t})` }}>
                {t.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dungeons.map(d => (
            <tr key={d.id}>
              <td>
                <div className="dungeon-name-cell">
                  {d.group_name && (
                    <span className="group-tag" style={{ color: getGroupHue(d.group_name) }}>
                      {d.group_name}
                    </span>
                  )}
                  <strong>{d.name}</strong>
                </div>
              </td>
              {PAID_TIERS.map(t => {
                const value = d.gold[t];
                const isEstimated = d.goldEstimated.includes(t);
                const isUnknown = d.goldUnknown;

                if (isUnknown) {
                  return <td key={t} className="muted">—</td>;
                }

                return (
                  <td key={t}>
                    {gold(value)}
                    {isEstimated && <span className="estimated-mark" title="Estimated from nearest tier">*</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted table-footnote">
        * Figure is estimated from another tier. Figures include an estimate for stone drops.
      </p>
    </div>
  );
}

