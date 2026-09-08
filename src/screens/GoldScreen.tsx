import './GoldScreen.css';

type DungeonGold = {
  dungeon: string;
  mode: 'auto' | 'manual';
  base: number;
  c: 'censored' | null;
  stone: number;
};

const GOLD_CONSTANTS: DungeonGold[] = [
  { dungeon: 'Temple Of Fate', mode: 'auto', base: 101720, c: 'censored', stone: 4000 },
  { dungeon: 'Checkmate', mode: 'auto', base: 95385, c: 'censored', stone: 6000 },
  { dungeon: 'Duskfeather Lair', mode: 'auto', base: 80500, c: 'censored', stone: 5000 },
  { dungeon: "Kraken's Spine", mode: 'auto', base: 73840, c: 'censored', stone: 5000 },
  { dungeon: 'Apocalyptic Descent', mode: 'auto', base: 65960, c: 'censored', stone: 4000 },
  { dungeon: 'Heart Of Taboos', mode: 'auto', base: 52750, c: 'censored', stone: 5000 },
  { dungeon: 'Queen Coronation', mode: 'auto', base: 46200, c: 'censored', stone: 8000 },
  { dungeon: 'The Deep Dive', mode: 'manual', base: 75000, c: null, stone: 5000 },
  { dungeon: 'Shackled Psyche', mode: 'manual', base: 50000, c: null, stone: 5000 },
];

type BuffReading = {
  buffs: string;
  sum: string;
  observed: number;
  base: number;
  predicted: number;
};

const BUFF_READINGS: BuffReading[] = [
  { buffs: 'none (with stone)', sum: '0%', observed: 84500, base: 79500, predicted: 79500 },
  { buffs: 'title', sum: '2%', observed: 80500, base: 80500, predicted: 80500 },
  { buffs: 'abnormal sense', sum: '5%', observed: 82000, base: 82000, predicted: 82000 },
  { buffs: 'potion', sum: '10%', observed: 84500, base: 84500, predicted: 84500 },
  { buffs: 'title + potion (with stone)', sum: '12%', observed: 90500, base: 85500, predicted: 85500 },
  { buffs: 'title + AS + potion (with stone)', sum: '17%', observed: 93000, base: 88000, predicted: 88000 },
  { buffs: 'title + potion (earlier reading)', sum: '12%', observed: 92138, base: 87138, predicted: 85500 },
  { buffs: 'title + AS + potion (earlier reading)', sum: '17%', observed: 89650, base: 89650, predicted: 88000 },
];

