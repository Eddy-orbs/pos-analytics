import {
    GuardianDelegatorPageItem,
    GuardianDelegatorsPage
} from '@orbs-network/pos-analytics-lib';
import { api } from '../../services/api';
import { clearGuardianDetailCache } from '../../services/cache/guardian-detail-cache';
import { CHAINS } from '../../types';
import {
    cancelGuardianDelegatorsRequest,
    getGuardianDelegatorsKey,
    loadGuardianDelegatorsPage,
    resetGuardianReloadRefreshTracking
} from '../actions/guardians-actions';
import { GUARDIAN_DELEGATORS_CACHE_TTL_MS } from '../actions/detail-history';
import { types } from '../types/types';
import { guardiansReducer } from './guardians';

const guardian = '0xabc';
const firstItem: GuardianDelegatorPageItem = {
    address: '0x1',
    stake: 100,
    non_stake: 10,
    last_change_block: 10,
    last_change_time: 1000
};

const page = (
    items: GuardianDelegatorPageItem[],
    nextCursor?: string,
    total: number = items.length,
    asOfBlock: number = 200
): GuardianDelegatorsPage => ({
    guardian_address: guardian,
    items,
    total,
    as_of_block: asOfBlock,
    page_size: 50,
    next_cursor: nextCursor,
    cache_status: 'snapshot-hit',
    cache_source: 'rpc-fallback',
    cache_snapshot: {
        guardian_address: guardian,
        chain_id: 1,
        as_of_block: asOfBlock,
        finality_blocks: 64,
        cache_source: 'rpc-fallback',
        items: Array.from({ length: total }, (_unused, index) => {
            const item = items[index] || {
                ...firstItem,
                address: `0xcache${index}`,
                stake: Math.max(1, total - index)
            };
            return {
                address: item.address,
                stake: item.stake,
                last_change_block: Math.min(item.last_change_block, asOfBlock),
                last_change_time: item.last_change_time
            };
        })
    },
    data_quality: {
        active_set_exact: true,
        stake_values_exact: true,
        balance_scope: 'requested-page-only',
        balance_as_of: 'latest',
        last_change_time: 'subgraph-or-estimated',
        complete_through_block: 200,
        finality_blocks: 64,
        source: 'rpc-fallback'
    }
});

