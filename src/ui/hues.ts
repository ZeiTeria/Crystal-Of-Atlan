/**
 * The colour a character is drawn in. Its class picks it, so the same class is
 * the same colour everywhere; a character with no class yet falls back to a
 * hash of its name, which is stable but arbitrary.
 */
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
