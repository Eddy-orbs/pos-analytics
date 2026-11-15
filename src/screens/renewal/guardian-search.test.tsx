// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Router, Route } from 'react-router-dom';
import { createBrowserHistory } from 'history';
import { vi } from 'vitest';
import { RenewalGuardians } from './guardians';
vi.mock('pos-analytics-graph', () => ({ getGuardian: vi.fn(), getGuardianStakeView: vi.fn() }));
vi.mock('redux/actions/actions', () => ({ getOverviewAction: vi.fn(), getGuardiansAction: vi.fn() }));
vi.mock('screens/overview/network-selector', () => ({ NetworkSelector: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'en-US' } }) }));
const state = { main: { web3: {}, chain: 'ethereum' }, guardians: { guardians: [] }, overview: { overviewData: { slices: [] } } };
vi.mock('react-redux', () => ({ useSelector: (selector: any) => selector(state), useDispatch: () => vi.fn() }));
afterEach(cleanup);
const address = '0x7f0e5488a651C08F84Df8E4088303c94c58a728b';
function page(chain: string) {
    window.history.replaceState({}, '', `/${chain}/guardians`);
    const history = createBrowserHistory({ basename: `/${chain}` });
    const screen = render(<Router history={history}><Route exact path="/guardians"><RenewalGuardians /></Route></Router>);
    return { history, ...screen };
}
it.each(['ethereum', 'polygon'])('opens an unlisted address on the selected %s network', (chain) => {
    const screen = page(chain);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: `  ${address}  ` } });
    expect(screen.getByText('No matching Guardians')).toBeTruthy();
    fireEvent.submit(screen.getByRole('search'));
    expect(window.location.pathname).toBe(`/${chain}/guardians/stake/${address}`);
});
it.each(['Guardian name', address.slice(0, -1), `${address}g`])('keeps non-address input as a list filter: %s', (query) => {
    const screen = page('ethereum');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.history.location.pathname).toBe('/guardians');
});
