import sugariff from '../assets/classes/sugariff.png';
import karmaslayer from '../assets/classes/karmaslayer.png';
import inventor from '../assets/classes/inventor.png';
import empirica from '../assets/classes/empirica.png';
import rhapsodia from '../assets/classes/rhapsodia.png';
import glaciette from '../assets/classes/glaciette.png';
import assassin from '../assets/classes/assassin.png';
import phantom from '../assets/classes/phantom.png';
import mirage from '../assets/classes/mirage.png';
import mystrix from '../assets/classes/mystrix.png';
import fighter from '../assets/classes/fighter.png';
import cloudstrider from '../assets/classes/cloudstrider.png';
import starbreaker from '../assets/classes/starbreaker.png';
import magician from '../assets/classes/magician.png';
import scytheguard from '../assets/classes/scytheguard.png';
import puppeteer from '../assets/classes/puppeteer.png';
import gunner from '../assets/classes/gunner.png';
import bountyHunter from '../assets/classes/bounty-hunter.png';
import berserker from '../assets/classes/berserker.png';
import elementalist from '../assets/classes/elementalist.png';
import musketeer from '../assets/classes/musketeer.png';
import magiblade from '../assets/classes/magiblade.png';
import swordsman from '../assets/classes/swordsman.png';
import blademaiden from '../assets/classes/blademaiden.png';
import magister from '../assets/classes/magister.png';
import warlock from '../assets/classes/warlock.png';

export interface CharacterClass {
  /** The official English name, as the game's own site writes it. */
  name: string;
  /** The colour that class is presented in. */
  hue: string;
  /** The hexagon class mark. */
  icon: string;
  /**
   * The base class this one advances from, or null when it IS a base class.
   *
   * The site presents all 26 as one flat carousel, which is why they arrived
   * that way; the game groups them into seven families, and that is the shape
   * a player picking one thinks in.
   */
  base: string | null;
}

/**
 * Every class in Crystal of Atlan, taken from the official site
 * (coa.nvsgames.com) rather than written from memory.
 *
 * Names come from the site's own translation bundle, so they are the strings
 * the game itself uses in English. The order is the order the site's class
 * carousel presents them in, newest first - which is why Sugariff, the class
 * added in the SNK collaboration patch, leads. Group them with CLASS_FAMILIES
 * rather than reading this order as meaningful to a player.
 *
 * Colours are sampled from each class's own key art on that carousel. Bounty
 * Hunter's art is genuinely desaturated - it has no colour to take - so it gets
 * a neutral rather than an invented one.
 *
 * The icons are the site's hexagon class marks, downloaded to
 * `src/assets/classes/`.
 *
 * ---
 *
 * ADDING A CLASS when the game ships one. This is a snapshot, not a feed -
 * nothing here reads the site at runtime, so a new class is invisible to this
 * app until someone does this by hand, and no test can tell you it is time:
 *
 *   1. Download its hexagon mark from the site's class carousel into
 *      `src/assets/classes/<name>.png`, and import it above.
 *   2. Add a row here with its official English name (take it from the site's
 *      own translation bundle, not from a wiki - and check it is the English
 *      one, several locales sit side by side in there), the colour sampled
 *      from its key art, and the base class it advances from.
 *   3. Bump the count in `classes.test.ts`, and add it to the family shape
 *      that test pins.
 *
 * Position in this array does not matter beyond cosmetics: it sets the order
 * of a family's advancements in the picker, nothing else. It used to matter -
 * the add form defaulted to the first entry, so whichever class the site
 * listed newest became every new character's class - which is why nothing
 * defaults to a class any more.
 */
