import {
    DelegatorCurrent,
    DelegatorInfo,
    DelegatorStakeHistory
} from '@orbs-network/pos-analytics-lib';
import {
    DEFAULT_DELEGATOR_HISTORY_UNIT,
    DelegatorState
} from '../types/delegator-types';
import { types } from '../types/types';

const initialState: DelegatorState = {
    selectedDelegator: undefined,
    delegatorCurrent: undefined,
    delegatorNotFound: false,
    delegatorIsLoading: true,
    delegatorCurrentError: undefined,
    delegatorHistoryIsLoading: false,
    delegatorHistoryError: undefined,
    delegatorChartData: undefined,
    activeDelegatorKey: undefined,
    activeDelegatorHistoryUnit: DEFAULT_DELEGATOR_HISTORY_UNIT,
    historyUnitByKey: {},
    currentByKey: {},
    historyByKey: {}
};

const toDelegatorInfo = (current: DelegatorCurrent, history?: DelegatorStakeHistory): DelegatorInfo => ({
    address: current.address,
    block_number: current.block_number,
    block_time: current.block_time,
    read_from_block: history ? history.range.from_block : current.block_number,
    total_stake: current.total_stake,
    cooldown_stake: current.cooldown_stake,
    current_cooldown_time: current.current_cooldown_time,
    non_stake: current.non_stake,
    delegated_to: current.delegated_to,
    rewards_balance: 0,
    rewards_claimed: 0,
    total_rewards: 0,
    stake_slices: history ? history.stake_slices : [],
    actions: [],
    reward_slices: []
});

const selectedFor = (state: DelegatorState, detailKey: string): DelegatorInfo | undefined => {
    const current = state.currentByKey[detailKey];
    if (!current || !current.data) return undefined;
    const history = state.historyByKey[detailKey];
    return toDelegatorInfo(current.data, history && history.data);
};

