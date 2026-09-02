import './Shared.css';

import coaLogo from '../assets/images/Crystal Of Atlan Logo.avif';

// We'll map classes to hues. Right now we just return a default if it's not mapped yet.
// The user will provide the colors later.
export function getClassHue(className: string | null | undefined, fallbackName?: string): string {
  switch (className?.toLowerCase()) {
    case 'magister': return '#4A6EF5'; // blue
    case 'puppet master': return '#A06EF5'; // purple
    case 'swordsman': return '#F26B6B'; // red
    case 'musketeer': return '#4BA3C3'; // light blue
    case 'alchemist': return '#4ADE80'; // green
    case 'fighter': return '#F0B23C'; // yellow/orange
    default: {
      if (!fallbackName) return '#6B7280';
      const colors = ['#4A6EF5', '#A06EF5', '#F26B6B', '#4BA3C3', '#4ADE80', '#F0B23C'];
      let hash = 0;
      for (let i = 0; i < fallbackName.length; i++) hash = fallbackName.charCodeAt(i) + ((hash << 5) - hash);
      return colors[Math.abs(hash) % colors.length] ?? '#6B7280';
    }
  }
}

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


export function getGroupHue(groupName: string | null | undefined): string {
  if (!groupName) return '#6B7280';
  const name = groupName.toLowerCase();
  if (name === 'abyss') return 'var(--group-abyss, #4A6EF5)';
  if (name === 'raid') return 'var(--group-raid, #A06EF5)';
  if (name === 'trial') return 'var(--group-trial, #4BA3C3)';
  
  const colors = ['#4A6EF5', '#A06EF5', '#F26B6B', '#4BA3C3', '#4ADE80', '#F0B23C', '#E8A236'];
  let hash = 0;
  for (let i = 0; i < groupName.length; i++) hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length] ?? '#6B7280';
}
