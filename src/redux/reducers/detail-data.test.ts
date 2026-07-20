import {
    DelegatorCurrent,
    DelegatorStakeHistory,
    GuardianCurrent,
    GuardianStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { ChartUnit } from '../../global/enums';
import { indexedDelegatorHistoryEnabled } from '../../config';
import { api } from '../../services/api';
import { clearGuardianDetailCache } from '../../services/cache/guardian-detail-cache';
import { clearDelegatorDetailCache } from '../../services/cache/delegator-detail-cache';
import { CHAINS } from '../../types';
import {
    cancelGuardianHistoryRequest,
    getGuardianAction,
    loadGuardianHistory,
    resetGuardianReloadRefreshTracking
} from '../actions/guardians-actions';
import {
    cancelDelegatorHistoryRequest,
    findDelegatorAction,
    loadDelegatorHistory,
    resetDelegatorReloadRefreshTracking
} from '../actions/delegator-actions';
import {
    DELEGATOR_HISTORY_CACHE_TTL_MS,
    GUARDIAN_CURRENT_CACHE_TTL_MS,
    GUARDIAN_HISTORY_CACHE_TTL_MS,
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

const delegatorHistory = (
    unit: ChartUnit.DAY | ChartUnit.WEEK | ChartUnit.MONTH,
    snapshot: DelegatorCurrent = delegatorCurrent
): DelegatorStakeHistory => {
    const fromBlock = unit === ChartUnit.WEEK ? 100 : unit === ChartUnit.MONTH ? 50 : 150;
    const fromTime = getDetailHistoryStartTime(unit, snapshot.block_time);
    return {
        address,
        range: {
            from_block: fromBlock,
            to_block: snapshot.block_number,
            from_time: fromTime,
            to_time: snapshot.block_time
        },
        stake_slices: [
            {
                block_number: fromBlock,
                block_time: fromTime,
                stake: snapshot.total_stake,
                cooldown: snapshot.cooldown_stake
            },
            {
                block_number: snapshot.block_number,
                block_time: snapshot.block_time,
                stake: snapshot.total_stake,
                cooldown: snapshot.cooldown_stake
            }
        ],
        data_quality: {
            exact: true,
            stake_values_exact: true,
            anchor_exact: true,
            anchor_source: 'current-state-reverse',
            mode: 'event-reconstruction',
            event_source: 'rpc-logs',
            sampled_state: false
        }
    };
};

const history = (unit: ChartUnit.DAY | ChartUnit.WEEK | ChartUnit.MONTH): GuardianStakeHistory => ({
    address,
    range: {
        from_block: unit === ChartUnit.WEEK ? 100 : unit === ChartUnit.MONTH ? 50 : 150,
        to_block: 200,
        from_time: getDetailHistoryStartTime(unit, current.block_time),
        to_time: current.block_time
    },
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
    beforeEach(() => {
        clearDelegatorDetailCache();
        clearGuardianDetailCache();
        resetDelegatorReloadRefreshTracking();
        resetGuardianReloadRefreshTracking();
    });

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

    it('stores progressive Guardian ranges in one raw chain-and-address entry', () => {
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

        const weekFromTime = getDetailHistoryStartTime(ChartUnit.WEEK, current.block_time);
        const monthFromTime = getDetailHistoryStartTime(ChartUnit.MONTH, current.block_time);
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_REQUEST,
            payload: {
                detailKey,
                address,
                chain: CHAINS.ETHEREUM,
                requestId: 'shared',
                targetFromTime: weekFromTime
            }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_HISTORY,
            payload: { detailKey, unit: ChartUnit.MONTH }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_REQUEST,
            payload: {
                detailKey,
                address,
                chain: CHAINS.ETHEREUM,
                requestId: 'shared',
                targetFromTime: monthFromTime
            }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_SUCCESS,
            payload: {
                detailKey,
                requestId: 'shared',
                data: history(ChartUnit.WEEK),
                coveredFromTime: weekFromTime,
                complete: false
            }
        });
        expect(state.selectedGuardian && state.selectedGuardian.stake_slices).toHaveLength(1);
        expect(state.historyByKey[detailKey]).toMatchObject({
            status: 'loading',
            coveredFromTime: weekFromTime,
            targetFromTime: monthFromTime
        });
        expect(Object.keys(state.historyByKey)).toEqual([detailKey]);

        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_SUCCESS,
            payload: {
                detailKey,
                requestId: 'shared',
                data: history(ChartUnit.MONTH),
                coveredFromTime: monthFromTime,
                complete: true
            }
        });
        expect(state.historyByKey[detailKey]).toMatchObject({
            status: 'loaded',
            coveredFromTime: monthFromTime,
            data: history(ChartUnit.MONTH)
        });
        expect(state.activeGuardianHistoryUnit).toBe(ChartUnit.MONTH);
    });

    it('restores the last Guardian history unit when the detail screen is re-entered', () => {
        let state = guardiansReducer(undefined, { type: '@@init' });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key: detailKey }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_HISTORY,
            payload: {
                key: `${detailKey}:${ChartUnit.DAY}`,
                detailKey,
                unit: ChartUnit.DAY
            }
        });
        state = guardiansReducer(state, { type: types.GUARDIAN.RESET_GUARDIAN });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key: detailKey }
        });

        expect(state.activeGuardianHistoryUnit).toBe(ChartUnit.DAY);
        expect(state.historyUnitByKey[detailKey]).toBe(ChartUnit.DAY);
    });

    it('reuses one raw range for Day/Week and extends only when Month needs older data', async () => {
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
        const originalHistory = api.getGuardianStakeHistoryFromTimeApi;
        let currentCalls = 0;
        let resolveCalls = 0;
        let historyCalls = 0;
        let latestCurrentSnapshot: GuardianCurrent | undefined;
        let mutableCacheTtlMs: number | undefined;
        api.getGuardianCurrentApi = async () => {
            currentCalls += 1;
            return current;
        };
        api.resolveHistoryStartBlockApi = async () => {
            resolveCalls += 1;
            return 100;
        };
        api.getGuardianStakeHistoryFromTimeApi = async (
            _address,
            _web3,
            fromTime,
            _signal,
            currentSnapshot,
            requestedMutableCacheTtlMs
        ) => {
            historyCalls += 1;
            latestCurrentSnapshot = currentSnapshot;
            mutableCacheTtlMs = requestedMutableCacheTtlMs;
            return history(fromTime === getDetailHistoryStartTime(ChartUnit.WEEK, current.block_time)
                ? ChartUnit.WEEK
                : ChartUnit.MONTH);
        };

        try {
            await dispatch(getGuardianAction(address, {}));
            await dispatch(getGuardianAction(address, {}));
            expect({ currentCalls, resolveCalls, historyCalls }).toEqual({
                currentCalls: 1,
                resolveCalls: 0,
                historyCalls: 0
            });
            expect(latestCurrentSnapshot).toBeUndefined();

            await dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            expect({ currentCalls, resolveCalls, historyCalls }).toEqual({
                currentCalls: 1,
                resolveCalls: 0,
                historyCalls: 1
            });
            expect(latestCurrentSnapshot).toBe(current);
            expect(mutableCacheTtlMs).toBe(GUARDIAN_HISTORY_CACHE_TTL_MS);

            await dispatch(loadGuardianHistory(address, {}, ChartUnit.DAY));
            expect({ resolveCalls, historyCalls }).toEqual({ resolveCalls: 0, historyCalls: 1 });

            // Month extends the same raw entry to an older boundary.
            api.resolveHistoryStartBlockApi = async () => {
                resolveCalls += 1;
                return 50;
            };
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            expect({ currentCalls, resolveCalls, historyCalls }).toEqual({
                currentCalls: 1,
                resolveCalls: 0,
                historyCalls: 2
            });
            expect(latestCurrentSnapshot).toBe(current);
            expect(Object.keys(state.historyByKey)).toEqual([detailKey]);
            expect(state.historyByKey[detailKey].coveredFromTime).toBe(
                getDetailHistoryStartTime(ChartUnit.MONTH, current.block_time)
            );

            await dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.DAY));
            expect({ resolveCalls, historyCalls }).toEqual({ resolveCalls: 0, historyCalls: 2 });
        } finally {
            api.getGuardianCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryFromTimeApi = originalHistory;
        }
    });

    it('restores a fresh Guardian cache after a full Redux reset without new RPC calls', async () => {
        let state = guardiansReducer(undefined, { type: '@@init' });
        const appState = () => ({
            main: { chain: CHAINS.POLYGON, web3: {} },
            guardians: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = guardiansReducer(state, action);
            return action;
        };
        const polygonKey = `${CHAINS.POLYGON}:${address}`;
        const originalCurrent = api.getGuardianCurrentApi;
        const originalResolve = api.resolveHistoryStartBlockApi;
        const originalHistory = api.getGuardianStakeHistoryFromTimeApi;
        let currentCalls = 0;
        let resolveCalls = 0;
        let historyCalls = 0;
        api.getGuardianCurrentApi = async () => {
            currentCalls += 1;
            return current;
        };
        api.resolveHistoryStartBlockApi = async () => {
            resolveCalls += 1;
            return 50;
        };
        api.getGuardianStakeHistoryFromTimeApi = async () => {
            historyCalls += 1;
            return history(ChartUnit.MONTH);
        };

        try {
            await dispatch(getGuardianAction(address, {}));
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            expect({ currentCalls, resolveCalls, historyCalls }).toEqual({
                currentCalls: 1,
                resolveCalls: 0,
                historyCalls: 1
            });

            // Simulate the document reload performed by the network selector.
            state = guardiansReducer(undefined, { type: '@@init' });
            await dispatch(getGuardianAction(address, {}));
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));

            expect({ currentCalls, resolveCalls, historyCalls }).toEqual({
                currentCalls: 1,
                resolveCalls: 0,
                historyCalls: 1
            });
            expect(state.currentByKey[polygonKey]).toMatchObject({
                status: 'loaded',
                data: current
            });
            expect(state.historyByKey[polygonKey]).toMatchObject({
                status: 'loaded',
                coveredFromTime: getDetailHistoryStartTime(ChartUnit.MONTH, current.block_time)
            });
        } finally {
            api.getGuardianCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryFromTimeApi = originalHistory;
        }
    });

    it('refreshes a persisted Guardian cache from latestBlock + 1 after a browser reload', async () => {
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
        const refreshedCurrent: GuardianCurrent = {
            ...current,
            block_number: 210,
            block_time: current.block_time + 100,
            stake_status: {
                ...current.stake_status,
                delegated_stake: 30,
                total_stake: 40
            }
        };
        const cachedHistory: GuardianStakeHistory = {
            ...history(ChartUnit.MONTH),
            stake_slices: [
                {
                    block_number: 50,
                    block_time: current.block_time - 1000,
                    self_stake: 10,
                    delegated_stake: 20,
                    total_stake: 30,
                    n_delegates: 0
                },
                {
                    block_number: 200,
                    block_time: current.block_time,
                    self_stake: 10,
                    delegated_stake: 20,
                    total_stake: 30,
                    n_delegates: 0
                }
            ]
        };
        const deltaHistory: GuardianStakeHistory = {
            address,
            range: {
                from_block: 201,
                to_block: 210,
                from_time: current.block_time + 10,
                to_time: refreshedCurrent.block_time
            },
            stake_slices: [
                {
                    block_number: 201,
                    block_time: current.block_time + 10,
                    self_stake: 10,
                    delegated_stake: 20,
                    total_stake: 30,
                    n_delegates: 0
                },
                {
                    block_number: 205,
                    block_time: current.block_time + 50,
                    self_stake: 10,
                    delegated_stake: 30,
                    total_stake: 40,
                    n_delegates: 1,
                    transaction_hash: '0xdelta',
                    log_index: 0
                },
                {
                    block_number: 210,
                    block_time: refreshedCurrent.block_time,
                    self_stake: 10,
                    delegated_stake: 30,
                    total_stake: 40,
                    n_delegates: 1
                }
            ],
            data_quality: {
                exact: true,
                stake_values_exact: true,
                anchor_exact: true,
                anchor_source: 'prior-event',
                mode: 'event-reconstruction',
                event_source: 'rpc-logs',
                n_delegates_available: true,
                n_delegates_source: 'subgraph-checkpoint+range-events'
            }
        };

        const originalCurrent = api.getGuardianCurrentApi;
        const originalResolve = api.resolveHistoryStartBlockApi;
        const originalHistory = api.getGuardianStakeHistoryFromTimeApi;
        const originalDeltaHistory = api.getGuardianStakeHistoryApi;
        const originalPath = window.location.pathname;
        const navigationDescriptor = Object.getOwnPropertyDescriptor(window.performance, 'getEntriesByType');
        let currentCalls = 0;
        let resolveCalls = 0;
        const fromBlocks: number[] = [];
        let receivedAnchor: any;
        api.getGuardianCurrentApi = async () => {
            currentCalls += 1;
            return currentCalls === 1 ? current : refreshedCurrent;
        };
        api.resolveHistoryStartBlockApi = async () => {
            resolveCalls += 1;
            return 50;
        };
        api.getGuardianStakeHistoryFromTimeApi = async (
            _address,
            _web3,
            fromTime,
            _signal,
            _currentSnapshot
        ) => {
            fromBlocks.push(fromTime);
            return cachedHistory;
        };
        api.getGuardianStakeHistoryApi = async (
            _address,
            _web3,
            fromBlock,
            _signal,
            _currentSnapshot,
            _mutableCacheTtlMs,
            anchorSnapshot
        ) => {
            fromBlocks.push(fromBlock);
            receivedAnchor = anchorSnapshot;
            return deltaHistory;
        };
        window.history.replaceState({}, '', `/ethereum/guardians/stake/${address}`);
        Object.defineProperty(window.performance, 'getEntriesByType', {
            configurable: true,
            value: (entryType: string) => entryType === 'navigation' ? [{ type: 'reload' }] : []
        });

        try {
            await dispatch(getGuardianAction(address, {}));
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            expect({ currentCalls, resolveCalls, fromBlocks }).toEqual({
                currentCalls: 1,
                resolveCalls: 0,
                fromBlocks: [getDetailHistoryStartTime(ChartUnit.MONTH, current.block_time)]
            });

            state = guardiansReducer(undefined, { type: '@@init' });
            await dispatch(getGuardianAction(address, {}));

            expect({ currentCalls, resolveCalls, fromBlocks }).toEqual({
                currentCalls: 2,
                resolveCalls: 0,
                fromBlocks: [getDetailHistoryStartTime(ChartUnit.MONTH, current.block_time), 201]
            });
            expect(receivedAnchor).toEqual({
                block_number: 200,
                block_time: current.block_time,
                stake_status: {
                    self_stake: 10,
                    delegated_stake: 20,
                    total_stake: 30
                }
            });
            expect(state.currentByKey[detailKey].data).toBe(refreshedCurrent);
            expect(state.historyByKey[detailKey].data).toMatchObject({
                range: { from_block: 50, to_block: 210 }
            });
            expect(state.historyByKey[detailKey].data!.stake_slices.map((slice) => slice.block_number)).toEqual([
                50,
                200,
                205,
                210
            ]);
        } finally {
            api.getGuardianCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryFromTimeApi = originalHistory;
            api.getGuardianStakeHistoryApi = originalDeltaHistory;
            window.history.replaceState({}, '', originalPath);
            if (navigationDescriptor) {
                Object.defineProperty(window.performance, 'getEntriesByType', navigationDescriptor);
            } else {
                delete (window.performance as any).getEntriesByType;
            }
            resetGuardianReloadRefreshTracking();
        }
    });

    it('keeps an expired persisted cache and refreshes only after latestBlock', async () => {
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
        const originalHistory = api.getGuardianStakeHistoryFromTimeApi;
        const originalDeltaHistory = api.getGuardianStakeHistoryApi;
        let currentCalls = 0;
        let historyCalls = 0;
        const fromBlocks: number[] = [];
        const resolvedFromTimes: number[] = [];
        api.getGuardianCurrentApi = async () => {
            currentCalls += 1;
            return currentCalls === 1
                ? current
                : {
                    ...current,
                    block_number: 210,
                    block_time: current.block_time + 100
                };
        };
        api.resolveHistoryStartBlockApi = async (_web3, fromTime) => {
            resolvedFromTimes.push(fromTime);
            return 50;
        };
        api.getGuardianStakeHistoryFromTimeApi = async (
            _address,
            _web3,
            fromTime,
            _signal,
            _currentSnapshot
        ) => {
            historyCalls += 1;
            fromBlocks.push(fromTime);
            return history(ChartUnit.MONTH);
        };
        api.getGuardianStakeHistoryApi = async (
            _address,
            _web3,
            fromBlock
        ) => {
            historyCalls += 1;
            fromBlocks.push(fromBlock);
            return {
                address,
                range: {
                    from_block: 201,
                    to_block: 210,
                    from_time: current.block_time + 10,
                    to_time: current.block_time + 100
                },
                stake_slices: [
                    {
                        block_number: 201,
                        block_time: current.block_time + 10,
                        self_stake: 10,
                        delegated_stake: 20,
                        total_stake: 30,
                        n_delegates: 0
                    },
                    {
                        block_number: 210,
                        block_time: current.block_time + 100,
                        self_stake: 10,
                        delegated_stake: 20,
                        total_stake: 30,
                        n_delegates: 0
                    }
                ],
                data_quality: history(ChartUnit.MONTH).data_quality
            } as GuardianStakeHistory;
        };

        try {
            await dispatch(getGuardianAction(address, {}));
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));

            // A full Redux reset still restores the persisted data before the
            // refresh interval and does not touch RPC.
            now.mockReturnValue(1_000_000 + GUARDIAN_CURRENT_CACHE_TTL_MS - 1);
            state = guardiansReducer(undefined, { type: '@@init' });
            await dispatch(getGuardianAction(address, {}));
            expect(currentCalls).toBe(1);

            // Once stale, the same persisted range remains the baseline. Only
            // its missing tail is queried; the old Month boundary is not
            // resolved or replayed again.
            now.mockReturnValue(1_000_000 + GUARDIAN_CURRENT_CACHE_TTL_MS);
            state = guardiansReducer(undefined, { type: '@@init' });
            // History may mount before the top-of-page current loader; either
            // order must claim the same incremental refresh.
            await dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            await dispatch(getGuardianAction(address, {}));
            expect(currentCalls).toBe(2);
            expect(historyCalls).toBe(2);
            expect(fromBlocks).toEqual([
                getDetailHistoryStartTime(ChartUnit.MONTH, current.block_time),
                201
            ]);
            expect(resolvedFromTimes).toEqual([]);
            expect(state.historyByKey[detailKey].latestBlock).toBe(210);
            expect(state.historyByKey[detailKey].data!.range.from_block).toBe(50);
        } finally {
            now.mockRestore();
            api.getGuardianCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryFromTimeApi = originalHistory;
            api.getGuardianStakeHistoryApi = originalDeltaHistory;
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
        const originalHistory = api.getGuardianStakeHistoryFromTimeApi;
        let currentCalls = 0;
        let receivedSnapshot: GuardianCurrent | undefined;
        api.getGuardianCurrentApi = async () => {
            currentCalls += 1;
            return { ...current, block_time: current.block_time + currentCalls };
        };
        api.resolveHistoryStartBlockApi = async () => 50;
        api.getGuardianStakeHistoryFromTimeApi = async (
            _address,
            _web3,
            _fromBlock,
            _signal,
            currentSnapshot
        ) => {
            receivedSnapshot = currentSnapshot;
            return history(ChartUnit.MONTH);
        };

        try {
            await dispatch(getGuardianAction(address, {}));
            expect(currentCalls).toBe(1);
            now.mockReturnValue(2_000_000 + GUARDIAN_CURRENT_CACHE_TTL_MS);

            await dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            expect(currentCalls).toBe(2);
            expect(receivedSnapshot && receivedSnapshot.block_time).toBe(current.block_time + 2);
            expect(state.guardianCurrent && state.guardianCurrent.block_time).toBe(current.block_time + 2);
        } finally {
            now.mockRestore();
            api.getGuardianCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryFromTimeApi = originalHistory;
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
        let state = guardiansReducer(undefined, { type: '@@init' });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key: detailKey }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_REQUEST,
            payload: {
                detailKey,
                address,
                chain: CHAINS.ETHEREUM,
                requestId: 'history',
                targetFromTime: getDetailHistoryStartTime(ChartUnit.WEEK, current.block_time)
            }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_HISTORY_FAILURE,
            payload: {
                detailKey,
                requestId: 'history',
                error: 'history failed'
            }
        });
        expect(state.guardianHistoryIsLoading).toBe(false);
        expect(state.guardianHistoryError).toBe('history failed');
        expect(state.historyByKey[detailKey].status).toBe('error');
    });

    it('shares an in-flight Week request and extends it when Month is selected', async () => {
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
        const originalHistory = api.getGuardianStakeHistoryFromTimeApi;
        let sharedSignal: AbortSignal | undefined;
        let resolveCalls = 0;
        let historyCalls = 0;
        let finishWeek: ((value: GuardianStakeHistory) => void) | undefined;
        let markWeekStarted: (() => void) | undefined;
        const weekStarted = new Promise<void>((resolve) => {
            markWeekStarted = resolve;
        });
        api.resolveHistoryStartBlockApi = async (_web3, _fromTime, signal) => {
            resolveCalls += 1;
            sharedSignal = signal;
            return resolveCalls === 1 ? 100 : 50;
        };
        api.getGuardianStakeHistoryFromTimeApi = async (_address, _web3, _fromTime, signal) => {
            historyCalls += 1;
            sharedSignal = signal;
            if (historyCalls > 1) return history(ChartUnit.MONTH);
            if (markWeekStarted) markWeekStarted();
            return new Promise<GuardianStakeHistory>((resolve) => {
                finishWeek = resolve;
            });
        };

        try {
            const weekPromise = dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            await weekStarted;
            const monthPromise = dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            expect(sharedSignal && sharedSignal.aborted).toBe(false);
            if (finishWeek) finishWeek(history(ChartUnit.WEEK));
            await monthPromise;
            await weekPromise;

            expect(sharedSignal && sharedSignal.aborted).toBe(false);
            expect({ resolveCalls, historyCalls }).toEqual({ resolveCalls: 0, historyCalls: 2 });
            expect(Object.keys(state.historyByKey)).toEqual([detailKey]);
            expect(state.historyByKey[detailKey]).toMatchObject({
                status: 'loaded',
                coveredFromTime: getDetailHistoryStartTime(ChartUnit.MONTH, current.block_time)
            });
        } finally {
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryFromTimeApi = originalHistory;
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
        now.mockReturnValue(3_000_000 + GUARDIAN_CURRENT_CACHE_TTL_MS);
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
        const originalHistory = api.getGuardianStakeHistoryFromTimeApi;
        let currentCalls = 0;
        let historyCalls = 0;
        let finishCurrent: ((value: GuardianCurrent) => void) | undefined;
        let markCurrentStarted: (() => void) | undefined;
        const currentStarted = new Promise<void>((resolve) => {
            markCurrentStarted = resolve;
        });
        api.getGuardianCurrentApi = async () => {
            currentCalls += 1;
            if (markCurrentStarted) markCurrentStarted();
            return new Promise<GuardianCurrent>((resolve) => {
                finishCurrent = resolve;
            });
        };
        api.resolveHistoryStartBlockApi = async () => 50;
        api.getGuardianStakeHistoryFromTimeApi = async () => {
            historyCalls += 1;
            return history(ChartUnit.MONTH);
        };

        try {
            const weekPromise = dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            await currentStarted;
            const monthPromise = dispatch(loadGuardianHistory(address, {}, ChartUnit.MONTH));
            if (finishCurrent) finishCurrent({ ...current, block_time: current.block_time + 100 });
            await monthPromise;
            await weekPromise;

            expect(currentCalls).toBe(1);
            expect(historyCalls).toBe(1);
            expect(Object.keys(state.historyByKey)).toEqual([detailKey]);
            expect(state.historyByKey[detailKey].status).toBe('loaded');
            expect(state.historyByKey[detailKey].coveredFromTime).toBe(
                getDetailHistoryStartTime(ChartUnit.MONTH, current.block_time + 100)
            );
            expect(state.guardianCurrent && state.guardianCurrent.block_time).toBe(current.block_time + 100);
        } finally {
            now.mockRestore();
            api.getGuardianCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryFromTimeApi = originalHistory;
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
        const originalHistory = api.getGuardianStakeHistoryFromTimeApi;
        let signal: AbortSignal | undefined;
        let finish: ((value: GuardianStakeHistory | undefined) => void) | undefined;
        api.getGuardianStakeHistoryFromTimeApi = async (_address, _web3, _fromTime, requestSignal) => {
            signal = requestSignal;
            return new Promise<GuardianStakeHistory | undefined>((resolve) => {
                finish = resolve;
            });
        };

        try {
            const pending = dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            await Promise.resolve();
            expect(state.historyByKey[detailKey].status).toBe('loading');

            await dispatch(cancelGuardianHistoryRequest());
            expect(signal && signal.aborted).toBe(true);
            expect(state.historyByKey[detailKey].status).toBe('idle');
            expect(state.historyByKey[detailKey].requestId).toBeUndefined();

            if (finish) finish(undefined);
            await pending;
            expect(state.historyByKey[detailKey].status).toBe('idle');
        } finally {
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryFromTimeApi = originalHistory;
        }
    });

    it('keeps period switches alive but aborts history when the Guardian address changes', async () => {
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
        const originalCurrent = api.getGuardianCurrentApi;
        const originalResolve = api.resolveHistoryStartBlockApi;
        const originalHistory = api.getGuardianStakeHistoryFromTimeApi;
        let historySignal: AbortSignal | undefined;
        let markStarted: (() => void) | undefined;
        const started = new Promise<void>((resolve) => {
            markStarted = resolve;
        });
        api.getGuardianStakeHistoryFromTimeApi = async (_address, _web3, _fromTime, signal) => {
            historySignal = signal;
            if (markStarted) markStarted();
            return new Promise<GuardianStakeHistory | undefined>((resolve) => {
                if (signal) signal.addEventListener('abort', () => resolve(undefined));
            });
        };
        const otherAddress = '0xdef';
        api.getGuardianCurrentApi = async () => ({ ...current, address: otherAddress });

        try {
            const pending = dispatch(loadGuardianHistory(address, {}, ChartUnit.WEEK));
            await started;
            await dispatch(getGuardianAction(otherAddress, {}));
            await pending;

            expect(historySignal && historySignal.aborted).toBe(true);
            expect(state.historyByKey[detailKey].status).toBe('idle');
            expect(state.activeGuardianKey).toBe(`${CHAINS.ETHEREUM}:${otherAddress}`);
        } finally {
            api.getGuardianCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getGuardianStakeHistoryFromTimeApi = originalHistory;
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
        const originalHistory = api.getDelegatorStakeHistoryApi;
        const originalIndexedHistory = api.getDelegatorStakeHistoryFromTimeApi;
        let signal: AbortSignal | undefined;
        let markStarted: () => void = () => undefined;
        const started = new Promise<void>((resolve) => {
            markStarted = resolve;
        });
        const waitForAbort = async (requestSignal?: AbortSignal): Promise<DelegatorStakeHistory | undefined> => {
            signal = requestSignal;
            markStarted();
            return new Promise<DelegatorStakeHistory | undefined>((resolve) => {
                if (requestSignal) requestSignal.addEventListener('abort', () => resolve(undefined));
            });
        };
        api.resolveHistoryStartBlockApi = async () => 100;
        api.getDelegatorStakeHistoryApi = async (_address, _web3, _fromBlock, requestSignal) =>
            waitForAbort(requestSignal);
        api.getDelegatorStakeHistoryFromTimeApi = async (_address, _web3, _fromTime, requestSignal) =>
            waitForAbort(requestSignal);

        try {
            const pending = dispatch(loadDelegatorHistory(address, {}, ChartUnit.WEEK));
            await started;
            const key = detailKey;
            expect(state.historyByKey[key].status).toBe('loading');

            await dispatch(cancelDelegatorHistoryRequest());
            expect(signal && signal.aborted).toBe(true);
            expect(state.historyByKey[key].status).toBe('idle');
            expect(state.historyByKey[key].requestId).toBeUndefined();

            await pending;
            expect(state.historyByKey[key].status).toBe('idle');
        } finally {
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getDelegatorStakeHistoryApi = originalHistory;
            api.getDelegatorStakeHistoryFromTimeApi = originalIndexedHistory;
        }
    });

    it('loads Delegator history through the event-log API with a mutable cache TTL', async () => {
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
        const originalHistory = api.getDelegatorStakeHistoryApi;
        const originalIndexedHistory = api.getDelegatorStakeHistoryFromTimeApi;
        let receivedCurrent: DelegatorCurrent | undefined;
        let receivedTtl: number | undefined;
        api.getDelegatorCurrentApi = async () => delegatorCurrent;
        api.resolveHistoryStartBlockApi = async () => 100;
        api.getDelegatorStakeHistoryApi = async (
            _address,
            _web3,
            _fromBlock,
            _signal,
            currentSnapshot,
            mutableCacheTtlMs
        ) => {
            receivedCurrent = currentSnapshot;
            receivedTtl = mutableCacheTtlMs;
            return ({
                address,
                range: { from_block: 100, to_block: 200 },
                stake_slices: [],
                data_quality: {
                    exact: true,
                    stake_values_exact: true,
                    anchor_exact: true,
                    anchor_source: 'current-state-reverse',
                    mode: 'event-reconstruction',
                    event_source: 'rpc-logs'
                }
            } as DelegatorStakeHistory);
        };
        api.getDelegatorStakeHistoryFromTimeApi = async (
            _address,
            _web3,
            _fromTime,
            _signal,
            currentSnapshot,
            mutableCacheTtlMs
        ) => {
            receivedCurrent = currentSnapshot;
            receivedTtl = mutableCacheTtlMs;
            return ({
                address,
                range: { from_block: 100, to_block: 200 },
                stake_slices: [],
                data_quality: {
                    exact: true,
                    stake_values_exact: true,
                    anchor_exact: true,
                    anchor_source: 'current-state-reverse',
                    mode: 'event-reconstruction',
                    event_source: 'rpc-logs'
                }
            } as DelegatorStakeHistory);
        };

        try {
            await dispatch(loadDelegatorHistory(address, {}, ChartUnit.WEEK));
            expect(receivedCurrent).toBe(delegatorCurrent);
            expect(receivedTtl).toBe(DELEGATOR_HISTORY_CACHE_TTL_MS);
            expect(state.historyByKey[detailKey]).toMatchObject({
                status: 'loaded',
                data: { data_quality: { event_source: 'rpc-logs' } }
            });
        } finally {
            api.getDelegatorCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getDelegatorStakeHistoryApi = originalHistory;
            api.getDelegatorStakeHistoryFromTimeApi = originalIndexedHistory;
        }
    });

    it('persists one Delegator raw range and restores it after a Redux reset without RPC', async () => {
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
        const originalHistory = api.getDelegatorStakeHistoryApi;
        const originalIndexedHistory = api.getDelegatorStakeHistoryFromTimeApi;
        let currentCalls = 0;
        let resolveCalls = 0;
        let historyCalls = 0;
        api.getDelegatorCurrentApi = async () => {
            currentCalls += 1;
            return delegatorCurrent;
        };
        api.resolveHistoryStartBlockApi = async () => {
            resolveCalls += 1;
            return 100;
        };
        api.getDelegatorStakeHistoryApi = async () => {
            historyCalls += 1;
            return delegatorHistory(ChartUnit.WEEK);
        };
        api.getDelegatorStakeHistoryFromTimeApi = async () => {
            historyCalls += 1;
            return delegatorHistory(ChartUnit.WEEK);
        };

        try {
            await dispatch(findDelegatorAction(address, {}));
            await dispatch(loadDelegatorHistory(address, {}, ChartUnit.WEEK));
            expect({ currentCalls, resolveCalls, historyCalls }).toEqual({
                currentCalls: 1,
                resolveCalls: indexedDelegatorHistoryEnabled ? 0 : 1,
                historyCalls: 1
            });

            state = delegatorReducer(undefined, { type: '@@init' });
            await dispatch(findDelegatorAction(address, {}));
            await dispatch(loadDelegatorHistory(address, {}, ChartUnit.DAY));

            expect({ currentCalls, resolveCalls, historyCalls }).toEqual({
                currentCalls: 1,
                resolveCalls: indexedDelegatorHistoryEnabled ? 0 : 1,
                historyCalls: 1
            });
            expect(Object.keys(state.historyByKey)).toEqual([detailKey]);
            expect(state.historyByKey[detailKey]).toMatchObject({
                status: 'loaded',
                coveredFromTime: getDetailHistoryStartTime(ChartUnit.WEEK, delegatorCurrent.block_time)
            });
        } finally {
            api.getDelegatorCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getDelegatorStakeHistoryApi = originalHistory;
            api.getDelegatorStakeHistoryFromTimeApi = originalIndexedHistory;
        }
    });

    it('refreshes the persisted Delegator finality tail without replaying full history', async () => {
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
        const originalNow = Date.now;
        const originalCurrent = api.getDelegatorCurrentApi;
        const originalResolve = api.resolveHistoryStartBlockApi;
        const originalHistory = api.getDelegatorStakeHistoryApi;
        const originalIndexedHistory = api.getDelegatorStakeHistoryFromTimeApi;
        let now = Date.UTC(2026, 6, 20, 0);
        let currentResult = delegatorCurrent;
        const fromBlocks: number[] = [];
        let fromTimeCalls = 0;
        let resolveCalls = 0;
        Date.now = () => now;
        api.getDelegatorCurrentApi = async () => currentResult;
        api.resolveHistoryStartBlockApi = async () => {
            resolveCalls += 1;
            return 100;
        };
        api.getDelegatorStakeHistoryApi = async (_address, _web3, fromBlock) => {
            fromBlocks.push(fromBlock);
            if (fromBlock === 100) return delegatorHistory(ChartUnit.WEEK);
            return {
                address,
                range: {
                    from_block: 137,
                    to_block: 210,
                    from_time: delegatorCurrent.block_time + 1,
                    to_time: delegatorCurrent.block_time + 100
                },
                stake_slices: [
                    {
                        block_number: 137,
                        block_time: delegatorCurrent.block_time + 1,
                        stake: 10,
                        cooldown: 0
                    },
                    {
                        block_number: 205,
                        block_time: delegatorCurrent.block_time + 50,
                        stake: 15,
                        cooldown: 0,
                        transaction_hash: '0xdelta',
                        log_index: 0
                    },
                    {
                        block_number: 210,
                        block_time: delegatorCurrent.block_time + 100,
                        stake: 15,
                        cooldown: 0
                    }
                ],
                data_quality: {
                    exact: true,
                    stake_values_exact: true,
                    anchor_exact: true,
                    anchor_source: 'current-state-reverse',
                    mode: 'event-reconstruction',
                    event_source: 'rpc-logs',
                    sampled_state: false
                }
            } as DelegatorStakeHistory;
        };
        api.getDelegatorStakeHistoryFromTimeApi = async () => {
            fromTimeCalls += 1;
            return delegatorHistory(ChartUnit.WEEK);
        };

        try {
            await dispatch(findDelegatorAction(address, {}));
            await dispatch(loadDelegatorHistory(address, {}, ChartUnit.WEEK));
            expect(fromBlocks).toEqual(indexedDelegatorHistoryEnabled ? [] : [100]);
            expect(fromTimeCalls).toBe(indexedDelegatorHistoryEnabled ? 1 : 0);

            state = delegatorReducer(undefined, { type: '@@init' });
            now += DELEGATOR_HISTORY_CACHE_TTL_MS + 1;
            currentResult = {
                ...delegatorCurrent,
                block_number: 210,
                block_time: delegatorCurrent.block_time + 100,
                total_stake: 15
            };
            await dispatch(findDelegatorAction(address, {}));

            expect(fromBlocks).toEqual(indexedDelegatorHistoryEnabled ? [137] : [100, 137]);
            expect(resolveCalls).toBe(indexedDelegatorHistoryEnabled ? 0 : 1);
            expect(state.historyByKey[detailKey].data).toMatchObject({
                range: { from_block: 100, to_block: 210 }
            });
            expect(state.historyByKey[detailKey].data!.stake_slices.some(
                (slice) => slice.transaction_hash === '0xdelta'
            )).toBe(true);
        } finally {
            Date.now = originalNow;
            api.getDelegatorCurrentApi = originalCurrent;
            api.resolveHistoryStartBlockApi = originalResolve;
            api.getDelegatorStakeHistoryApi = originalHistory;
            api.getDelegatorStakeHistoryFromTimeApi = originalIndexedHistory;
        }
    });

    it('calculates UTC-aligned ten-day, ten-week and ten-month fetch boundaries', () => {
        const asOf = Date.UTC(2026, 6, 15, 12) / 1000; // Wednesday
        expect(getDetailHistoryStartTime(ChartUnit.DAY, asOf)).toBe(Date.UTC(2026, 6, 6) / 1000);
        expect(getDetailHistoryStartTime(ChartUnit.WEEK, asOf)).toBe(Date.UTC(2026, 4, 11) / 1000);
        expect(getDetailHistoryStartTime(ChartUnit.MONTH, asOf)).toBe(Date.UTC(2025, 9, 1) / 1000);

        const days = getDetailHistorySampleTimestamps(ChartUnit.DAY, asOf);
        expect(days).toHaveLength(11);
        expect(days[0]).toBe(Date.UTC(2026, 6, 6) / 1000);
        expect(days[days.length - 1]).toBe(asOf);

        const weeks = getDetailHistorySampleTimestamps(ChartUnit.WEEK, asOf);
        expect(weeks).toHaveLength(11);
        expect(weeks[0]).toBe(Date.UTC(2026, 4, 11) / 1000);
        expect(weeks[weeks.length - 1]).toBe(asOf);

        const months = getDetailHistorySampleTimestamps(ChartUnit.MONTH, asOf);
        expect(months).toHaveLength(11);
        expect(months[0]).toBe(Date.UTC(2025, 9, 1) / 1000);
        expect(months[months.length - 1]).toBe(asOf);
    });
});
