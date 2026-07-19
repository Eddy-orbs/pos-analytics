import {
    Guardian,
    GuardianCurrent,
    GuardianDelegatorsPage,
    GuardianStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { CHAINS } from 'types';
import { getChainConfig } from 'utils/chain';
import { getGuardianColor } from 'utils/overview/overview';
import { ChartData } from '../../global/types';
import { api } from '../../services/api';
import { DetailHistoryUnit } from '../types/detail-types';
import { AppState, types } from '../types/types';
import {
    DETAIL_CURRENT_CACHE_TTL_MS,
    DETAIL_HISTORY_CACHE_TTL_MS,
    GUARDIAN_DELEGATORS_CACHE_TTL_MS,
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

let activeGuardianHistoryRequest: {
    key: string;
    detailKey: string;
    unit: DetailHistoryUnit;
    requestId: string;
    controller: AbortController;
} | undefined;
const activeGuardianCurrentRequests: {
    [key: string]: Promise<GuardianCurrent | undefined> | undefined;
} = Object.create(null);
let activeGuardianDelegatorsRequest: {
    key: string;
    requestId: string;
    controller: AbortController;
} | undefined;

export const getGuardianDelegatorsKey = (chain: CHAINS, address: string): string =>
    getDetailKey(chain, normalizeDetailAddress(address));

const abortActiveGuardianDelegatorsRequest = (dispatch: any, key?: string): void => {
    const active = activeGuardianDelegatorsRequest;
    if (!active || (key && active.key !== key)) return;
    activeGuardianDelegatorsRequest = undefined;
    active.controller.abort();
    dispatch({
        type: types.GUARDIAN.GUARDIAN_DELEGATORS_CANCELLED,
        payload: { key: active.key, requestId: active.requestId }
    });
};

export const cancelGuardianDelegatorsRequest = (key?: string) => (dispatch: any): void => {
    abortActiveGuardianDelegatorsRequest(dispatch, key);
};

/**
 * Loads one Guardian delegator page only while the Delegators route is mounted.
 * First pages are cached by chain/address; cursor pages append to that cache.
 */
export const loadGuardianDelegatorsPage = (address: string, web3: any, cursor?: string) =>
    async (dispatch: any, getState: () => AppState): Promise<GuardianDelegatorsPage | undefined> => {
        const normalizedAddress = normalizeDetailAddress(address);
        const chain = getState().main.chain;
        const key = getGuardianDelegatorsKey(chain, normalizedAddress);

        if (activeGuardianDelegatorsRequest && activeGuardianDelegatorsRequest.key !== key) {
            abortActiveGuardianDelegatorsRequest(dispatch);
        }

        const cached = getState().guardians.delegatorsByKey[key];
        if (!cursor && isDetailCacheFresh(cached, GUARDIAN_DELEGATORS_CACHE_TTL_MS)) return undefined;
        if (cached && cached.status === 'loading') return undefined;
        // Ignore a delayed double click that still carries the previous page's
        // cursor after another request has already advanced the cache.
        if (cursor && cached && cached.nextCursor !== cursor) return undefined;

        if (activeGuardianDelegatorsRequest) abortActiveGuardianDelegatorsRequest(dispatch, key);
        const requestId = nextDetailRequestId(`guardian-delegators:${key}`);
        const controller = new AbortController();
        activeGuardianDelegatorsRequest = { key, requestId, controller };
        dispatch({
            type: types.GUARDIAN.GUARDIAN_DELEGATORS_REQUEST,
            payload: {
                key,
                address: normalizedAddress,
                chain,
                requestId,
                append: Boolean(cursor)
            }
        });

        const page = await api.getGuardianDelegatorsPageApi(
            normalizedAddress,
            web3,
            cursor,
            controller.signal
        );
        const cancelled = controller.signal.aborted;
        if (activeGuardianDelegatorsRequest &&
            activeGuardianDelegatorsRequest.key === key &&
            activeGuardianDelegatorsRequest.requestId === requestId) {
            activeGuardianDelegatorsRequest = undefined;
        }

        if (!page) {
            dispatch({
                type: cancelled
                    ? types.GUARDIAN.GUARDIAN_DELEGATORS_CANCELLED
                    : types.GUARDIAN.GUARDIAN_DELEGATORS_FAILURE,
                payload: {
                    key,
                    requestId,
                    error: cancelled ? undefined : 'Unable to load Guardian delegators'
                }
            });
            return undefined;
        }

        dispatch({
            type: types.GUARDIAN.GUARDIAN_DELEGATORS_SUCCESS,
            payload: { key, requestId, append: Boolean(cursor), data: page, loadedAt: Date.now() }
        });
        return page;
    };

const cancelActiveGuardianHistoryRequest = (dispatch: any): void => {
    const active = activeGuardianHistoryRequest;
    if (!active) return;
    activeGuardianHistoryRequest = undefined;
    active.controller.abort();
    dispatch({
        type: types.GUARDIAN.GUARDIAN_HISTORY_CANCELLED,
        payload: {
            key: active.key,
            detailKey: active.detailKey,
            unit: active.unit,
            requestId: active.requestId
        }
    });
};

const abortGuardianHistoryExcept = (dispatch: any, key: string): void => {
    if (activeGuardianHistoryRequest && activeGuardianHistoryRequest.key !== key) {
        cancelActiveGuardianHistoryRequest(dispatch);
    }
};

const abortGuardianHistoryForOtherDetail = (dispatch: any, detailKey: string): void => {
    if (activeGuardianHistoryRequest && activeGuardianHistoryRequest.detailKey !== detailKey) {
        cancelActiveGuardianHistoryRequest(dispatch);
    }
};

const clearGuardianHistoryRequest = (key: string, controller: AbortController): void => {
    if (activeGuardianHistoryRequest &&
        activeGuardianHistoryRequest.key === key &&
        activeGuardianHistoryRequest.controller === controller) {
        activeGuardianHistoryRequest = undefined;
    }
};

export const cancelGuardianHistoryRequest = () => (dispatch: any): void => {
    cancelActiveGuardianHistoryRequest(dispatch);
};

const ensureGuardianCurrent = async (
    normalizedAddress: string,
    web3: any,
    chain: CHAINS,
    key: string,
    dispatch: any,
    getState: () => AppState
): Promise<GuardianCurrent | undefined> => {
    const currentEntry = getState().guardians.currentByKey[key];
    if (isDetailCacheFresh(currentEntry, DETAIL_CURRENT_CACHE_TTL_MS)) return currentEntry && currentEntry.data;
    if (currentEntry && currentEntry.status === 'loading') {
        return activeGuardianCurrentRequests[key] || currentEntry.data;
    }

    const requestId = nextDetailRequestId(`guardian-current:${key}`);
    dispatch({
        type: types.GUARDIAN.GUARDIAN_CURRENT_REQUEST,
        payload: { key, address: normalizedAddress, chain, requestId }
    });
    const operation = (async (): Promise<GuardianCurrent | undefined> => {
        let current: GuardianCurrent;
        try {
            current = await api.getGuardianCurrentApi(normalizedAddress, web3);
        } catch (error) {
            dispatch({
                type: types.GUARDIAN.GUARDIAN_CURRENT_FAILURE,
                payload: {
                    key,
                    requestId,
                    notFound: false,
                    error: detailLoadErrorMessage(error, 'Unable to load Guardian')
                }
            });
            return undefined;
        }
        dispatch({
            type: types.GUARDIAN.GUARDIAN_CURRENT_SUCCESS,
            payload: { key, requestId, data: current, loadedAt: Date.now() }
        });
        return current;
    })();
    activeGuardianCurrentRequests[key] = operation;
    try {
        return await operation;
    } finally {
        if (activeGuardianCurrentRequests[key] === operation) delete activeGuardianCurrentRequests[key];
    }
};

export const loadGuardianHistory = (address: string, web3: any, unit: DetailHistoryUnit) =>
    async (dispatch: any, getState: () => AppState): Promise<GuardianStakeHistory | undefined> => {
        if (!isDetailHistoryUnit(unit)) throw new Error(`Unsupported Guardian history unit: ${unit}`);
        const normalizedAddress = normalizeDetailAddress(address);
        const chain = getState().main.chain;
        const detailKey = getDetailKey(chain, normalizedAddress);
        const key = getDetailHistoryKey(chain, normalizedAddress, unit);
        abortGuardianHistoryExcept(dispatch, key);

        dispatch({
            type: types.GUARDIAN.SELECT_GUARDIAN_HISTORY,
            payload: { detailKey, key, unit }
        });

        const cached = getState().guardians.historyByKey[key];
        if (isDetailCacheFresh(cached, DETAIL_HISTORY_CACHE_TTL_MS)) return cached && cached.data;
        if (cached && cached.status === 'loading') return undefined;

        const requestId = nextDetailRequestId(`guardian-history:${key}`);
        const controller = new AbortController();
        activeGuardianHistoryRequest = { key, detailKey, unit, requestId, controller };
        dispatch({
            type: types.GUARDIAN.GUARDIAN_HISTORY_REQUEST,
            payload: { detailKey, key, address: normalizedAddress, chain, unit, requestId }
        });

        const current = await ensureGuardianCurrent(
            normalizedAddress,
            web3,
            chain,
            detailKey,
            dispatch,
            getState
        );
        if (controller.signal.aborted) {
            clearGuardianHistoryRequest(key, controller);
            return undefined;
        }
        if (!current) {
            dispatch({
                type: types.GUARDIAN.GUARDIAN_HISTORY_FAILURE,
                payload: {
                    key,
                    detailKey,
                    unit,
                    requestId,
                    error: 'Unable to refresh Guardian current state'
                }
            });
            clearGuardianHistoryRequest(key, controller);
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
                    ? types.GUARDIAN.GUARDIAN_HISTORY_CANCELLED
                    : types.GUARDIAN.GUARDIAN_HISTORY_FAILURE,
                payload: {
                    key,
                    detailKey,
                    unit,
                    requestId,
                    error: cancelled ? undefined : 'Unable to resolve Guardian history start block'
                }
            });
            clearGuardianHistoryRequest(key, controller);
            return undefined;
        }

        const history = await api.getGuardianStakeHistoryApi(
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
                    ? types.GUARDIAN.GUARDIAN_HISTORY_CANCELLED
                    : types.GUARDIAN.GUARDIAN_HISTORY_FAILURE,
                payload: {
                    key,
                    detailKey,
                    unit,
                    requestId,
                    error: cancelled ? undefined : 'Unable to load Guardian stake history'
                }
            });
            clearGuardianHistoryRequest(key, controller);
            return undefined;
        }

        dispatch({
            type: types.GUARDIAN.GUARDIAN_HISTORY_SUCCESS,
            payload: { key, detailKey, unit, requestId, data: history, loadedAt: Date.now() }
        });
        clearGuardianHistoryRequest(key, controller);
        return history;
    };

