// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OnboardingPopup from './OnboardingPopup';

afterEach(() => {
  cleanup();
});

describe('OnboardingPopup', () => {
  it('walks the three steps in the order the work happens', () => {
    render(<OnboardingPopup onClose={() => {}} />);

    const steps = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain('Add a character');
    expect(steps[1]).toContain('Plan');
    expect(steps[2]).toContain('dungeon data');
  });

  it('never points a new user at the Dungeons tab', () => {
    // The tab is admin-only, so for almost everyone who reads this popup it
    // does not exist. Sending them to it is sending them nowhere.
    const { container } = render(<OnboardingPopup onClose={() => {}} />);

    expect(container.textContent).not.toMatch(/Dungeons tab/i);
  });

  it('hands back to the caller so the add-character modal can open', () => {
    const onClose = vi.fn();
    render(<OnboardingPopup onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