export default function GoldScreen() {
  return (
    <div className="gold-screen">
      
      <div className="gold-card">
        <h3 className="gold-card-title">1. The Formula</h3>
        <div className="gold-formula-block">
          <div className="formula-line">Total Run = Base Gold (tier, mode) + Stone Bonus (if a stone drops)</div>
          <br />
          <div className="formula-line">Auto Mode Base   = B + C x (Total Buff Percentages)</div>
          <div className="formula-line">Manual Mode Base = B_manual (Buffs don't apply here)</div>
        </div>
        <ul className="gold-notes">
          <li>The <strong>stone bonus</strong> is a flat bonus. Buffs never affect it, and it stays the same across all modes and difficulties.</li>
          <li>The <strong>C value</strong> is the only part that buffs multiply. It makes up roughly half the reward but isn't a fixed ratio, so it's measured individually per dungeon.</li>
          <li><strong>Elite</strong> and <strong>Legend</strong> difficulties pay exactly the same amount.</li>
          <li><strong>Auto mode</strong> pays more and saves time, so use it whenever possible (only The Deep Dive and Shackled Psyche require manual runs).</li>
          <li><strong>Manual runs</strong> ignore all buffs, making B_manual a constant value.</li>
          <li><strong>Buffs</strong> are simple percentages of C. For example, testing on Duskfeather Lair showed the title added 1,000 gold, abnormal sense added 2,500, and the potion added 5,000. These equal exactly 2%, 5%, and 10% of C (███).</li>
        </ul>
      </div>

      <div className="gold-card">
        <h3 className="gold-card-title">2. Measured Constants</h3>
        <div className="gold-table-container">
          <table className="gold-table">
            <thead>
              <tr>
                <th>Dungeon</th>
                <th>Mode</th>
                <th className="num">Base (title on)</th>
                <th className="num">C</th>
                <th className="num">Stone Bonus</th>
              </tr>
            </thead>
            <tbody>
              {GOLD_CONSTANTS.map((d) => (
                <tr key={d.dungeon}>
                  <td>{d.dungeon}</td>
                  <td>{d.mode}</td>
                  <td className="num">{d.base.toLocaleString('en-US')}</td>
                  <td className="num">{d.c === null ? 'n/a' : '███'}</td>
                  <td className="num">{d.stone.toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="gold-tier-ref">
          <strong>Story tier:</strong> We only have measurements for three dungeons so far: Kraken's Spine (59,960), Heart Of Taboos (42,200), and Shackled Psyche (40,000). We don't have any solo figures yet.
        </p>
        <p className="gold-tier-ref">
          <strong>Manual comparison:</strong> Duskfeather Lair pays 75,000 when played manually, compared to 80,500 on auto (about 7.3% less).
        </p>
      </div>

      <div className="gold-card">
        <h3 className="gold-card-title">Buff Readings (Duskfeather Lair - Elite, Auto)</h3>
        <div className="gold-table-container">
          <table className="gold-table">
            <thead>
              <tr>
                <th>Active Buffs</th>
                <th className="num">Sum</th>
                <th className="num">Observed</th>
                <th className="num">Base</th>
                <th className="num">Predicted</th>
              </tr>
            </thead>
            <tbody>
              {BUFF_READINGS.map((r) => (
                <tr key={r.buffs}>
                  <td>{r.buffs}</td>
                  <td className="num">{r.sum}</td>
                  <td className="num">{r.observed.toLocaleString('en-US')}</td>
                  <td className="num">{r.base.toLocaleString('en-US')}</td>
                  <td className="num">
                    {r.predicted.toLocaleString('en-US')}
                    {r.base !== r.predicted && ` (off ${(r.base - r.predicted).toLocaleString('en-US')})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="gold-tier-ref">
          "Base" is the observed amount minus the 5,000 stone bonus if a stone dropped. Every row perfectly matches our C prediction except for the last two. Those were our first attempts at measuring multiple buffs at once. Later tests with the same setup (Title + Potion) correctly gave 90,500. This means the 92,138 and 89,650 figures were just bad readings. We kept them here to show what a flawed measurement looks like.
        </p>
      </div>

      <div className="gold-card">
        <h3 className="gold-card-title">3. How We Figured This Out</h3>
        <ul className="gold-notes">
          <li><strong>Stone bonus is flat and unbuffed:</strong> Temple Of Fate always had a 4,000 gold difference when a stone dropped, whether the title was equipped (105,720 vs 101,720) or not (104,680 vs 100,680).</li>
          <li><strong>The title is 2% of C, not the whole reward:</strong> If it affected the whole reward, the drops would scale evenly, but they don't. Calculating the difference gives us a C value that lands cleanly on a multiple of 500 for all seven auto dungeons.</li>
          <li><strong>Buffs don't affect manual runs:</strong> Duskfeather Lair gave exactly 80,000 gold with the title, without it, and with all three buffs active (always with a stone).</li>
          <li><strong>All buffs multiply the same C:</strong> Tested individually on Duskfeather Lair, the title added 1,000, abnormal sense added 2,500, and the potion added 5,000. These perfectly match 2%, 5%, and 10% of a ███ C. We saw similar perfect math on Queen Coronation.</li>
          <li><strong>Queen Coronation's C was verified twice:</strong> We figured it out using the title buff, and later the potion buff perfectly matched the same expected value.</li>
          <li><strong>Buffs stack additively:</strong> Title (2%) and potion (10%) together act as a flat 12% buff. All three combined act as a 17% buff. Every combination tested perfectly matched the math.</li>
          <li><strong>Auto pays better than manual:</strong> Duskfeather Lair with title gives 80,500 on auto, but only 75,000 manually.</li>
          <li><strong>Stone bonuses still apply in manual:</strong> Duskfeather Lair manual runs gave 80,000 with a stone and 75,000 without.</li>
          <li><strong>Elite and Legend pay the same:</strong> We verified this directly in the game for every dungeon.</li>
        </ul>
      </div>

      <div className="gold-card">
        <h3 className="gold-card-title">4. What We Still Need to Measure</h3>
        <ul className="gold-notes">
          <li><strong>What messed up those two early readings?</strong> It's not a huge deal since the model is proven, but getting 90,500 and 92,138 on the same setup means something changed between runs. It was likely a different character, since title buffs vary by character.</li>
          <li><strong>Missing Story gold:</strong> We still need numbers for Checkmate, Queen Coronation, Temple Of Fate, Apocalyptic Descent, Duskfeather Lair, and The Deep Dive.</li>
          <li><strong>Does C scale with difficulty?</strong> We haven't measured any C values for Story tier yet.</li>
          <li><strong>Kraken's Spine math is slightly off.</strong> The elite-to-story ratio for Heart Of Taboos and Shackled Psyche is exactly 1.25. Kraken's Spine is currently at 1.23149. It's worth re-running to check if the 59,960 recorded value is wrong.</li>
          <li><strong>The stone drop rate:</strong> It's still using a 0.40 placeholder estimate. Check docs/stone-gold-tally.csv for the actual tallies.</li>
        </ul>
      </div>

    </div>
  );
}
