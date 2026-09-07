import './GoldScreen.css';

type DungeonGold = {
  dungeon: string;
  mode: 'auto' | 'manual';
  base: number;
  c: number | null;
  premium: number;
};

const GOLD_CONSTANTS: DungeonGold[] = [
  { dungeon: 'Temple Of Fate', mode: 'auto', base: 101720, c: 52000, premium: 4000 },
  { dungeon: 'Checkmate', mode: 'auto', base: 95385, c: 53500, premium: 6000 },
  { dungeon: 'Duskfeather Lair', mode: 'auto', base: 80500, c: 50000, premium: 5000 },
  { dungeon: "Kraken's Spine", mode: 'auto', base: 73840, c: 44000, premium: 5000 },
  { dungeon: 'Apocalyptic Descent', mode: 'auto', base: 65960, c: 36000, premium: 4000 },
  { dungeon: 'Heart Of Taboos', mode: 'auto', base: 52750, c: 25000, premium: 5000 },
  { dungeon: 'Queen Coronation', mode: 'auto', base: 46200, c: 20000, premium: 8000 },
  { dungeon: 'The Deep Dive', mode: 'manual', base: 75000, c: null, premium: 5000 },
  { dungeon: 'Shackled Psyche', mode: 'manual', base: 50000, c: null, premium: 5000 },
];

export default function GoldScreen() {
  return (
    <div className="gold-screen">
      <h3 className="section-head">
        1. The formula
      </h3>
      <div className="gold-formula-block">
        <div className="formula-line">one run  =  base(tier, mode)  +  stone premium (only when a stone drops)</div>
        <br />
        <div className="formula-line">base, auto mode    =  B  +  C x (sum of active buff percentages)</div>
        <div className="formula-line">base, manual mode  =  B_manual        &lt;- buffs do NOT apply</div>
      </div>
      <ul className="gold-notes">
        <li>The stone premium is FLAT: a fixed number of gold per dungeon. Buffs never touch it, and it is the same in auto and manual mode and at every difficulty.</li>
        <li>C is the only part a buff multiplies. It is roughly half the reward but not a fixed fraction, so it has to be measured per dungeon.</li>
        <li>Elite and Legend always pay exactly the same.</li>
        <li>Auto pays more than manual and costs no time, so always timeskip when the dungeon allows it. Only The Deep Dive and Shackled Psyche force manual.</li>
      </ul>

      <h3 className="section-head">
        2. Measured constants
      </h3>
      <div className="gold-table-container">
        <table className="gold-table">
          <thead>
            <tr>
              <th>Dungeon</th>
              <th>Mode</th>
              <th className="num">Base (title on)</th>
              <th className="num">C</th>
              <th className="num">Stone premium</th>
            </tr>
          </thead>
          <tbody>
            {GOLD_CONSTANTS.map((d) => (
              <tr key={d.dungeon}>
                <td>{d.dungeon}</td>
                <td>{d.mode}</td>
                <td className="num">{d.base.toLocaleString('en-US')}</td>
                <td className="num">{d.c === null ? 'n/a' : d.c.toLocaleString('en-US')}</td>
                <td className="num">{d.premium.toLocaleString('en-US')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="gold-tier-ref">
        <strong>Story tier:</strong> only three are measured - Kraken's Spine 59,960, Heart Of Taboos 42,200, Shackled Psyche 40,000. No solo figure has ever been measured.
      </p>
      <p className="gold-tier-ref">
        <strong>Manual reference:</strong> Duskfeather Lair pays 75,000 played by hand versus 80,500 on auto, 7.3% less.
      </p>

      <h3 className="section-head">
        3. How this was established
      </h3>
      <ul className="gold-notes">
        <li><strong>The stone premium is flat and unbuffed</strong> - Temple Of Fate showed a 4,000 gap with the title on (105,720 vs 101,720) and the same 4,000 with it off (104,680 vs 100,680).</li>
        <li><strong>The title is 2% of C, not 2% of the reward</strong> - the title-off drops are not proportional to the bases (drops in a ratio of 2.08 where the bases are 1.93). Solving drop / 0.02 gives a C that lands on a multiple of 500 for all seven auto dungeons.</li>
        <li><strong>The title does nothing on manual runs</strong> - Duskfeather Lair paid 80,000 with the title and 80,000 without, both with a stone.</li>
        <li><strong>Auto pays more than manual</strong> - Duskfeather Lair, title on: 80,500 auto against 75,000 manual.</li>
        <li><strong>The premium applies in manual too</strong> - Duskfeather Lair manual, 80,000 with a stone and 75,000 without.</li>
        <li><strong>Elite and Legend are identical on every dungeon</strong> (confirmed in game).</li>
      </ul>

      <h3 className="section-head">
        4. Still unmeasured
      </h3>
      <ul className="gold-notes">
        <li><strong>Do the other two buffs (abnormal sense +5%, potion) multiply the same C?</strong> Run Temple Of Fate with abnormal sense off and the title on: a drop of exactly 2,600 confirms it.</li>
        <li><strong>Story gold for six dungeons:</strong> Checkmate, Queen Coronation, Temple Of Fate, Apocalyptic Descent, Duskfeather Lair, The Deep Dive.</li>
        <li><strong>Does C change with difficulty?</strong> No story-tier C has been measured anywhere.</li>
        <li><strong>Kraken's Spine disagrees on the elite/story ratio.</strong> Heart Of Taboos and Shackled Psyche are both exactly 1.25; Kraken's Spine is 1.23149. At 1.25 its story figure would be 59,072 rather than the stored 59,960, so it is worth re-running.</li>
        <li><strong>The stone drop rate is still the 0.40 placeholder.</strong> docs/stone-gold-tally.csv is the tally sheet.</li>
      </ul>
    </div>
  );
}
