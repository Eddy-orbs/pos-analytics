import {
    DelegatorCurrent,
    DelegatorStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { Dispatch } from 'redux';
import { ChartData } from '../../global/types';
import { api } from '../../services/api';
import { CHAINS } from '../../types';
import { DetailHistoryUnit } from '../types/detail-types';
import { AppState, types } from '../types/types';
import {
    DETAIL_CURRENT_CACHE_TTL_MS,
    DETAIL_HISTORY_CACHE_TTL_MS,
    detailLoadErrorMessage,
    getDetailHistoryKey,
    getDetailHistorySampleTimestamps,
    getDetailHistoryStartTime,
    getDetailKey,
    isDetailCacheFresh,
    isDetailHistoryUnit,
    nextDetailRequestId,
    normalizeDetailAddress
} from './detail-history';

let activeDelegatorHistoryRequest: {
    key: string;
    detailKey: string;
    unit: DetailHistoryUnit;
    requestId: string;
    controller: AbortController;
} | undefined;
const activeDelegatorCurrentRequests: {
    [key: string]: Promise<DelegatorCurrent | undefined> | undefined;
} = Object.create(null);

const cancelActiveDelegatorHistoryRequest = (dispatch: any): void => {
    const active = activeDelegatorHistoryRequest;
    if (!active) return;
    activeDelegatorHistoryRequest = undefined;
    active.controller.abort();
    dispatch({
        type: types.DELEGATOR.DELEGATOR_HISTORY_CANCELLED,
        payload: {
            key: active.key,
            detailKey: active.detailKey,
            unit: active.unit,
            requestId: active.requestId
        }
    });
};

const abortDelegatorHistoryExcept = (dispatch: any, key: string): void => {
    if (activeDelegatorHistoryRequest && activeDelegatorHistoryRequest.key !== key) {
        cancelActiveDelegatorHistoryRequest(dispatch);
    }
};

const abortDelegatorHistoryForOtherDetail = (dispatch: any, detailKey: string): void => {
    if (activeDelegatorHistoryRequest && activeDelegatorHistoryRequest.detailKey !== detailKey) {
        cancelActiveDelegatorHistoryRequest(dispatch);
    }
};

const clearDelegatorHistoryRequest = (key: string, controller: AbortController): void => {
    if (activeDelegatorHistoryRequest &&
        activeDelegatorHistoryRequest.key === key &&
        activeDelegatorHistoryRequest.controller === controller) {
        activeDelegatorHistoryRequest = undefined;
    }
};

export const cancelDelegatorHistoryRequest = () => (dispatch: any): void => {
    cancelActiveDelegatorHistoryRequest(dispatch);
};

const ensureDelegatorCurrent = async (
    normalizedAddress: string,
    web3: any,
    chain: CHAINS,
    key: string,
    dispatch: any,
    getState: () => AppState
): Promise<DelegatorCurrent | undefined> => {
    const currentEntry = getState().delegator.currentByKey[key];
    if (isDetailCacheFresh(currentEntry, DETAIL_CURRENT_CACHE_TTL_MS)) return currentEntry && currentEntry.data;
    if (currentEntry && currentEntry.status === 'loading') {
        return activeDelegatorCurrentRequests[key] || currentEntry.data;
    }

    const requestId = nextDetailRequestId(`delegator-current:${key}`);
    dispatch({
        type: types.DELEGATOR.DELEGATOR_CURRENT_REQUEST,
        payload: { key, address: normalizedAddress, chain, requestId }
    });
    const operation = (async (): Promise<DelegatorCurrent | undefined> => {
        let current: DelegatorCurrent;
        try {
            current = await api.getDelegatorCurrentApi(normalizedAddress, web3);
        } catch (error) {
            dispatch({
                type: types.DELEGATOR.DELEGATOR_CURRENT_FAILURE,
                payload: {
                    key,
                    requestId,
                    notFound: false,
                    error: detailLoadErrorMessage(error, 'Unable to load Delegator')
                }
            });
            return undefined;
        }
        dispatch({
            type: types.DELEGATOR.DELEGATOR_CURRENT_SUCCESS,
            payload: { key, requestId, data: current, loadedAt: Date.now() }
        });
        return current;
    })();
    activeDelegatorCurrentRequests[key] = operation;
    try {
        return await operation;
    } finally {
        if (activeDelegatorCurrentRequests[key] === operation) delete activeDelegatorCurrentRequests[key];
    }
};

export const loadDelegatorHistory = (address: string, web3: any, unit: DetailHistoryUnit) =>
    async (dispatch: any, getState: () => AppState): Promise<DelegatorStakeHistory | undefined> => {
        if (!isDetailHistoryUnit(unit)) throw new Error(`Unsupported Delegator history unit: ${unit}`);
        const normalizedAddress = normalizeDetailAddress(address);
        const chain = getState().main.chain;
        const detailKey = getDetailKey(chain, normalizedAddress);
        const key = getDetailHistoryKey(chain, normalizedAddress, unit);
        abortDelegatorHistoryExcept(dispatch, key);

        dispatch({
            type: types.DELEGATOR.SELECT_DELEGATOR_HISTORY,
            payload: { detailKey, key, unit }
        });

        const cached = getState().delegator.historyByKey[key];
        if (isDetailCacheFresh(cached, DETAIL_HISTORY_CACHE_TTL_MS)) return cached && cached.data;
        if (cached && cached.status === 'loading') return undefined;

        const requestId = nextDetailRequestId(`delegator-history:${key}`);
        const controller = new AbortController();
        activeDelegatorHistoryRequest = { key, detailKey, unit, requestId, controller };
        dispatch({
            type: types.DELEGATOR.DELEGATOR_HISTORY_REQUEST,
            payload: { detailKey, key, address: normalizedAddress, chain, unit, requestId }
        });

        const current = await ensureDelegatorCurrent(
            normalizedAddress,
            web3,
            chain,
            detailKey,
            dispatch,
            getState
        );
        if (controller.signal.aborted) {
            clearDelegatorHistoryRequest(key, controller);
            return undefined;
        }
        if (!current) {
            dispatch({
                type: types.DELEGATOR.DELEGATOR_HISTORY_FAILURE,
                payload: {
                    key,
                    detailKey,
                    unit,
                    requestId,
                    error: 'Unable to refresh Delegator current state'
                }
            });
            clearDelegatorHistoryRequest(key, controller);
            return undefined;
        }
        const asOfTime = current.block_time;
        const fromTime = getDetailHistoryStartTime(unit, asOfTime);
        const sampleTimestamps = getDetailHistorySampleTimestamps(unit, asOfTime);
        const fromBlock = await api.resolveHistoryStartBlockApi(web3, fromTime, controller.signal);
        if (fromBlock === undefined) {
            const cancelled = controller.signal.aborted;
            dispatch({
                type: cancelled
                    ? types.DELEGATOR.DELEGATOR_HISTORY_CANCELLED
                    : types.DELEGATOR.DELEGATOR_HISTORY_FAILURE,
                payload: {
                    key,
                    detailKey,
                    unit,
                    requestId,
                    error: cancelled ? undefined : 'Unable to resolve Delegator history start block'
                }
            });
            clearDelegatorHistoryRequest(key, controller);
            return undefined;
        }

        const history = await api.getDelegatorStakeHistoryApi(
            normalizedAddress,
            web3,
            fromBlock,
            controller.signal,
            sampleTimestamps,
            current
        );
        if (!history) {
            const cancelled = controller.signal.aborted;
            dispatch({
                type: cancelled
                    ? types.DELEGATOR.DELEGATOR_HISTORY_CANCELLED
                    : types.DELEGATOR.DELEGATOR_HISTORY_FAILURE,
                payload: {
                    key,
                    detailKey,
                    unit,
                    requestId,
                    error: cancelled ? undefined : 'Unable to load Delegator stake history'
                }
            });
            clearDelegatorHistoryRequest(key, controller);
            return undefined;
        }

        dispatch({
            type: types.DELEGATOR.DELEGATOR_HISTORY_SUCCESS,
            payload: { key, detailKey, unit, requestId, data: history, loadedAt: Date.now() }
        });
        clearDelegatorHistoryRequest(key, controller);
        return history;
    };

/** UI-compatible current-only detail loader. The Stake chart loads history. */
export const findDelegatorAction = (address: string, web3: any, _legacyBlockRef?: unknown) =>
    async (dispatch: any, getState: () => AppState): Promise<DelegatorCurrent | undefined> => {
        const normalizedAddress = normalizeDetailAddress(address);
        const chain = getState().main.chain;
        const key = getDetailKey(chain, normalizedAddress);
        abortDelegatorHistoryForOtherDetail(dispatch, key);
        dispatch({
            type: types.DELEGATOR.SELECT_DELEGATOR_DETAIL,
            payload: { key }
        });

        return ensureDelegatorCurrent(normalizedAddress, web3, chain, key, dispatch, getState);
    };

export const setDelegatorLoading = (value: boolean) => async (dispatch: any) => dispatch({
    type: types.DELEGATOR.DELEGATOR_LOADING,
    payload: value
});

export const delegatorNotFound = (value: boolean) => async (dispatch: any) => dispatch({
    type: types.DELEGATOR.DELEGATOR_NOT_FOUND,
    payload: value
});

export const setDelegatorChartData = (chartData: ChartData | undefined) => async (dispatch: Dispatch<any>) => dispatch({
    type: types.DELEGATOR.SET_DELEGATOR_CHART_DATA,
    payload: chartData
});

export const resetDelegator = () => async (dispatch: any) => dispatch({
    type: types.DELEGATOR.RESET_DELEGATOR
});
