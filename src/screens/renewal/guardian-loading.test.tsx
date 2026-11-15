// @vitest-environment jsdom
import React from 'react';
import { render, wait, cleanup } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import { vi } from 'vitest';
import { getGuardian, getGuardianStakeView } from 'pos-analytics-graph';
import { RenewalGuardians } from './guardians';
vi.mock('pos-analytics-graph', () => ({ getGuardian: vi.fn(), getGuardianStakeView: vi.fn() }));
vi.mock('redux/actions/actions', () => ({ getOverviewAction: vi.fn(), getGuardiansAction: vi.fn() }));
vi.mock('screens/overview/network-selector', () => ({ NetworkSelector: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en-US' } }) }));
const state = { main: { web3: {}, chain: 'ethereum' }, guardians: { guardians: [] } };
vi.mock('react-redux', () => ({ useSelector: (selector: any) => selector(state), useDispatch: () => vi.fn() }));
beforeEach(() => {
    state.main.web3 = {};
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            disconnect() {}
        }
    );
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});
const address = '0x9520f53fd81c668e8088ae194c40e3f977b73d28';
function page() {
    return (
        <MemoryRouter initialEntries={[`/guardians/delegators/${address}`]}>
            <Route path="/guardians/:section/:address">
                <RenewalGuardians />
            </Route>
        </MemoryRouter>
    );
}
it('direct Delegators entry renders completed history without a null-data frame, including cached remount', async () => {
    vi.mocked(getGuardian).mockResolvedValue({
        details: { name: 'Guardian' },
        stake_status: { total_stake: 100 }
    } as any);
    let finish!: (value: any) => void;
    vi.mocked(getGuardianStakeView).mockImplementation(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            })
    );
    const first = render(page());
    await wait(() => expect(first.getByText('Loading delegators…')).toBeTruthy());
    finish({
        stake_slices: [],
        delegators: [{ address: '0x578f069393c3c18af8e440510e236006e66a73f1', stake: 50, non_stake: 1 }]
    });
    await wait(() => expect(first.container.querySelectorAll('.rd-wallet-row').length).toBe(1));
    first.unmount();
    const second = render(page());
    await wait(() => expect(second.container.querySelectorAll('.rd-wallet-row').length).toBe(1));
    expect(getGuardianStakeView).toHaveBeenCalledTimes(1);
});
