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
}

/**
 * Every class in Crystal of Atlan, taken from the official site
 * (coa.nvsgames.com) rather than written from memory.
 *
 * Names come from the site's own translation bundle, so they are the strings
 * the game itself uses in English. The order is the order the site's class
 * carousel presents them in, newest first - which is why Sugariff, the class
 * added in the SNK collaboration patch, leads.
 *
 * Colours are sampled from each class's own key art on that carousel. Bounty
 * Hunter's art is genuinely desaturated - it has no colour to take - so it gets
 * a neutral rather than an invented one.
 *
 * The icons are the site's hexagon class marks, downloaded to
 * `src/assets/classes/`.
 */
export const CHARACTER_CLASSES: CharacterClass[] = [
  { name: 'Sugariff', hue: '#FE45E5', icon: sugariff },
  { name: 'Karmaslayer', hue: '#203AEF', icon: karmaslayer },
  { name: 'Inventor', hue: '#E7DA19', icon: inventor },
  { name: 'Empirica', hue: '#D6FA28', icon: empirica },
  { name: 'Rhapsodia', hue: '#68E738', icon: rhapsodia },
  { name: 'Glaciette', hue: '#FA5886', icon: glaciette },
  { name: 'Assassin', hue: '#357896', icon: assassin },
  { name: 'Phantom', hue: '#1744A6', icon: phantom },
  { name: 'Mirage', hue: '#FF9639', icon: mirage },
  { name: 'Mystrix', hue: '#7C55D0', icon: mystrix },
  { name: 'Fighter', hue: '#FFD649', icon: fighter },
  { name: 'Cloudstrider', hue: '#9DDAF4', icon: cloudstrider },
  { name: 'Starbreaker', hue: '#DC1913', icon: starbreaker },
  { name: 'Magician', hue: '#FFF449', icon: magician },
  { name: 'Scytheguard', hue: '#F23F55', icon: scytheguard },
  { name: 'Puppeteer', hue: '#FF6553', icon: puppeteer },
  { name: 'Gunner', hue: '#9B6BFE', icon: gunner },
  { name: 'Bounty Hunter', hue: '#8B93A1', icon: bountyHunter },
  { name: 'Berserker', hue: '#79B8FE', icon: berserker },
  { name: 'Elementalist', hue: '#28DBAE', icon: elementalist },
  { name: 'Musketeer', hue: '#65D2C4', icon: musketeer },
  { name: 'Magiblade', hue: '#5046DC', icon: magiblade },
  { name: 'Swordsman', hue: '#5046DC', icon: swordsman },
  { name: 'Blademaiden', hue: '#5046DC', icon: blademaiden },
  { name: 'Magister', hue: '#DC41FF', icon: magister },
  { name: 'Warlock', hue: '#C724D6', icon: warlock },
];

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
