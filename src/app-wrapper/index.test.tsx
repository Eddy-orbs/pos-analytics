import React from 'react';
import { fireEvent, render, wait } from '@testing-library/react';

const mockDispatch = jest.fn();
const mockGetWeb3 = jest.fn();

jest.mock('react-redux', () => ({
    useDispatch: () => mockDispatch
}));

jest.mock('../utils/router', () => ({
    getRouterBaseName: () => 'ethereum'
}));

jest.mock('../config', () => ({
    chains: {
        ethereum: { getWeb3: () => mockGetWeb3() },
        polygon: { getWeb3: () => mockGetWeb3() }
    }
}));

jest.mock('../app', () => () => <div data-testid="ready-app">ready</div>);

import AppWrapper from './index';

describe('AppWrapper RPC initialization', () => {
    beforeEach(() => {
        mockDispatch.mockClear();
        mockGetWeb3.mockReset();
    });

    it('shows a retry action after initialization failure and recovers', async () => {
        mockGetWeb3.mockRejectedValueOnce(new Error('private provider URL must not be rendered'));
        const view = render(<AppWrapper />);

        await wait(() => expect(view.getByText('Retry')).toBeTruthy());
        expect(view.queryByText(/private provider URL/)).toBeNull();

        mockGetWeb3.mockResolvedValueOnce({ eth: {} });
        fireEvent.click(view.getByText('Retry'));

        await wait(() => expect(view.getByTestId('ready-app')).toBeTruthy());
        expect(mockGetWeb3).toHaveBeenCalledTimes(2);
        expect(mockDispatch).toHaveBeenCalledTimes(1);
    });
});
