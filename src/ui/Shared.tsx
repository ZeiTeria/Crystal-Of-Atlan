import './Shared.css';

import coaLogo from '../assets/images/Crystal Of Atlan Logo.avif';

export function LogoMark() {
  return (
    <img src={coaLogo} alt="Crystal of Atlan Logo" style={{ height: '32px', objectFit: 'contain' }} />
  );
}

export function Portrait({ name, hue, size = 34, dim = false }: { name: string, hue?: string | null, size?: number, dim?: boolean }) {
  const h = hue || '#6B7280';
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  
  // Calculate rgba for background and border
  // Note: we can use a trick with CSS variables or inline styles
  
  return (
    <div 
      className={`portrait ${dim ? 'dim' : ''}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `${h}1a`, // 10% alpha
        borderColor: `${h}66`,     // 40% alpha
        color: h,
        fontSize: Math.floor(size * 0.42)
      }}
    >
      {initial}
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
