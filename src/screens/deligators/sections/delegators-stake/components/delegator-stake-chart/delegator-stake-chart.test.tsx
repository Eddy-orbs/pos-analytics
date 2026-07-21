import React from 'react';
import { fireEvent, render } from '@testing-library/react';
import { useDispatch, useSelector } from 'react-redux';
import { ChartUnit } from 'global/enums';
import { DelegatorStakeChart } from './delegator-stake-chart';

const mockDispatch = jest.fn();
const mockLoadDelegatorHistory = jest.fn(() => ({ type: 'TEST_HISTORY_LOAD' }));

jest.mock('react-redux', () => ({
    useDispatch: jest.fn(),
    useSelector: jest.fn()
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'ko' }
    })
}));

jest.mock('redux/actions/actions', () => ({
    loadDelegatorHistory: (...args: any[]) => mockLoadDelegatorHistory(...args)
}));

jest.mock('components/date-format-picker/time-range-selector', () => ({
    TimeRangeSelector: () => <div data-testid="range-selector" />
}));

jest.mock('components/loaders/big-loader', () => ({
    BigLoader: () => <div data-testid="loader" />
}));

jest.mock('components/no-data/no-data', () => ({
    NoData: () => <div data-testid="no-data" />
}));

jest.mock('./chart', () => ({
    Chart: () => <div data-testid="chart" />
}));

describe('DelegatorStakeChart history failure', () => {
    it('hides the internal error and renders localized retry guidance', () => {
        const address = '0x2fe6bd8637f39ef7ccb6abe4f999691eaf829864';
        const detailKey = `ethereum:${address}`;
        const state = {
            delegator: {
                delegatorCurrent: {
                    address,
                    block_time: 1784604167
                },
                delegatorIsLoading: false,
                activeDelegatorKey: detailKey,
                activeDelegatorHistoryUnit: ChartUnit.MONTH,
                historyByKey: {
                    [detailKey]: {
                        status: 'error',
                        error: 'Unable to load Delegator stake history'
                    }
                }
            },
            main: { web3: {} }
        };
        (useDispatch as jest.Mock).mockReturnValue(mockDispatch);
        (useSelector as jest.Mock).mockImplementation((selector) => selector(state));

        const view = render(<DelegatorStakeChart />);

        expect(view.getByText('델리게이터 스테이킹 내역을 불러올 수 없습니다. 다시 시도해 주세요.')).toBeTruthy();
        expect(view.getByText('다시 시도')).toBeTruthy();
        expect(view.queryByText('Unable to load Delegator stake history')).toBeNull();
        expect(view.queryByText('main.retry')).toBeNull();

        fireEvent.click(view.getByText('다시 시도'));
        expect(mockLoadDelegatorHistory).toHaveBeenCalledWith(address, state.main.web3, ChartUnit.MONTH);
    });
});