/**
 * UI-compatible detail loader. It intentionally reads current state only;
 * the mounted Stake chart owns the lazy history request. Actions and rewards
 * are never read here, so other detail tabs do not pay for chart data.
 * The legacy third argument is accepted while old screen call sites migrate.
 */
export const getGuardianAction = (address: string, web3: any, _legacyBlockRef?: unknown) =>
    async (dispatch: any, getState: () => AppState): Promise<GuardianCurrent | undefined> => {
        const normalizedAddress = normalizeDetailAddress(address);
        const chain = getState().main.chain;
        const key = getDetailKey(chain, normalizedAddress);
        abortGuardianHistoryForOtherDetail(dispatch, key);
        dispatch({
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key }
        });

        return ensureGuardianCurrent(normalizedAddress, web3, chain, key, dispatch, getState);
    };

export const getGuardiansAction = (chain: CHAINS) => async (dispatch: any) => {
    const { node } = getChainConfig(chain);
    const guardians = await api.getGuardiansApi(node);
    if (!guardians) return null;
    const guardiansColors: { [id: string]: string } = {};
    guardians
        .sort((a, b) => b.effective_stake - a.effective_stake)
        .forEach((guardian: Guardian, index: number) => {
            guardiansColors[guardian.address] = getGuardianColor(index);
        });
    return dispatch({
        type: types.GUARDIAN.SET_GUARDIANS,
        payload: { guardians, guardiansColors }
    });
};

export const setGuardianLoading = (value: boolean) => async (dispatch: any) => dispatch({
    type: types.GUARDIAN.GUARDIAN_LOADING,
    payload: value
});

export const setGuardianNotFound = (value: boolean) => async (dispatch: any) => dispatch({
    type: types.GUARDIAN.GUARDIAN_NOT_FOUND,
    payload: value
});

export const setGuardianChartData = (chartData: ChartData | undefined) => async (dispatch: any) => dispatch({
    type: types.GUARDIAN.SET_GUARDIAN_CHART_DATA,
    payload: chartData
});

export const resetguardian = () => async (dispatch: any) => dispatch({
    type: types.GUARDIAN.RESET_GUARDIAN
});
