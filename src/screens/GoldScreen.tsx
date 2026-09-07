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

type BuffReading = {
  buffs: string;
  sum: string;
  observed: number;
  base: number;
  /** What B + C x (buff %) predicts for that base. C = 50,000, B = 79,500. */
  predicted: number;
};

const BUFF_READINGS: BuffReading[] = [
  { buffs: 'none (with stone)', sum: '0%', observed: 84500, base: 79500, predicted: 79500 },
  { buffs: 'title', sum: '2%', observed: 80500, base: 80500, predicted: 80500 },
  { buffs: 'abnormal sense', sum: '5%', observed: 82000, base: 82000, predicted: 82000 },
  { buffs: 'potion', sum: '10%', observed: 84500, base: 84500, predicted: 84500 },
  { buffs: 'title + potion (with stone)', sum: '12%', observed: 90500, base: 85500, predicted: 85500 },
  { buffs: 'title + potion (earlier reading)', sum: '12%', observed: 92138, base: 87138, predicted: 85500 },
  { buffs: 'title + AS + potion (earlier reading)', sum: '17%', observed: 89650, base: 89650, predicted: 88000 },
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
        <li>No buff of any kind applies to a manual run, so B_manual is a constant.</li>
        <li>All three buffs are plain percentages of C. Measured one at a time on Duskfeather Lair the title added exactly 1,000, abnormal sense exactly 2,500 and the potion exactly 5,000 - 2%, 5% and 10% of C = 50,000. Verified for one buff at a time; two readings with several buffs at once do not fit and are listed below.</li>
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
        Buff readings - Duskfeather Lair elite, auto
      </h3>
      <div className="gold-table-container">
        <table className="gold-table">
          <thead>
            <tr>
              <th>Buffs active</th>
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
        Base is the observed figure less the 5,000 stone premium where a stone dropped. Every row
        matches what C predicts except the last two, which were the first readings taken with
        several buffs at once. Title plus potion was later measured again in exactly the same
        configuration and came in at 90,500, matching the model to the gold - so the 92,138 above
        is a bad reading rather than evidence of a stacking bonus, and the 89,650 beside it is
        almost certainly the same. Both are kept here rather than deleted, because they are what
        a contaminated reading looks like.
      </p>

      <h3 className="section-head">
        3. How this was established
      </h3>
      <ul className="gold-notes">
        <li><strong>The stone premium is flat and unbuffed</strong> - Temple Of Fate showed a 4,000 gap with the title on (105,720 vs 101,720) and the same 4,000 with it off (104,680 vs 100,680).</li>
        <li><strong>The title is 2% of C, not 2% of the reward</strong> - the title-off drops are not proportional to the bases (drops in a ratio of 2.08 where the bases are 1.93). Solving drop / 0.02 gives a C that lands on a multiple of 500 for all seven auto dungeons.</li>
        <li><strong>No buff touches a manual run</strong> - Duskfeather Lair paid 80,000 with the title, 80,000 without it, and 80,000 again with all three buffs active, every time with a stone.</li>
        <li><strong>Every buff is a percentage of the same C</strong> - measured one at a time, the title added 1,000, abnormal sense 2,500 and the potion 5,000 on Duskfeather Lair, and the potion added 2,000 on Queen Coronation. Four readings, four exact hits against C = 50,000 and C = 20,000.</li>
        <li><strong>Queen Coronation's C is confirmed twice over</strong> - it was derived from the title (400 being 2% of 20,000) and the potion independently agrees (2,000 being 10%).</li>
        <li><strong>Buffs stack by adding their percentages</strong> - title and potion together behave as a flat 12%, giving 85,500 on Duskfeather Lair exactly as 2% + 10% predicts.</li>
        <li><strong>The stone premium survives buffs</strong> - that same run paid 90,500 with a stone against 85,500 without, the same 5,000 as an unbuffed run.</li>
        <li><strong>Auto pays more than manual</strong> - Duskfeather Lair, title on: 80,500 auto against 75,000 manual.</li>
        <li><strong>The premium applies in manual too</strong> - Duskfeather Lair manual, 80,000 with a stone and 75,000 without.</li>
        <li><strong>Elite and Legend are identical on every dungeon</strong> (confirmed in game).</li>
      </ul>

      <h3 className="section-head">
        4. Still unmeasured
      </h3>
      <ul className="gold-notes">
        <li><strong>All three buffs at once has never been read cleanly.</strong> The only reading, 89,650, sits 1,650 above prediction - the same signature as the title-plus-potion reading since proven bad. Run Duskfeather Lair elite with all three: the model says 88,000 without a stone and 93,000 with one. That is the last combination left to check.</li>
        <li><strong>What went wrong in those two early readings?</strong> Not urgent - the model is confirmed without them - but the same configuration measured twice gave 90,500 and 92,138, so something varied between the runs. A different character is the obvious suspect, since buffs are per-character and a different title would carry a different percentage.</li>
        <li><strong>Story gold for six dungeons:</strong> Checkmate, Queen Coronation, Temple Of Fate, Apocalyptic Descent, Duskfeather Lair, The Deep Dive.</li>
        <li><strong>Does C change with difficulty?</strong> No story-tier C has been measured anywhere.</li>
        <li><strong>Kraken's Spine disagrees on the elite/story ratio.</strong> Heart Of Taboos and Shackled Psyche are both exactly 1.25; Kraken's Spine is 1.23149. At 1.25 its story figure would be 59,072 rather than the stored 59,960, so it is worth re-running.</li>
        <li><strong>The stone drop rate is still the 0.40 placeholder.</strong> docs/stone-gold-tally.csv is the tally sheet.</li>
      </ul>
    </div>
  );
}
