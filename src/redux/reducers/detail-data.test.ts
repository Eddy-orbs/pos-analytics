import {
    DelegatorCurrent,
    GuardianCurrent,
    GuardianStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { ChartUnit } from '../../global/enums';
import { api } from '../../services/api';
import { CHAINS } from '../../types';
import {
    cancelGuardianHistoryRequest,
    getGuardianAction,
    loadGuardianHistory
} from '../actions/guardians-actions';
import {
    cancelDelegatorHistoryRequest,
    findDelegatorAction,
    loadDelegatorHistory
} from '../actions/delegator-actions';
import {
    DETAIL_CURRENT_CACHE_TTL_MS,
    DETAIL_HISTORY_CACHE_TTL_MS,
    getDetailHistorySampleTimestamps,
    getDetailHistoryStartTime
} from '../actions/detail-history';
import { types } from '../types/types';
import { guardiansReducer } from './guardians';
import { delegatorReducer } from './delegator';

const address = '0xabc';
const detailKey = `${CHAINS.ETHEREUM}:${address}`;
const current = ({
    address,
    block_number: 200,
    block_time: Date.UTC(2026, 6, 15, 12) / 1000,
    details: {},
    stake_status: {
        self_stake: 10,
        cooldown_stake: 0,
        current_cooldown_time: 0,
        non_stake: 0,
        delegated_stake: 20,
        total_stake: 30
    },
    reward_status: {}
} as unknown) as GuardianCurrent;

const delegatorCurrent: DelegatorCurrent = {
    address,
    block_number: 200,
    block_time: current.block_time,
    total_stake: 10,
    cooldown_stake: 0,
    current_cooldown_time: 0,
    non_stake: 0,
    delegated_to: '0xguardian'
};

const history = (unit: ChartUnit.WEEK | ChartUnit.MONTH): GuardianStakeHistory => ({
    address,
    range: { from_block: unit === ChartUnit.WEEK ? 100 : 50, to_block: 200 },
    stake_slices: [{
        block_number: 200,
        block_time: current.block_time,
        self_stake: 10,
        delegated_stake: 20,
        total_stake: 30,
        n_delegates: 0
    }],
    data_quality: {
        exact: false,
        stake_values_exact: true,
        anchor_exact: true,
        anchor_source: 'prior-event',
        n_delegates_available: false
    }
});

describe('detail data reducers and loaders', () => {
    it('loads Delegator current state without starting a history query', async () => {
        let state = delegatorReducer(undefined, { type: '@@init' });
        const appState = () => ({
            main: { chain: CHAINS.ETHEREUM, web3: {} },
            delegator: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = delegatorReducer(state, action);
            return action;
        };
        const originalCurrent = api.getDelegatorCurrentApi;
        const originalResolve = api.resolveHistoryStartBlockApi;
        let currentCalls = 0;
        let resolveCalls = 0;
        api.getDelegatorCurrentApi = async () => {
            currentCalls += 1;
            return ({
                address,
                block_number: 200,
                block_time: current.block_time,
                total_stake: 10,
                cooldown_stake: 0,
                current_cooldown_time: 0,
                non_stake: 0,
                delegated_to: '0xguardian'
            } as DelegatorCurrent);
        };
        api.resolveHistoryStartBlockApi = async () => {
            resolveCalls += 1;
            return 100;
        };

        try {
            await dispatch(findDelegatorAction(address, {}));
            expect(currentCalls).toBe(1);
            expect(resolveCalls).toBe(0);
            expect(state.delegatorCurrent && state.delegatorCurrent.address).toBe(address);
        } finally {
            api.getDelegatorCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
        }
    });

    it('ignores stale requestIds and never replaces a newly selected address', () => {
        let state = guardiansReducer(undefined, { type: '@@init' });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key: detailKey }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_CURRENT_REQUEST,
            payload: { key: detailKey, address, chain: CHAINS.ETHEREUM, requestId: 'new' }
        });

        const staleState = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_CURRENT_SUCCESS,
            payload: { key: detailKey, requestId: 'old', data: current }
        });
        expect(staleState).toBe(state);

        const otherKey = `${CHAINS.ETHEREUM}:0xdef`;
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key: otherKey }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_CURRENT_SUCCESS,
            payload: { key: detailKey, requestId: 'new', data: current }
        });
        expect(state.activeGuardianKey).toBe(otherKey);
        expect(state.selectedGuardian).toBeUndefined();
        expect(state.currentByKey[detailKey].data).toBe(current);
    });

    it('keeps stale-unit history out of the active compatibility detail', () => {
        let state = guardiansReducer(undefined, { type: '@@init' });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key: detailKey }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_CURRENT_REQUEST,
            payload: { key: detailKey, address, chain: CHAINS.ETHEREUM, requestId: 'current' }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_CURRENT_SUCCESS,
            payload: { key: detailKey, requestId: 'current', data: current }
        });

        const weekKey = `${detailKey}:${ChartUnit.WEEK}`;
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_REQUEST,
            payload: {
                key: weekKey,
                detailKey,
                address,
                chain: CHAINS.ETHEREUM,
                unit: ChartUnit.WEEK,
                requestId: 'week'
            }
        });
        const monthKey = `${detailKey}:${ChartUnit.MONTH}`;
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_HISTORY,
            payload: { key: monthKey, detailKey, unit: ChartUnit.MONTH }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_REQUEST,
            payload: {
                key: monthKey,
                detailKey,
                address,
                chain: CHAINS.ETHEREUM,
                unit: ChartUnit.MONTH,
                requestId: 'month'
            }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_SUCCESS,
            payload: { key: weekKey, detailKey, unit: ChartUnit.WEEK, requestId: 'week', data: history(ChartUnit.WEEK) }
        });
        expect(state.selectedGuardian && state.selectedGuardian.stake_slices).toEqual([]);
        expect(state.historyByKey[weekKey].status).toBe('loaded');

        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_SUCCESS,
            payload: { key: monthKey, detailKey, unit: ChartUnit.MONTH, requestId: 'month', data: history(ChartUnit.MONTH) }
        });
        expect(state.selectedGuardian && state.selectedGuardian.stake_slices).toHaveLength(1);
        expect(state.activeGuardianHistoryUnit).toBe(ChartUnit.MONTH);
    });

    it('keeps current-only loading separate and caches each requested history unit', async () => {
        let state = guardiansReducer(undefined, { type: '@@init' });
        const appState = () => ({
            main: { chain: CHAINS.ETHEREUM, web3: {} },
            guardians: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = guardiansReducer(state, action);
            return action;
        };

        const originalCurrent = api.getGuardianCurrentApi;
        const originalResolve = api.resolveHistoryStartBlockApi;
        const originalHistory = api.getGuardianStakeHistoryApi;
        let currentCalls = 0;
        let resolveCalls = 0;
        let historyCalls = 0;
        let latestSampleTimestamps: number[] | undefined;
        let latestCurrentSnapshot: GuardianCurrent | undefined;
        api.getGuardianCurrentApi = async () => {
            currentCalls += 1;
            return current;
        };
        api.resolveHistoryStartBlockApi = async () => {
            resolveCalls += 1;
            return 100;
        };
        api.getGuardianStakeHistoryApi = async (
            _address,
            _web3,
            fromBlock,
            _signal,
            sampleTimestamps,
            currentSnapshot
        ) => {
            historyCalls += 1;
            latestSampleTimestamps = sampleTimestamps;
            latestCurrentSnapshot = currentSnapshot;
            return history(fromBlock === 100 ? ChartUnit.WEEK : ChartUnit.MONTH);
        };

        try {
            await dispatch(getGuardianAction(address, {}));
            await dispatch(getGuardianAction(address, {}));
            expect({ currentCalls, resolveCalls, historyCalls }).toEqual({
                currentCalls: 1,
                resolveCalls: 0,
                historyCalls: 0
            });
            expect(latestSampleTimestamps).toBeUndefined();
            expect(latestCurrentSnapshot).toBeUndefined();

            await dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            expect({ currentCalls, resolveCalls, historyCalls }).toEqual({
                currentCalls: 1,
                resolveCalls: 1,
                historyCalls: 1
            });
            expect(latestSampleTimestamps).toHaveLength(11);
            expect(latestCurrentSnapshot).toBe(current);

            // Change the mock boundary so the unit is observable, then verify
            // the month cache separately from the week cache.
            api.resolveHistoryStartBlockApi = async () => {
                resolveCalls += 1;
                return 50;
            };
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            expect({ currentCalls, resolveCalls, historyCalls }).toEqual({
                currentCalls: 1,
                resolveCalls: 2,
                historyCalls: 2
            });
            expect(latestSampleTimestamps).toHaveLength(13);
        } finally {
            api.getGuardianCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryApi = originalHistory;
        }
    });

    it('refreshes current and history entries after their TTL expires', async () => {
        const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
        let state = guardiansReducer(undefined, { type: '@@init' });
        const appState = () => ({
            main: { chain: CHAINS.ETHEREUM, web3: {} },
            guardians: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = guardiansReducer(state, action);
            return action;
        };
        const originalCurrent = api.getGuardianCurrentApi;
        const originalResolve = api.resolveHistoryStartBlockApi;
        const originalHistory = api.getGuardianStakeHistoryApi;
        let currentCalls = 0;
        let historyCalls = 0;
        api.getGuardianCurrentApi = async () => {
            currentCalls += 1;
            return current;
        };
        api.resolveHistoryStartBlockApi = async () => 100;
        api.getGuardianStakeHistoryApi = async () => {
            historyCalls += 1;
            return history(ChartUnit.WEEK);
        };

        try {
            await dispatch(getGuardianAction(address, {}));
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            now.mockReturnValue(1_000_000 + DETAIL_CURRENT_CACHE_TTL_MS - 1);
            await dispatch(getGuardianAction(address, {}));
            expect(currentCalls).toBe(1);
            now.mockReturnValue(1_000_000 + DETAIL_CURRENT_CACHE_TTL_MS);
            await dispatch(getGuardianAction(address, {}));
            expect(currentCalls).toBe(2);

            now.mockReturnValue(1_000_000 + DETAIL_HISTORY_CACHE_TTL_MS - 1);
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            expect(historyCalls).toBe(1);
            now.mockReturnValue(1_000_000 + DETAIL_HISTORY_CACHE_TTL_MS);
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            expect(historyCalls).toBe(2);
        } finally {
            now.mockRestore();
            api.getGuardianCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryApi = originalHistory;
        }
    });

    it('refreshes an expired current snapshot before loading a new history unit', async () => {
        const now = jest.spyOn(Date, 'now').mockReturnValue(2_000_000);
        let state = guardiansReducer(undefined, { type: '@@init' });
        const appState = () => ({
            main: { chain: CHAINS.ETHEREUM, web3: {} },
            guardians: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = guardiansReducer(state, action);
            return action;
        };
        const originalCurrent = api.getGuardianCurrentApi;
        const originalResolve = api.resolveHistoryStartBlockApi;
        const originalHistory = api.getGuardianStakeHistoryApi;
        let currentCalls = 0;
        let receivedSnapshot: GuardianCurrent | undefined;
        api.getGuardianCurrentApi = async () => {
            currentCalls += 1;
            return { ...current, block_time: current.block_time + currentCalls };
        };
        api.resolveHistoryStartBlockApi = async () => 50;
        api.getGuardianStakeHistoryApi = async (
            _address,
            _web3,
            _fromBlock,
            _signal,
            _sampleTimestamps,
            currentSnapshot
        ) => {
            receivedSnapshot = currentSnapshot;
            return history(ChartUnit.MONTH);
        };

        try {
            await dispatch(getGuardianAction(address, {}));
            expect(currentCalls).toBe(1);
            now.mockReturnValue(2_000_000 + DETAIL_CURRENT_CACHE_TTL_MS);

            await dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            expect(currentCalls).toBe(2);
            expect(receivedSnapshot && receivedSnapshot.block_time).toBe(current.block_time + 2);
            expect(state.guardianCurrent && state.guardianCurrent.block_time).toBe(current.block_time + 2);
        } finally {
            now.mockRestore();
            api.getGuardianCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryApi = originalHistory;
        }
    });

    it('treats current RPC failures as retryable load errors, not not-found', async () => {
        let state = guardiansReducer(undefined, { type: '@@init' });
        const appState = () => ({
            main: { chain: CHAINS.ETHEREUM, web3: {} },
            guardians: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = guardiansReducer(state, action);
            return action;
        };
        const original = api.getGuardianCurrentApi;
        api.getGuardianCurrentApi = async () => {
            throw new Error('429 rate limit');
        };

        try {
            await dispatch(getGuardianAction(address, {}));
            expect(state.guardianIsLoading).toBe(false);
            expect(state.guardianNotFound).toBe(false);
            expect(state.guardianCurrentError).toContain('RPC rate limit');
            expect(state.currentByKey[detailKey]).toMatchObject({
                status: 'error',
                notFound: false
            });
        } finally {
            api.getGuardianCurrentApi = original;
        }
    });

    it('leaves a failed history request in an error state instead of loading forever', () => {
        const key = `${detailKey}:${ChartUnit.WEEK}`;
        let state = guardiansReducer(undefined, { type: '@@init' });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key: detailKey }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_REQUEST,
            payload: {
                key,
                detailKey,
                address,
                chain: CHAINS.ETHEREUM,
                unit: ChartUnit.WEEK,
                requestId: 'history'
            }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_FAILURE,
            payload: {
                key,
                detailKey,
                unit: ChartUnit.WEEK,
                requestId: 'history',
                error: 'history failed'
            }
        });
        expect(state.guardianHistoryIsLoading).toBe(false);
        expect(state.guardianHistoryError).toBe('history failed');
        expect(state.historyByKey[key].status).toBe('error');
    });

    it('aborts an in-flight history RPC when the requested unit changes', async () => {
        let state = guardiansReducer(undefined, { type: '@@init' });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key: detailKey }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_CURRENT_REQUEST,
            payload: { key: detailKey, address, chain: CHAINS.ETHEREUM, requestId: 'current' }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_CURRENT_SUCCESS,
            payload: { key: detailKey, requestId: 'current', data: current }
        });
        const appState = () => ({
            main: { chain: CHAINS.ETHEREUM, web3: {} },
            guardians: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = guardiansReducer(state, action);
            return action;
        };

        const originalResolve = api.resolveHistoryStartBlockApi;
        const originalHistory = api.getGuardianStakeHistoryApi;
        let firstSignal: AbortSignal | undefined;
        let resolveCalls = 0;
        api.resolveHistoryStartBlockApi = async (_web3, _fromTime, signal) => {
            resolveCalls += 1;
            if (resolveCalls > 1) return 50;
            firstSignal = signal;
            return new Promise<number | undefined>((resolve) => {
                if (!signal) return resolve(undefined);
                signal.addEventListener('abort', () => resolve(undefined));
            });
        };
        api.getGuardianStakeHistoryApi = async () => history(ChartUnit.MONTH);

        try {
            const weekPromise = dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            await Promise.resolve();
            const monthPromise = dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            await monthPromise;
            await weekPromise;

            expect(firstSignal && firstSignal.aborted).toBe(true);
            expect(state.historyByKey[`${detailKey}:${ChartUnit.WEEK}`].status).toBe('idle');
            expect(state.historyByKey[`${detailKey}:${ChartUnit.MONTH}`].status).toBe('loaded');
        } finally {
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryApi = originalHistory;
        }
    });

    it('shares a stale-current refresh while switching history units', async () => {
        const now = jest.spyOn(Date, 'now').mockReturnValue(3_000_000);
        let state = guardiansReducer(undefined, { type: '@@init' });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key: detailKey }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_CURRENT_REQUEST,
            payload: { key: detailKey, address, chain: CHAINS.ETHEREUM, requestId: 'current' }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_CURRENT_SUCCESS,
            payload: { key: detailKey, requestId: 'current', data: current }
        });
        now.mockReturnValue(3_000_000 + DETAIL_CURRENT_CACHE_TTL_MS);
        const appState = () => ({
            main: { chain: CHAINS.ETHEREUM, web3: {} },
            guardians: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = guardiansReducer(state, action);
            return action;
        };
        const originalCurrent = api.getGuardianCurrentApi;
        const originalResolve = api.resolveHistoryStartBlockApi;
        const originalHistory = api.getGuardianStakeHistoryApi;
        let currentCalls = 0;
        let historyCalls = 0;
        let finishCurrent: ((value: GuardianCurrent) => void) | undefined;
        api.getGuardianCurrentApi = async () => {
            currentCalls += 1;
            return new Promise<GuardianCurrent>((resolve) => {
                finishCurrent = resolve;
            });
        };
        api.resolveHistoryStartBlockApi = async () => 50;
        api.getGuardianStakeHistoryApi = async () => {
            historyCalls += 1;
            return history(ChartUnit.MONTH);
        };

        try {
            const weekPromise = dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            await Promise.resolve();
            const monthPromise = dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            if (finishCurrent) finishCurrent({ ...current, block_time: current.block_time + 100 });
            await monthPromise;
            await weekPromise;

            expect(currentCalls).toBe(1);
            expect(historyCalls).toBe(1);
            expect(state.historyByKey[`${detailKey}:${ChartUnit.WEEK}`].status).toBe('idle');
            expect(state.historyByKey[`${detailKey}:${ChartUnit.MONTH}`].status).toBe('loaded');
            expect(state.guardianCurrent && state.guardianCurrent.block_time).toBe(current.block_time + 100);
        } finally {
            now.mockRestore();
            api.getGuardianCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryApi = originalHistory;
        }
    });

    it('moves an aborted Guardian history request out of loading immediately', async () => {
        let state = guardiansReducer(undefined, { type: '@@init' });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key: detailKey }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_CURRENT_REQUEST,
            payload: { key: detailKey, address, chain: CHAINS.ETHEREUM, requestId: 'current' }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_CURRENT_SUCCESS,
            payload: { key: detailKey, requestId: 'current', data: current }
        });
        const appState = () => ({
            main: { chain: CHAINS.ETHEREUM, web3: {} },
            guardians: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = guardiansReducer(state, action);
            return action;
        };
        const originalResolve = api.resolveHistoryStartBlockApi;
        let signal: AbortSignal | undefined;
        let finish: ((value: number | undefined) => void) | undefined;
        api.resolveHistoryStartBlockApi = async (_web3, _fromTime, requestSignal) => {
            signal = requestSignal;
            return new Promise<number | undefined>((resolve) => {
                finish = resolve;
            });
        };

        try {
            const pending = dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            await Promise.resolve();
            const key = `${detailKey}:${ChartUnit.WEEK}`;
            expect(state.historyByKey[key].status).toBe('loading');

            await dispatch(cancelGuardianHistoryRequest());
            expect(signal && signal.aborted).toBe(true);
            expect(state.historyByKey[key].status).toBe('idle');
            expect(state.historyByKey[key].requestId).toBeUndefined();

            if (finish) finish(undefined);
            await pending;
            expect(state.historyByKey[key].status).toBe('idle');
        } finally {
            api.resolveHistoryStartBlockApi = originalResolve;
        }
    });

    it('moves an aborted Delegator history request out of loading immediately', async () => {
        let state = delegatorReducer(undefined, { type: '@@init' });
        state = delegatorReducer(state, {
            type: types.DELEGATOR.SELECT_DELEGATOR_DETAIL,
            payload: { key: detailKey }
        });
        state = delegatorReducer(state, {
            type: types.DELEGATOR.DELEGATOR_CURRENT_REQUEST,
            payload: { key: detailKey, address, chain: CHAINS.ETHEREUM, requestId: 'current' }
        });
        state = delegatorReducer(state, {
            type: types.DELEGATOR.DELEGATOR_CURRENT_SUCCESS,
            payload: { key: detailKey, requestId: 'current', data: delegatorCurrent }
        });
        const appState = () => ({
            main: { chain: CHAINS.ETHEREUM, web3: {} },
            delegator: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = delegatorReducer(state, action);
            return action;
        };
        const originalResolve = api.resolveHistoryStartBlockApi;
        let signal: AbortSignal | undefined;
        let finish: ((value: number | undefined) => void) | undefined;
        api.resolveHistoryStartBlockApi = async (_web3, _fromTime, requestSignal) => {
            signal = requestSignal;
            return new Promise<number | undefined>((resolve) => {
                finish = resolve;
            });
        };

        try {
            const pending = dispatch(loadDelegatorHistory(address, {}, ChartUnit.WEEK));
            await Promise.resolve();
            const key = `${detailKey}:${ChartUnit.WEEK}`;
            expect(state.historyByKey[key].status).toBe('loading');

            await dispatch(cancelDelegatorHistoryRequest());
            expect(signal && signal.aborted).toBe(true);
            expect(state.historyByKey[key].status).toBe('idle');
            expect(state.historyByKey[key].requestId).toBeUndefined();

            if (finish) finish(undefined);
            await pending;
            expect(state.historyByKey[key].status).toBe('idle');
        } finally {
            api.resolveHistoryStartBlockApi = originalResolve;
        }
    });

    it('calculates UTC-aligned ten-week and twelve-month fetch boundaries', () => {
        const asOf = Date.UTC(2026, 6, 15, 12) / 1000; // Wednesday
        expect(getDetailHistoryStartTime(ChartUnit.WEEK, asOf)).toBe(Date.UTC(2026, 4, 11) / 1000);
        expect(getDetailHistoryStartTime(ChartUnit.MONTH, asOf)).toBe(Date.UTC(2025, 7, 1) / 1000);

        const weeks = getDetailHistorySampleTimestamps(ChartUnit.WEEK, asOf);
        expect(weeks).toHaveLength(11);
        expect(weeks[0]).toBe(Date.UTC(2026, 4, 11) / 1000);
        expect(weeks[weeks.length - 1]).toBe(asOf);

        const months = getDetailHistorySampleTimestamps(ChartUnit.MONTH, asOf);
        expect(months).toHaveLength(13);
        expect(months[0]).toBe(Date.UTC(2025, 7, 1) / 1000);
        expect(months[months.length - 1]).toBe(asOf);
    });
});