describe('Guardian delegator page cache', () => {
    beforeEach(() => {
        clearGuardianDetailCache();
        resetGuardianReloadRefreshTracking();
    });

    it('appends cursor pages and deduplicates addresses', () => {
        const key = getGuardianDelegatorsKey(CHAINS.ETHEREUM, guardian);
        let state = guardiansReducer(undefined, { type: '@@init' });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_DELEGATORS_REQUEST,
            payload: {
                key,
                address: guardian,
                chain: CHAINS.ETHEREUM,
                requestId: 'first',
                append: false
            }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_DELEGATORS_SUCCESS,
            payload: {
                key,
                requestId: 'first',
                append: false,
                data: page([firstItem, { ...firstItem, address: '0x2', stake: 80 }], 'next', 3)
            }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_DELEGATORS_REQUEST,
            payload: {
                key,
                address: guardian,
                chain: CHAINS.ETHEREUM,
                requestId: 'second',
                append: true
            }
        });
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_DELEGATORS_SUCCESS,
            payload: {
                key,
                requestId: 'second',
                append: true,
                data: page([
                    { ...firstItem, address: '0x2', stake: 81 },
                    { ...firstItem, address: '0x3', stake: 70 }
                ], undefined, 3)
            }
        });

        expect(state.delegatorsByKey[key].items.map((item) => [item.address, item.stake])).toEqual([
            ['0x1', 100],
            ['0x2', 81],
            ['0x3', 70]
        ]);
        expect(state.delegatorsByKey[key]).toMatchObject({
            status: 'loaded',
            nextCursor: undefined,
            total: 3
        });
    });

    it('ignores a response whose requestId was replaced by a newer request', () => {
        const key = getGuardianDelegatorsKey(CHAINS.ETHEREUM, guardian);
        let state = guardiansReducer(undefined, { type: '@@init' });
        const request = (requestId: string) => ({
            type: types.GUARDIAN.GUARDIAN_DELEGATORS_REQUEST,
            payload: {
                key,
                address: guardian,
                chain: CHAINS.ETHEREUM,
                requestId,
                append: false
            }
        });
        state = guardiansReducer(state, request('old'));
        state = guardiansReducer(state, request('new'));

        const beforeStaleResponse = state;
        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_DELEGATORS_SUCCESS,
            payload: { key, requestId: 'old', append: false, data: page([firstItem]) }
        });
        expect(state).toBe(beforeStaleResponse);

        state = guardiansReducer(state, {
            type: types.GUARDIAN.GUARDIAN_DELEGATORS_SUCCESS,
            payload: { key, requestId: 'new', append: false, data: page([firstItem]) }
        });
        expect(state.delegatorsByKey[key].items).toEqual([firstItem]);
    });

    it('reuses a loaded first page per chain and address', async () => {
        let state = guardiansReducer(undefined, { type: '@@init' });
        let chain = CHAINS.ETHEREUM;
        const appState = () => ({
            main: { chain, web3: {} },
            guardians: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = guardiansReducer(state, action);
            return action;
        };
        const original = api.getGuardianDelegatorsPageApi;
        let calls = 0;
        api.getGuardianDelegatorsPageApi = async () => {
            calls += 1;
            return page([firstItem]);
        };

        try {
            await dispatch(loadGuardianDelegatorsPage(guardian, {}));
            await dispatch(loadGuardianDelegatorsPage(guardian, {}));
            expect(calls).toBe(1);

            chain = CHAINS.POLYGON;
            await dispatch(loadGuardianDelegatorsPage(guardian, {}));
            expect(calls).toBe(2);
            expect(Object.keys(state.delegatorsByKey).sort()).toEqual([
                `${CHAINS.ETHEREUM}:${guardian}`,
                `${CHAINS.POLYGON}:${guardian}`
            ].sort());
        } finally {
            api.getGuardianDelegatorsPageApi = original;
        }
    });

    it('refreshes a cached first page after its TTL expires', async () => {
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
        const original = api.getGuardianDelegatorsPageApi;
        let calls = 0;
        api.getGuardianDelegatorsPageApi = async () => {
            calls += 1;
            return page([firstItem]);
        };

        try {
            await dispatch(loadGuardianDelegatorsPage(guardian, {}));
            now.mockReturnValue(2_000_000 + GUARDIAN_DELEGATORS_CACHE_TTL_MS - 1);
            await dispatch(loadGuardianDelegatorsPage(guardian, {}));
            expect(calls).toBe(1);
            now.mockReturnValue(2_000_000 + GUARDIAN_DELEGATORS_CACHE_TTL_MS);
            await dispatch(loadGuardianDelegatorsPage(guardian, {}));
            expect(calls).toBe(2);
        } finally {
            now.mockRestore();
            api.getGuardianDelegatorsPageApi = original;
        }
    });

    it('restores a persisted page after Redux reset without another query while fresh', async () => {
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
        const original = api.getGuardianDelegatorsPageApi;
        let calls = 0;
        api.getGuardianDelegatorsPageApi = async () => {
            calls += 1;
            return page([firstItem], 'next', 2);
        };

        try {
            await dispatch(loadGuardianDelegatorsPage(guardian, {}));
            state = guardiansReducer(undefined, { type: '@@init' });
            await dispatch(loadGuardianDelegatorsPage(guardian, {}));

            const key = getGuardianDelegatorsKey(CHAINS.ETHEREUM, guardian);
            expect(calls).toBe(1);
            expect(state.delegatorsByKey[key]).toMatchObject({
                status: 'loaded',
                items: [firstItem],
                total: 2,
                nextCursor: 'next',
                asOfBlock: 200
            });
        } finally {
            api.getGuardianDelegatorsPageApi = original;
        }
    });

    it('refreshes a persisted page from its cached snapshot after browser reload', async () => {
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
        const originalApi = api.getGuardianDelegatorsPageApi;
        const originalPath = window.location.pathname;
        const navigationDescriptor = Object.getOwnPropertyDescriptor(window.performance, 'getEntriesByType');
        let calls = 0;
        let receivedSnapshot: any;
        api.getGuardianDelegatorsPageApi = async (_address, _web3, _cursor, _signal, cachedSnapshot) => {
            calls += 1;
            receivedSnapshot = cachedSnapshot;
            return calls === 1
                ? page([firstItem], undefined, 1, 200)
                : page([{ ...firstItem, stake: 120, last_change_block: 205 }], undefined, 1, 210);
        };

        try {
            await dispatch(loadGuardianDelegatorsPage(guardian, {}));
            state = guardiansReducer(undefined, { type: '@@init' });
            window.history.replaceState({}, '', `/ethereum/guardians/delegators/${guardian}`);
            Object.defineProperty(window.performance, 'getEntriesByType', {
                configurable: true,
                value: (entryType: string) => entryType === 'navigation' ? [{ type: 'reload' }] : []
            });

            await dispatch(loadGuardianDelegatorsPage(guardian, {}));

            const key = getGuardianDelegatorsKey(CHAINS.ETHEREUM, guardian);
            expect(calls).toBe(2);
            expect(receivedSnapshot).toMatchObject({
                guardian_address: guardian,
                chain_id: 1,
                as_of_block: 200
            });
            expect(state.delegatorsByKey[key]).toMatchObject({
                status: 'loaded',
                asOfBlock: 210,
                total: 1
            });
            expect(state.delegatorsByKey[key].items[0].stake).toBe(120);
        } finally {
            api.getGuardianDelegatorsPageApi = originalApi;
            window.history.replaceState({}, '', originalPath);
            if (navigationDescriptor) {
                Object.defineProperty(window.performance, 'getEntriesByType', navigationDescriptor);
            } else {
                delete (window.performance as any).getEntriesByType;
            }
            resetGuardianReloadRefreshTracking();
        }
    });

    it('aborts and invalidates an in-flight request on tab unmount', async () => {
        let state = guardiansReducer(undefined, { type: '@@init' });
        const key = getGuardianDelegatorsKey(CHAINS.ETHEREUM, guardian);
        const appState = () => ({
            main: { chain: CHAINS.ETHEREUM, web3: {} },
            guardians: state
        } as any);
        const dispatch: any = async (action: any): Promise<any> => {
            if (typeof action === 'function') return action(dispatch, appState);
            state = guardiansReducer(state, action);
            return action;
        };
        const original = api.getGuardianDelegatorsPageApi;
        let requestSignal: AbortSignal | undefined;
        api.getGuardianDelegatorsPageApi = async (_address, _web3, _cursor, signal) => {
            requestSignal = signal;
            return new Promise<undefined>((resolve) => {
                if (!signal) return resolve(undefined);
                signal.addEventListener('abort', () => resolve(undefined));
            });
        };

        try {
            const pending = dispatch(loadGuardianDelegatorsPage(guardian, {}));
            dispatch(cancelGuardianDelegatorsRequest(key));
            await pending;

            expect(requestSignal && requestSignal.aborted).toBe(true);
            expect(state.delegatorsByKey[key].status).toBe('idle');
        } finally {
            api.getGuardianDelegatorsPageApi = original;
        }
    });
});
