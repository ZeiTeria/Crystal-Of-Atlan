// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import GoldScreen from './GoldScreen';

describe('GoldScreen', () => {
  afterEach(cleanup);

  it('renders the four section headings', () => {
    render(<GoldScreen />);
    expect(screen.getByText(/1\. The formula/i)).toBeDefined();
    expect(screen.getByText(/2\. Measured constants/i)).toBeDefined();
    expect(screen.getByText(/3\. How this was established/i)).toBeDefined();
    expect(screen.getByText(/4\. Still unmeasured/i)).toBeDefined();
  });

  it('renders a constants row for all nine dungeons', () => {
    render(<GoldScreen />);
    expect(screen.getByText('Temple Of Fate')).toBeDefined();
    expect(screen.getByText('Checkmate')).toBeDefined();
    expect(screen.getByText('Duskfeather Lair')).toBeDefined();
    expect(screen.getByText("Kraken's Spine")).toBeDefined();
    expect(screen.getByText('Apocalyptic Descent')).toBeDefined();
    expect(screen.getByText('Heart Of Taboos')).toBeDefined();
    expect(screen.getByText('Queen Coronation')).toBeDefined();
    expect(screen.getByText('The Deep Dive')).toBeDefined();
    expect(screen.getByText('Shackled Psyche')).toBeDefined();
  });

  it("shows 52,000 as Temple Of Fate's C and 8,000 as Queen Coronation's premium", () => {
    render(<GoldScreen />);
    // Read the cells out of their own row: asserting the numbers appear
    // somewhere on the page would pass even if they landed on the wrong dungeon.
    const cells = (name: string) =>
      screen
        .getAllByRole('row')
        .find((r) => r.textContent?.includes(name))!
        .querySelectorAll('td');

    expect(cells('Temple Of Fate')[3]?.textContent).toBe('52,000');
    expect(cells('Queen Coronation')[4]?.textContent).toBe('8,000');
  });

  it('marks The Deep Dive and Shackled Psyche as manual', () => {
    render(<GoldScreen />);
    
    const rows = screen.getAllByRole('row');
    const deepDiveRow = rows.find(r => r.textContent?.includes('The Deep Dive'));
    const shackledRow = rows.find(r => r.textContent?.includes('Shackled Psyche'));
    
    expect(deepDiveRow?.textContent).toContain('manual');
    expect(shackledRow?.textContent).toContain('manual');
  });

  it('records that no buff applies to a manual run', () => {
    render(<GoldScreen />);
    expect(screen.getByText(/No buff touches a manual run/i)).toBeDefined();
    expect(screen.getByText(/B_manual is a constant/i)).toBeDefined();
  });

  it('separates the potion from the two buffs that share C', () => {
    render(<GoldScreen />);
    expect(screen.getByText(/Abnormal sense multiplies the same C/i)).toBeDefined();
    expect(screen.getByText(/gold potion does not share that component/i)).toBeDefined();
  });

  it('states that elite and legend pay the same', () => {
    render(<GoldScreen />);
    const match1 = screen.queryByText(/Elite and Legend always pay exactly the same/i);
    const match2 = screen.queryByText(/Elite and Legend are identical on every dungeon/i);
    expect(match1 || match2).toBeTruthy();
  });
});
