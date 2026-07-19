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
    currentByKey: {},
    historyByKey: {}
};

const historyKey = (detailKey: string, unit: string): string => `${detailKey}:${unit}`;

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

const selectedFor = (state: DelegatorState, detailKey: string, unit: string): DelegatorInfo | undefined => {
    const current = state.currentByKey[detailKey];
    if (!current || current.status !== 'loaded' || !current.data) return undefined;
    const history = state.historyByKey[historyKey(detailKey, unit)];
    return toDelegatorInfo(current.data, history && history.status === 'loaded' ? history.data : undefined);
};

export const delegatorReducer = (state = initialState, { payload, type }: any): DelegatorState => {
    switch (type) {
        case types.DELEGATOR.SELECT_DELEGATOR_DETAIL: {
            const key = payload.key;
            const current = state.currentByKey[key];
            const unit = DEFAULT_DELEGATOR_HISTORY_UNIT;
            const history = state.historyByKey[historyKey(key, unit)];
            return {
                ...state,
                activeDelegatorKey: key,
                activeDelegatorHistoryUnit: unit,
                selectedDelegator: selectedFor(state, key, unit),
                delegatorCurrent: current && current.status === 'loaded' ? current.data : undefined,
                delegatorNotFound: !!current && current.status === 'error' && !!current.notFound,
                delegatorIsLoading: !current || current.status === 'loading' || current.status === 'idle',
                delegatorCurrentError: current && current.status === 'error' && !current.notFound
                    ? current.error
                    : undefined,
                delegatorHistoryIsLoading: !!history && history.status === 'loading',
                delegatorHistoryError: history && history.status === 'error' ? history.error : undefined,
                delegatorChartData: undefined
            };
        }
        case types.DELEGATOR.DELEGATOR_CURRENT_REQUEST: {
            const entry = {
                key: payload.key,
                address: payload.address,
                chain: payload.chain,
                requestId: payload.requestId,
                status: 'loading' as const
            };
            return {
                ...state,
                currentByKey: { ...state.currentByKey, [payload.key]: entry },
                delegatorNotFound: state.activeDelegatorKey === payload.key ? false : state.delegatorNotFound,
                delegatorIsLoading: state.activeDelegatorKey === payload.key ? true : state.delegatorIsLoading,
                delegatorCurrentError: state.activeDelegatorKey === payload.key ? undefined : state.delegatorCurrentError
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
                selectedDelegator: selectedFor(next, payload.key, state.activeDelegatorHistoryUnit),
                delegatorNotFound: false,
                delegatorIsLoading: false,
                delegatorCurrentError: undefined
            };
        }
        case types.DELEGATOR.DELEGATOR_CURRENT_FAILURE: {
            const pending = state.currentByKey[payload.key];
            if (!pending || pending.key !== payload.key || pending.requestId !== payload.requestId) return state;
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
            const entry = state.historyByKey[payload.key];
            return {
                ...state,
                activeDelegatorHistoryUnit: payload.unit,
                selectedDelegator: selectedFor(state, payload.detailKey, payload.unit),
                delegatorHistoryIsLoading: !!entry && entry.status === 'loading',
                delegatorHistoryError: entry && entry.status === 'error' ? entry.error : undefined,
                delegatorChartData: state.activeDelegatorHistoryUnit === payload.unit
                    ? state.delegatorChartData
                    : undefined
            };
        }
        case types.DELEGATOR.DELEGATOR_HISTORY_REQUEST: {
            const entry = {
                key: payload.key,
                detailKey: payload.detailKey,
                address: payload.address,
                chain: payload.chain,
                unit: payload.unit,
                requestId: payload.requestId,
                status: 'loading' as const
            };
            const active = state.activeDelegatorKey === payload.detailKey &&
                state.activeDelegatorHistoryUnit === payload.unit;
            return {
                ...state,
                historyByKey: { ...state.historyByKey, [payload.key]: entry },
                delegatorHistoryIsLoading: active ? true : state.delegatorHistoryIsLoading,
                delegatorHistoryError: active ? undefined : state.delegatorHistoryError
            };
        }
        case types.DELEGATOR.DELEGATOR_HISTORY_SUCCESS: {
            const pending = state.historyByKey[payload.key];
            if (!pending || pending.key !== payload.key || pending.requestId !== payload.requestId) return state;
            const historyByKey = {
                ...state.historyByKey,
                [payload.key]: {
                    ...pending,
                    status: 'loaded' as const,
                    data: payload.data,
                    error: undefined,
                    loadedAt: payload.loadedAt === undefined ? Date.now() : payload.loadedAt
                }
            };
            const next = { ...state, historyByKey };
            const active = state.activeDelegatorKey === payload.detailKey &&
                state.activeDelegatorHistoryUnit === payload.unit;
            if (!active) return next;
            return {
                ...next,
                selectedDelegator: selectedFor(next, payload.detailKey, payload.unit),
                delegatorHistoryIsLoading: false,
                delegatorHistoryError: undefined
            };
        }
        case types.DELEGATOR.DELEGATOR_HISTORY_FAILURE: {
            const pending = state.historyByKey[payload.key];
            if (!pending || pending.key !== payload.key || pending.requestId !== payload.requestId) return state;
            const historyByKey = {
                ...state.historyByKey,
                [payload.key]: { ...pending, status: 'error' as const, data: undefined, error: payload.error }
            };
            const active = state.activeDelegatorKey === payload.detailKey &&
                state.activeDelegatorHistoryUnit === payload.unit;
            return {
                ...state,
                historyByKey,
                delegatorHistoryIsLoading: active ? false : state.delegatorHistoryIsLoading,
                delegatorHistoryError: active ? payload.error : state.delegatorHistoryError
            };
        }
        case types.DELEGATOR.DELEGATOR_HISTORY_CANCELLED: {
            const pending = state.historyByKey[payload.key];
            if (!pending || pending.key !== payload.key || pending.requestId !== payload.requestId) return state;
            const historyByKey = {
                ...state.historyByKey,
                [payload.key]: {
                    ...pending,
                    requestId: undefined,
                    status: 'idle' as const,
                    data: undefined,
                    error: undefined
                }
            };
            const active = state.activeDelegatorKey === payload.detailKey &&
                state.activeDelegatorHistoryUnit === payload.unit;
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