export const delegatorReducer = (state = initialState, { payload, type }: any): DelegatorState => {
    switch (type) {
        case types.DELEGATOR.DELEGATOR_DETAIL_HYDRATE: {
            const existingCurrent = state.currentByKey[payload.key];
            const existingHistory = state.historyByKey[payload.key];
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
            const next = { ...state, currentByKey, historyByKey };
            if (state.activeDelegatorKey !== payload.key) return next;
            const current = currentByKey[payload.key];
            const history = historyByKey[payload.key];
            return {
                ...next,
                delegatorCurrent: current && current.data,
                selectedDelegator: selectedFor(next, payload.key),
                delegatorNotFound: false,
                delegatorIsLoading: !current || !current.data,
                delegatorCurrentError: undefined,
                delegatorHistoryIsLoading: false,
                delegatorHistoryError: history && history.status === 'error' ? history.error : undefined
            };
        }
        case types.DELEGATOR.SELECT_DELEGATOR_DETAIL: {
            const key = payload.key;
            const current = state.currentByKey[key];
            const unit = state.historyUnitByKey[key] || DEFAULT_DELEGATOR_HISTORY_UNIT;
            const history = state.historyByKey[key];
            return {
                ...state,
                activeDelegatorKey: key,
                activeDelegatorHistoryUnit: unit,
                selectedDelegator: selectedFor(state, key),
                delegatorCurrent: current && current.data,
                delegatorNotFound: !!current && !current.data && current.status === 'error' && !!current.notFound,
                delegatorIsLoading: !current || (!current.data && (current.status === 'loading' || current.status === 'idle')),
                delegatorCurrentError: current && !current.data && current.status === 'error' && !current.notFound
                    ? current.error
                    : undefined,
                delegatorHistoryIsLoading: !!history && !history.data && history.status === 'loading',
                delegatorHistoryError: history && !history.data && history.status === 'error' ? history.error : undefined,
                delegatorChartData: undefined
            };
        }
        case types.DELEGATOR.DELEGATOR_CURRENT_REQUEST: {
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
            const active = state.activeDelegatorKey === payload.key;
            return {
                ...next,
                delegatorCurrent: active && entry.data ? entry.data : state.delegatorCurrent,
                selectedDelegator: active && entry.data ? selectedFor(next, payload.key) : state.selectedDelegator,
                delegatorNotFound: active ? false : state.delegatorNotFound,
                delegatorIsLoading: active ? !entry.data : state.delegatorIsLoading,
                delegatorCurrentError: active ? undefined : state.delegatorCurrentError
            };
        }
        case types.DELEGATOR.DELEGATOR_CURRENT_SUCCESS: {
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
            if (state.activeDelegatorKey !== payload.key) return next;
            return {
                ...next,
                delegatorCurrent: payload.data,
                selectedDelegator: selectedFor(next, payload.key),
                delegatorNotFound: false,
                delegatorIsLoading: false,
                delegatorCurrentError: undefined
            };
        }
        case types.DELEGATOR.DELEGATOR_CURRENT_FAILURE: {
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
                if (state.activeDelegatorKey !== payload.key) return next;
                return {
                    ...next,
                    delegatorCurrent: pending.data,
                    selectedDelegator: selectedFor(next, payload.key),
                    delegatorNotFound: false,
                    delegatorIsLoading: false,
                    delegatorCurrentError: payload.error
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
            if (state.activeDelegatorKey !== payload.key) return { ...state, currentByKey };
            return {
                ...state,
                currentByKey,
                delegatorCurrent: undefined,
                selectedDelegator: undefined,
                delegatorNotFound: !!payload.notFound,
                delegatorIsLoading: false,
                delegatorCurrentError: payload.notFound ? undefined : payload.error
            };
        }
        case types.DELEGATOR.SELECT_DELEGATOR_HISTORY: {
            if (state.activeDelegatorKey !== payload.detailKey) return state;
            const entry = state.historyByKey[payload.detailKey];
            return {
                ...state,
                activeDelegatorHistoryUnit: payload.unit,
                historyUnitByKey: { ...state.historyUnitByKey, [payload.detailKey]: payload.unit },
                selectedDelegator: selectedFor(state, payload.detailKey),
                delegatorHistoryIsLoading: !!entry && !entry.data && entry.status === 'loading',
                delegatorHistoryError: entry && !entry.data && entry.status === 'error' ? entry.error : undefined,
                delegatorChartData: state.activeDelegatorHistoryUnit === payload.unit
                    ? state.delegatorChartData
                    : undefined
            };
        }
        case types.DELEGATOR.DELEGATOR_HISTORY_REQUEST: {
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
            const active = state.activeDelegatorKey === payload.detailKey;
            return {
                ...state,
                historyByKey: { ...state.historyByKey, [payload.detailKey]: entry },
                delegatorHistoryIsLoading: active ? !entry.data : state.delegatorHistoryIsLoading,
                delegatorHistoryError: active ? undefined : state.delegatorHistoryError
            };
        }
        case types.DELEGATOR.DELEGATOR_HISTORY_SUCCESS: {
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
            const active = state.activeDelegatorKey === payload.detailKey;
            if (!active) return next;
            return {
                ...next,
                selectedDelegator: selectedFor(next, payload.detailKey),
                delegatorHistoryIsLoading: payload.complete === false,
                delegatorHistoryError: undefined
            };
        }
        case types.DELEGATOR.DELEGATOR_HISTORY_FAILURE: {
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
            const active = state.activeDelegatorKey === payload.detailKey;
            return {
                ...state,
                historyByKey,
                delegatorHistoryIsLoading: active ? false : state.delegatorHistoryIsLoading,
                delegatorHistoryError: active ? (pending.data ? undefined : payload.error) : state.delegatorHistoryError
            };
        }
        case types.DELEGATOR.DELEGATOR_HISTORY_CANCELLED: {
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
            const active = state.activeDelegatorKey === payload.detailKey;
            return {
                ...state,
                historyByKey,
                delegatorHistoryIsLoading: active ? false : state.delegatorHistoryIsLoading,
                delegatorHistoryError: active ? undefined : state.delegatorHistoryError
            };
        }
        case types.DELEGATOR.SET_DELEGATOR:
            return { ...state, selectedDelegator: payload };
        case types.DELEGATOR.DELEGATOR_LOADING:
            return { ...state, delegatorIsLoading: payload };
        case types.DELEGATOR.CLEAR_DELEGATOR:
            return { ...state, selectedDelegator: undefined, delegatorCurrent: undefined };
        case types.DELEGATOR.DELEGATOR_NOT_FOUND:
            return {
                ...state,
                delegatorNotFound: payload,
                selectedDelegator: payload ? undefined : state.selectedDelegator
            };
        case types.DELEGATOR.SET_DELEGATOR_CHART_DATA:
            return { ...state, delegatorChartData: payload };
        case types.DELEGATOR.RESET_DELEGATOR:
            return {
                ...state,
                delegatorChartData: undefined,
                selectedDelegator: undefined,
                delegatorCurrent: undefined,
                activeDelegatorKey: undefined,
                activeDelegatorHistoryUnit: DEFAULT_DELEGATOR_HISTORY_UNIT,
                delegatorNotFound: false,
                delegatorIsLoading: true,
                delegatorCurrentError: undefined,
                delegatorHistoryIsLoading: false,
                delegatorHistoryError: undefined
            };
        default:
            return state;
    }
};
