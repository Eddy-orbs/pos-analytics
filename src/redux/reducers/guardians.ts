import {
    GuardianCurrent,
    GuardianDelegatorPageItem,
    GuardianInfo,
    GuardianStakeHistory
} from '@orbs-network/pos-analytics-lib';
import {
    DEFAULT_GUARDIAN_HISTORY_UNIT,
    GuardiansState
} from '../types/guardians-types';
import { types } from '../types/types';

const initialState: GuardiansState = {
    selectedGuardian: undefined,
    guardianCurrent: undefined,
    guardians: undefined,
    guardianNotFound: false,
    guardianIsLoading: true,
    guardianCurrentError: undefined,
    guardianHistoryIsLoading: false,
    guardianHistoryError: undefined,
    guardianChartData: undefined,
    guardiansColors: undefined,
    activeGuardianKey: undefined,
    activeGuardianHistoryUnit: DEFAULT_GUARDIAN_HISTORY_UNIT,
    historyUnitByKey: {},
    currentByKey: {},
    historyByKey: {},
    delegatorsByKey: {}
};

const toGuardianInfo = (current: GuardianCurrent, history?: GuardianStakeHistory): GuardianInfo => ({
    address: current.address,
    block_number: current.block_number,
    block_time: current.block_time,
    read_from_block: history ? history.range.from_block : current.block_number,
    details: {
        ...current.details,
        certified: false
    },
    stake_status: current.stake_status,
    reward_status: {
        guardian_rewards_balance: 0,
        guardian_rewards_claimed: 0,
        total_guardian_rewards: 0,
        delegator_rewards_balance: 0,
        delegator_rewards_claimed: 0,
        total_delegator_rewards: 0,
        fees_balance: 0,
        fees_claimed: 0,
        total_fees: 0,
        bootstrap_balance: 0,
        bootstrap_claimed: 0,
        total_bootstrap: 0,
        delegator_reward_share: current.reward_status.delegator_reward_share
    },
    stake_slices: history ? history.stake_slices : [],
    actions: [],
    reward_as_guardian_slices: [],
    reward_as_delegator_slices: [],
    fees_slices: [],
    bootstrap_slices: [],
    delegators: [],
    delegators_left: []
});

const selectedFor = (state: GuardiansState, detailKey: string): GuardianInfo | undefined => {
    const current = state.currentByKey[detailKey];
    if (!current || !current.data) return undefined;
    const history = state.historyByKey[detailKey];
    return toGuardianInfo(current.data, history && history.data);
};

const appendUniqueDelegators = (
    existing: GuardianDelegatorPageItem[],
    incoming: GuardianDelegatorPageItem[]
): GuardianDelegatorPageItem[] => {
    const result = existing.slice();
    const indexByAddress: { [address: string]: number } = Object.create(null);
    result.forEach((item, index) => {
        indexByAddress[item.address.toLowerCase()] = index;
    });
    incoming.forEach((item) => {
        const address = item.address.toLowerCase();
        const existingIndex = indexByAddress[address];
        if (existingIndex === undefined) {
            indexByAddress[address] = result.length;
            result.push(item);
        } else {
            result[existingIndex] = item;
        }
    });
    return result;
};

