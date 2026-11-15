// @vitest-environment jsdom
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import { StakeChart } from './shared';
vi.mock('screens/overview/network-selector', () => ({ NetworkSelector: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en-US' } }) }));
afterEach(cleanup);
const points = [
    { time: 1762300800, value: 1234.56789, secondary: 200 },
    { time: 1762387200, value: 1300, secondary: 250 }
];
it('shows localized date and both values on hover, then dismisses on leave', () => {
    const { container, getByRole, queryByRole } = render(<StakeChart points={points} days={30} onDays={() => {}} />);
    const point = container.querySelector('.rn-chart-hit')!;
    fireEvent.mouseEnter(point);
    expect(getByRole('tooltip').textContent).toContain('1,235 ORBS');
    expect(getByRole('tooltip').textContent).toContain('Self-stake: 200 ORBS');
    expect(getByRole('tooltip').textContent).toContain('2025');
    fireEvent.mouseLeave(point);
    expect(queryByRole('tooltip')).toBeNull();
});
it('pins on touch/click, toggles off, supports keyboard, and clears on period change', () => {
    const { container, getByRole, queryByRole, rerender } = render(
        <StakeChart points={points} days={30} onDays={() => {}} />
    );
    const point = container.querySelector('.rn-chart-hit')!;
    fireEvent.click(point);
    fireEvent.mouseLeave(point);
    expect(getByRole('tooltip')).toBeTruthy();
    fireEvent.click(point);
    expect(queryByRole('tooltip')).toBeNull();
    fireEvent.keyDown(point, { key: 'Enter' });
    expect(getByRole('tooltip')).toBeTruthy();
    fireEvent.keyDown(point, { key: 'Escape' });
    expect(queryByRole('tooltip')).toBeNull();
    fireEvent.click(point);
    rerender(<StakeChart points={points} days={60} onDays={() => {}} />);
    expect(queryByRole('tooltip')).toBeNull();
});
it('uses an independent count scale and includes delegators in point tooltips', () => {
    const { container, getByRole } = render(
        <StakeChart points={points.map((p, i) => ({ ...p, delegates: i ? 12 : 9 }))} days={30} onDays={() => {}} />
    );
    expect(container.querySelector('.rd-count-line')).toBeTruthy();
    const ticks = Array.from(container.querySelectorAll('svg text.rd-count-label')).map((e) => e.textContent);
    expect(ticks).toEqual(['0', '4', '8', '12']);
    fireEvent.click(container.querySelector('.rn-chart-hit')!);
    expect(getByRole('tooltip').textContent).toContain('Delegator count: 9');
    expect(getByRole('tooltip').textContent).toContain('1,235 ORBS');
});