export const CHARACTER_CLASSES: CharacterClass[] = [
  { name: 'Sugariff', hue: '#FE45E5', icon: sugariff, base: 'Fighter' },
  { name: 'Karmaslayer', hue: '#203AEF', icon: karmaslayer, base: 'Swordsman' },
  { name: 'Inventor', hue: '#E7DA19', icon: inventor, base: null },
  { name: 'Empirica', hue: '#D6FA28', icon: empirica, base: 'Inventor' },
  { name: 'Rhapsodia', hue: '#68E738', icon: rhapsodia, base: 'Inventor' },
  { name: 'Glaciette', hue: '#FA5886', icon: glaciette, base: 'Puppeteer' },
  { name: 'Assassin', hue: '#357896', icon: assassin, base: null },
  { name: 'Specter', hue: '#1744A6', icon: phantom, base: 'Assassin' },
  { name: 'Mirage', hue: '#FF9639', icon: mirage, base: 'Assassin' },
  { name: 'Mystrix', hue: '#7C55D0', icon: mystrix, base: 'Musketeer' },
  { name: 'Fighter', hue: '#FFD649', icon: fighter, base: null },
  { name: 'Cloudstrider', hue: '#9DDAF4', icon: cloudstrider, base: 'Fighter' },
  { name: 'Starbreaker', hue: '#DC1913', icon: starbreaker, base: 'Fighter' },
  { name: 'Magician', hue: '#FFF449', icon: magician, base: 'Magister' },
  { name: 'Scytheguard', hue: '#F23F55', icon: scytheguard, base: 'Puppeteer' },
  { name: 'Puppeteer', hue: '#FF6553', icon: puppeteer, base: null },
  { name: 'Gunner', hue: '#9B6BFE', icon: gunner, base: 'Musketeer' },
  { name: 'Bounty Hunter', hue: '#8B93A1', icon: bountyHunter, base: 'Musketeer' },
  { name: 'Berserker', hue: '#79B8FE', icon: berserker, base: 'Swordsman' },
  { name: 'Elementalist', hue: '#28DBAE', icon: elementalist, base: 'Magister' },
  { name: 'Musketeer', hue: '#65D2C4', icon: musketeer, base: null },
  { name: 'Magiblade', hue: '#5046DC', icon: magiblade, base: 'Swordsman' },
  { name: 'Swordsman', hue: '#5046DC', icon: swordsman, base: null },
  { name: 'Blademaiden', hue: '#5046DC', icon: blademaiden, base: 'Puppeteer' },
  { name: 'Magister', hue: '#DC41FF', icon: magister, base: null },
  { name: 'Warlock', hue: '#C724D6', icon: warlock, base: 'Magister' },
];

/**
 * The class the game shipped most recently.
 *
 * The site's carousel leads with it, which is why it is first here - but the
 * add form defaults to it because it is NEWEST, not because it is first. Said
 * out loud so the two cannot drift apart: reorder this array for some other
 * reason and the default has to be reconsidered, not silently reassigned.
 */
export const NEWEST_CLASS: CharacterClass | undefined = CHARACTER_CLASSES[0];

const byName = new Map(CHARACTER_CLASSES.map((c) => [c.name.toLowerCase(), c]));

/**
 * Older names that were stored before the list came from the official site, so
 * a character saved under one still finds its class rather than falling back to
 * a colour derived from its name.
 */
const ALIASES: Record<string, string> = {
  'puppet master': 'Puppeteer',
};

export function findClass(name: string | null | undefined): CharacterClass | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  return byName.get(key) ?? byName.get((ALIASES[key] ?? '').toLowerCase());
}

export interface ClassFamily {
  base: CharacterClass;
  /** What that base class can advance into. */
  advanced: CharacterClass[];
}

/**
 * The classes as the GAME groups them: seven base classes, each advancing into
 * two or three others.
 *
 * The official site does not present this - its carousel is one flat run of 26
 * - so both the grouping and this order come from the player, who plays it.
 * Swordsman leads because the game lists it first.
 */
export const CLASS_FAMILIES: ClassFamily[] = [
  'Swordsman',
  'Musketeer',
  'Magister',
  'Puppeteer',
  'Fighter',
  'Assassin',
  'Inventor',
].map((name) => {
  const base = byName.get(name.toLowerCase());
  if (!base) throw new Error(`Unknown base class ${name}`);
  return { base, advanced: CHARACTER_CLASSES.filter((c) => c.base === name) };
});
