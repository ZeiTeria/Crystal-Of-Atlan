import { findClass } from '../data/classes';
import './Shared.css';

import coaLogo from '../assets/images/Crystal Of Atlan Logo.avif';

export function LogoMark() {
  return (
    <img src={coaLogo} alt="Crystal of Atlan Logo" style={{ height: '32px', objectFit: 'contain' }} />
  );
}

export function Portrait({
  name,
  hue,
  size = 34,
  dim = false,
  characterClass,
}: {
  name: string;
  hue?: string | null;
  size?: number;
  dim?: boolean;
  /** Shows the class's own mark instead of an initial, when it is known. */
  characterClass?: string | null;
}) {
  const h = hue || '#6B7280';
  const known = findClass(characterClass);
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div
      className={`portrait ${dim ? 'dim' : ''}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `${h}1a`, // 10% alpha
        borderColor: `${h}66`, // 40% alpha
        color: h,
        fontSize: Math.floor(size * 0.42),
      }}
    >
      {known ? (
        // The marks are white artwork, so they are masked rather than drawn -
        // that way each one takes its own class colour instead of punching a
        // white hexagon through a dark panel.
        <span
          className="portrait-mark"
          aria-hidden="true"
          style={{
            width: Math.round(size * 0.62),
            height: Math.round(size * 0.62),
            backgroundColor: h,
            maskImage: `url(${known.icon})`,
            WebkitMaskImage: `url(${known.icon})`,
          }}
        />
      ) : (
        initial
      )}
    </div>
  );
}

export function DiamondDot({ hue, size = 8 }: { hue: string, size?: number }) {
  return (
    <span 
      className="diamond-dot"
      style={{ width: size, height: size, backgroundColor: hue }}
    />
  );
}