export const guardiansReducer = (state = initialState, { payload, type }: any): GuardiansState => {
    switch (type) {
        case types.GUARDIAN.GUARDIAN_DETAIL_HYDRATE: {
            const existingCurrent = state.currentByKey[payload.key];
            const existingHistory = state.historyByKey[payload.key];
            const existingDelegators = state.delegatorsByKey[payload.key];
            const currentByKey = payload.current && (!existingCurrent || !existingCurrent.data)
                ? {
                    ...state.currentByKey,
                    [payload.key]: {
                        key: payload.key,
                        address: payload.address,
                        chain: payload.chain,
                        status: 'loaded' as const,
                        data: payload.current.data,
                        loadedAt: payload.current.loadedAt,
                        error: undefined,
                        notFound: false
                    }
                }
                : state.currentByKey;
            const historyByKey = payload.history && (!existingHistory || !existingHistory.data)
                ? {
                    ...state.historyByKey,
                    [payload.key]: {
                        key: payload.key,
                        detailKey: payload.key,
                        address: payload.address,
                        chain: payload.chain,
                        status: 'loaded' as const,
                        data: payload.history.data,
                        coveredFromTime: payload.history.coveredFromTime,
                        latestBlock: payload.history.latestBlock,
                        loadedAt: payload.history.loadedAt,
                        error: undefined
                    }
                }
                : state.historyByKey;
            const delegatorsByKey = payload.delegators && !existingDelegators
                ? {
                    ...state.delegatorsByKey,
                    [payload.key]: {
                        key: payload.key,
                        address: payload.address,
                        chain: payload.chain,
                        status: 'loaded' as const,
                        items: payload.delegators.items,
                        total: payload.delegators.total,
                        nextCursor: payload.delegators.nextCursor,
                        asOfBlock: payload.delegators.asOfBlock,
                        cacheSnapshot: payload.delegators.cacheSnapshot,
                        loadedAt: payload.delegators.loadedAt,
                        error: undefined
                    }
                }
                : state.delegatorsByKey;
            const next = { ...state, currentByKey, historyByKey, delegatorsByKey };
            if (state.activeGuardianKey !== payload.key) return next;
            const current = currentByKey[payload.key];
            const history = historyByKey[payload.key];
            return {
                ...next,
                guardianCurrent: current && current.data,
                selectedGuardian: selectedFor(next, payload.key),
                guardianNotFound: false,
                guardianIsLoading: !current || !current.data,
                guardianCurrentError: undefined,
                guardianHistoryIsLoading: false,
                guardianHistoryError: history && history.status === 'error' ? history.error : undefined
            };
        }
        case types.GUARDIAN.SELECT_GUARDIAN_DETAIL: {
            const key = payload.key;
            const current = state.currentByKey[key];
            const unit = state.historyUnitByKey[key] || DEFAULT_GUARDIAN_HISTORY_UNIT;
            const history = state.historyByKey[key];
            return {
                ...state,
                activeGuardianKey: key,
                activeGuardianHistoryUnit: unit,
                selectedGuardian: selectedFor(state, key),
                guardianCurrent: current && current.data,
                guardianNotFound: !!current && !current.data && current.status === 'error' && !!current.notFound,
                guardianIsLoading: !current || (!current.data && (current.status === 'loading' || current.status === 'idle')),
                guardianCurrentError: current && !current.data && current.status === 'error' && !current.notFound
                    ? current.error
                    : undefined,
                guardianHistoryIsLoading: !!history && !history.data && history.status === 'loading',
                guardianHistoryError: history && !history.data && history.status === 'error' ? history.error : undefined,
                guardianChartData: undefined
            };
        }
        case types.GUARDIAN.GUARDIAN_CURRENT_REQUEST: {
            const existing = state.currentByKey[payload.key];
            const entry = {
                ...existing,
                key: payload.key,
                address: payload.address,
                chain: payload.chain,
                requestId: payload.requestId,
                status: 'loading' as const,
                error: undefined,
                notFound: false
            };
            const currentByKey = { ...state.currentByKey, [payload.key]: entry };
            const next = { ...state, currentByKey };
            const active = state.activeGuardianKey === payload.key;
            return {
                ...next,
                guardianCurrent: active && entry.data ? entry.data : state.guardianCurrent,
                selectedGuardian: active && entry.data
                    ? selectedFor(next, payload.key)
                    : state.selectedGuardian,
                guardianNotFound: active ? false : state.guardianNotFound,
                guardianIsLoading: active ? !entry.data : state.guardianIsLoading,
                guardianCurrentError: active ? undefined : state.guardianCurrentError
            };
        }
        case types.GUARDIAN.GUARDIAN_CURRENT_SUCCESS: {
            const pending = state.currentByKey[payload.key];
            if (!pending || pending.key !== payload.key || pending.requestId !== payload.requestId) return state;
            const currentByKey = {
                ...state.currentByKey,
                [payload.key]: {
                    ...pending,
                    status: 'loaded' as const,
                    data: payload.data,
                    error: undefined,
                    notFound: false,
                    loadedAt: payload.loadedAt === undefined ? Date.now() : payload.loadedAt
                }
            };
            const next = { ...state, currentByKey };
            if (state.activeGuardianKey !== payload.key) return next;
            return {
                ...next,
                guardianCurrent: payload.data,
                selectedGuardian: selectedFor(next, payload.key),
                guardianNotFound: false,
                guardianIsLoading: false,
                guardianCurrentError: undefined
            };
        }
        case types.GUARDIAN.GUARDIAN_CURRENT_FAILURE: {
            const pending = state.currentByKey[payload.key];
            if (!pending || pending.key !== payload.key || pending.requestId !== payload.requestId) return state;
            if (pending.data) {
                const currentByKey = {
                    ...state.currentByKey,
                    [payload.key]: {
                        ...pending,
                        requestId: undefined,
                        status: 'loaded' as const,
                        error: payload.error,
                        notFound: false
                    }
                };
                const next = { ...state, currentByKey };
                if (state.activeGuardianKey !== payload.key) return next;
                return {
                    ...next,
                    guardianCurrent: pending.data,
                    selectedGuardian: selectedFor(next, payload.key),
                    guardianNotFound: false,
                    guardianIsLoading: false,
                    guardianCurrentError: payload.error
                };
            }
            const currentByKey = {
                ...state.currentByKey,
                [payload.key]: {
                    ...pending,
                    status: 'error' as const,
                    data: undefined,
                    error: payload.error,
                    notFound: !!payload.notFound,
                    loadedAt: undefined
                }
            };
            if (state.activeGuardianKey !== payload.key) return { ...state, currentByKey };
            return {
                ...state,
                currentByKey,
                guardianCurrent: undefined,
                selectedGuardian: undefined,
                guardianNotFound: !!payload.notFound,
                guardianIsLoading: false,
                guardianCurrentError: payload.notFound ? undefined : payload.error
            };
        }
        case types.GUARDIAN.SELECT_GUARDIAN_HISTORY: {
            if (state.activeGuardianKey !== payload.detailKey) return state;
            const entry = state.historyByKey[payload.detailKey];
            return {
                ...state,
                activeGuardianHistoryUnit: payload.unit,
                historyUnitByKey: { ...state.historyUnitByKey, [payload.detailKey]: payload.unit },
                selectedGuardian: selectedFor(state, payload.detailKey),
                guardianHistoryIsLoading: !!entry && !entry.data && entry.status === 'loading',
                guardianHistoryError: entry && !entry.data && entry.status === 'error' ? entry.error : undefined,
                guardianChartData: state.activeGuardianHistoryUnit === payload.unit
                    ? state.guardianChartData
                    : undefined
            };
        }
        case types.GUARDIAN.GUARDIAN_HISTORY_REQUEST: {
            const existing = state.historyByKey[payload.detailKey];
            const entry = {
                ...existing,
                key: payload.detailKey,
                detailKey: payload.detailKey,
                address: payload.address,
                chain: payload.chain,
                requestId: payload.requestId,
                status: 'loading' as const,
                error: undefined,
                targetFromTime: existing && typeof existing.targetFromTime === 'number'
                    ? Math.min(existing.targetFromTime, payload.targetFromTime)
                    : payload.targetFromTime
            };
            const active = state.activeGuardianKey === payload.detailKey;
            return {
                ...state,
                historyByKey: { ...state.historyByKey, [payload.detailKey]: entry },
                guardianHistoryIsLoading: active ? !entry.data : state.guardianHistoryIsLoading,
                guardianHistoryError: active ? undefined : state.guardianHistoryError
            };
        }
        case types.GUARDIAN.GUARDIAN_HISTORY_SUCCESS: {
            const pending = state.historyByKey[payload.detailKey];
            if (!pending || pending.key !== payload.detailKey || pending.requestId !== payload.requestId) return state;
            const historyByKey = {
                ...state.historyByKey,
                [payload.detailKey]: {
                    ...pending,
                    status: payload.complete === false ? 'loading' as const : 'loaded' as const,
                    data: payload.data,
                    error: undefined,
                    coveredFromTime: pending.coveredFromTime === undefined
                        ? payload.coveredFromTime
                        : Math.min(pending.coveredFromTime, payload.coveredFromTime),
                    latestBlock: payload.data.range.to_block,
                    targetFromTime: payload.complete === false ? pending.targetFromTime : undefined,
                    loadedAt: payload.loadedAt === undefined ? Date.now() : payload.loadedAt
                }
            };
            const next = { ...state, historyByKey };
            const active = state.activeGuardianKey === payload.detailKey;
            if (!active) return next;
            return {
                ...next,
                selectedGuardian: selectedFor(next, payload.detailKey),
                guardianHistoryIsLoading: payload.complete === false,
                guardianHistoryError: undefined
            };
        }
        case types.GUARDIAN.GUARDIAN_HISTORY_FAILURE: {
            const pending = state.historyByKey[payload.detailKey];
            if (!pending || pending.key !== payload.detailKey || pending.requestId !== payload.requestId) return state;
            const historyByKey = {
                ...state.historyByKey,
                [payload.detailKey]: pending.data
                    ? {
                        ...pending,
                        requestId: undefined,
                        status: 'loaded' as const,
                        error: payload.error,
                        targetFromTime: undefined
                    }
                    : {
                        ...pending,
                        requestId: undefined,
                        status: 'error' as const,
                        data: undefined,
                        error: payload.error,
                        targetFromTime: undefined
                    }
            };
            const active = state.activeGuardianKey === payload.detailKey;
            return {
                ...state,
                historyByKey,
                guardianHistoryIsLoading: active ? false : state.guardianHistoryIsLoading,
                guardianHistoryError: active ? (pending.data ? undefined : payload.error) : state.guardianHistoryError
            };
        }
        case types.GUARDIAN.GUARDIAN_HISTORY_CANCELLED: {
            const pending = state.historyByKey[payload.detailKey];
            if (!pending || pending.key !== payload.detailKey || pending.requestId !== payload.requestId) return state;
            const historyByKey = {
                ...state.historyByKey,
                [payload.detailKey]: {
                    ...pending,
                    requestId: undefined,
                    status: pending.data ? 'loaded' as const : 'idle' as const,
                    error: undefined,
                    targetFromTime: undefined
                }
            };
            const active = state.activeGuardianKey === payload.detailKey;
            return {
                ...state,
                historyByKey,
                guardianHistoryIsLoading: active ? false : state.guardianHistoryIsLoading,
                guardianHistoryError: active ? undefined : state.guardianHistoryError
            };
        }
        case types.GUARDIAN.GUARDIAN_DELEGATORS_REQUEST: {
            const existing = state.delegatorsByKey[payload.key];
            const preserveExisting = !!existing && (payload.append || payload.preserveExisting);
            const entry = {
                key: payload.key,
                address: payload.address,
                chain: payload.chain,
                requestId: payload.requestId,
                status: 'loading' as const,
                items: preserveExisting ? existing.items : [],
                total: preserveExisting ? existing.total : 0,
                nextCursor: preserveExisting ? existing.nextCursor : undefined,
                asOfBlock: preserveExisting ? existing.asOfBlock : undefined,
                cacheSnapshot: preserveExisting ? existing.cacheSnapshot : undefined,
                loadedAt: preserveExisting ? existing.loadedAt : undefined,
                error: undefined
            };
            return {
                ...state,
                delegatorsByKey: { ...state.delegatorsByKey, [payload.key]: entry }
            };
        }
        case types.GUARDIAN.GUARDIAN_DELEGATORS_SUCCESS: {
            const pending = state.delegatorsByKey[payload.key];
            if (!pending || pending.requestId !== payload.requestId) return state;
            const data = payload.data;
            const entry = {
                ...pending,
                requestId: undefined,
                status: 'loaded' as const,
                items: payload.append
                    ? appendUniqueDelegators(pending.items, data.items)
                    : data.items,
                total: data.total,
                nextCursor: data.next_cursor,
                asOfBlock: data.as_of_block,
                cacheSnapshot: data.cache_snapshot,
                error: undefined,
                loadedAt: payload.loadedAt === undefined ? Date.now() : payload.loadedAt
            };
            return {
                ...state,
                delegatorsByKey: { ...state.delegatorsByKey, [payload.key]: entry }
            };
        }
        case types.GUARDIAN.GUARDIAN_DELEGATORS_FAILURE: {
            const pending = state.delegatorsByKey[payload.key];
            if (!pending || pending.requestId !== payload.requestId) return state;
            const entry = {
                ...pending,
                requestId: undefined,
                status: 'error' as const,
                error: payload.error
            };
            return {
                ...state,
                delegatorsByKey: { ...state.delegatorsByKey, [payload.key]: entry }
            };
        }
        case types.GUARDIAN.GUARDIAN_DELEGATORS_CANCELLED: {
            const pending = state.delegatorsByKey[payload.key];
            if (!pending || pending.requestId !== payload.requestId) return state;
            const entry = {
                ...pending,
                requestId: undefined,
                status: pending.items.length > 0 ? 'loaded' as const : 'idle' as const,
                error: undefined
            };
            return {
                ...state,
                delegatorsByKey: { ...state.delegatorsByKey, [payload.key]: entry }
            };
        }
        case types.GUARDIAN.SET_GUARDIAN:
            return { ...state, selectedGuardian: payload };
        case types.GUARDIAN.SET_GUARDIANS: {
            const { guardiansColors, guardians } = payload;
            return { ...state, guardians, guardiansColors };
        }
        case types.GUARDIAN.GUARDIAN_NOT_FOUND:
            return { ...state, guardianNotFound: payload };
        case types.GUARDIAN.GUARDIAN_LOADING:
            return { ...state, guardianIsLoading: payload };
        case types.GUARDIAN.SET_GUARDIAN_CHART_DATA:
            return { ...state, guardianChartData: payload };
        case types.GUARDIAN.RESET_GUARDIAN:
            return {
                ...state,
                guardianChartData: undefined,
                selectedGuardian: undefined,
                guardianCurrent: undefined,
                activeGuardianKey: undefined,
                activeGuardianHistoryUnit: DEFAULT_GUARDIAN_HISTORY_UNIT,
                guardianNotFound: false,
                guardianIsLoading: true,
                guardianCurrentError: undefined,
                guardianHistoryIsLoading: false,
                guardianHistoryError: undefined
            };
        default:
            return state;
    }
};
