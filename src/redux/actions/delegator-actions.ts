import {
    DelegatorCurrent,
    DelegatorStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { Dispatch } from 'redux';
import { ChartData } from '../../global/types';
import { api } from '../../services/api';
import {
    readDelegatorDetailCache,
    writeDelegatorCurrentCache,
    writeDelegatorHistoryCache
} from '../../services/cache/delegator-detail-cache';
import { CHAINS } from '../../types';
import { mergeDelegatorStakeHistory } from '../../utils/detail-history';
import { DetailHistoryUnit } from '../types/detail-types';
import { AppState, types } from '../types/types';
import { indexedDelegatorHistoryEnabled } from '../../config';
import {
    DELEGATOR_CURRENT_CACHE_TTL_MS,
    DELEGATOR_HISTORY_CACHE_TTL_MS,
    detailLoadErrorMessage,
    doesDetailRangeCover,
    getDetailHistoryStartTime,
    getDetailKey,
    isDetailCacheFresh,
    isDetailHistoryUnit,
    isDetailRangeCacheFresh,
    nextDetailRequestId,
    normalizeDetailAddress
} from './detail-history';

interface ActiveDelegatorHistoryRequest {
    detailKey: string;
    address: string;
    chain: CHAINS;
    requestId: string;
    controller: AbortController;
    units: DetailHistoryUnit[];
    targetFromTime?: number;
    promise?: Promise<DelegatorStakeHistory | undefined>;
}

interface ActiveDelegatorReloadRefresh {
    detailKey: string;
    controller: AbortController;
    historyRequestId?: string;
    promise?: Promise<DelegatorCurrent | undefined>;
}

let activeDelegatorHistoryRequest: ActiveDelegatorHistoryRequest | undefined;
let activeDelegatorReloadRefresh: ActiveDelegatorReloadRefresh | undefined;
const completedDelegatorReloadRefreshes: { [key: string]: boolean | undefined } = Object.create(null);
const activeDelegatorCurrentRequests: {
    [key: string]: Promise<DelegatorCurrent | undefined> | undefined;
} = Object.create(null);

const delegatorHistoryFinalityOverlap = (chain: CHAINS): number =>
    chain === CHAINS.POLYGON ? 256 : 64;

const hydrateDelegatorDetail = (
    detailKey: string,
    address: string,
    chain: CHAINS,
    dispatch: any,
    getState: () => AppState
): boolean => {
    const delegatorState = getState().delegator;
    if (delegatorState.currentByKey[detailKey] && delegatorState.historyByKey[detailKey]) return false;
    const cached = readDelegatorDetailCache(detailKey);
    if (!cached.current && !cached.history) return false;
    dispatch({
        type: types.DELEGATOR.DELEGATOR_DETAIL_HYDRATE,
        payload: {
            key: detailKey,
            address,
            chain,
            current: delegatorState.currentByKey[detailKey] ? undefined : cached.current,
            history: delegatorState.historyByKey[detailKey] ? undefined : cached.history
        }
    });
    return true;
};

const isDelegatorReloadNavigation = (normalizedAddress: string): boolean => {
    if (typeof window === 'undefined') return false;
    let pathname = '';
    try {
        pathname = decodeURIComponent(window.location.pathname || '').toLowerCase();
    } catch (_error) {
        pathname = (window.location.pathname || '').toLowerCase();
    }
    const segments = pathname.split('/').filter(Boolean);
    if (segments.indexOf('delegators') === -1 || segments.indexOf(normalizedAddress) === -1) return false;

    const performanceApi: any = window.performance;
    if (!performanceApi) return false;
    if (typeof performanceApi.getEntriesByType === 'function') {
        const entries = performanceApi.getEntriesByType('navigation');
        if (entries && entries.length > 0) return entries[0].type === 'reload';
    }
    return !!performanceApi.navigation && performanceApi.navigation.type === 1;
};

const shouldRefreshDelegatorCache = (
    state: AppState,
    detailKey: string,
    normalizedAddress: string
): boolean => {
    const current = state.delegator.currentByKey[detailKey];
    const history = state.delegator.historyByKey[detailKey];
    const hasCachedData = !!(current && current.data) || !!(history && history.data);
    if (!hasCachedData) return false;

    const reloadRefresh = isDelegatorReloadNavigation(normalizedAddress) &&
        !completedDelegatorReloadRefreshes[detailKey];
    const freshnessRefresh = (
        !!current &&
        !!current.data &&
        !isDetailCacheFresh(current, DELEGATOR_CURRENT_CACHE_TTL_MS)
    ) || (
        (!current || !current.data) &&
        !!history &&
        !!history.data
    ) || (
        !!history &&
        !!history.data &&
        !isDetailCacheFresh(history, DELEGATOR_HISTORY_CACHE_TTL_MS)
    );
    if (reloadRefresh) completedDelegatorReloadRefreshes[detailKey] = true;
    return reloadRefresh || freshnessRefresh;
};

const cancelActiveDelegatorHistoryRequest = (dispatch: any): void => {
    const active = activeDelegatorHistoryRequest;
    if (!active) return;
    activeDelegatorHistoryRequest = undefined;
    active.controller.abort();
    dispatch({
        type: types.DELEGATOR.DELEGATOR_HISTORY_CANCELLED,
        payload: { detailKey: active.detailKey, requestId: active.requestId }
    });
};

const abortDelegatorHistoryForOtherDetail = (dispatch: any, detailKey: string): void => {
    if (activeDelegatorHistoryRequest && activeDelegatorHistoryRequest.detailKey !== detailKey) {
        cancelActiveDelegatorHistoryRequest(dispatch);
    }
};

const clearDelegatorHistoryRequest = (request: ActiveDelegatorHistoryRequest): void => {
    if (activeDelegatorHistoryRequest === request) activeDelegatorHistoryRequest = undefined;
};

const addDelegatorHistoryUnit = (
    request: ActiveDelegatorHistoryRequest,
    unit: DetailHistoryUnit
): void => {
    if (request.units.indexOf(unit) === -1) request.units.push(unit);
};

const requestedDelegatorHistoryStart = (
    request: ActiveDelegatorHistoryRequest,
    asOfTime: number
): number => Math.min(...request.units.map((unit) => getDetailHistoryStartTime(unit, asOfTime)));

const delegatorHistoryTarget = (
    request: ActiveDelegatorHistoryRequest,
    asOfTime: number,
    state: AppState
): number => {
    const requestedFromTime = requestedDelegatorHistoryStart(request, asOfTime);
    const cached = state.delegator.historyByKey[request.detailKey];
    return cached && cached.data && typeof cached.coveredFromTime === 'number'
        ? Math.min(requestedFromTime, cached.coveredFromTime)
        : requestedFromTime;
};

const cachedDelegatorHistoryReferenceTime = (
    state: AppState,
    detailKey: string
): number | undefined => {
    const current = state.delegator.currentByKey[detailKey];
    if (current && current.data) return current.data.block_time;
    const history = state.delegator.historyByKey[detailKey];
    return history && history.data && history.data.range.to_time;
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
    getState: () => AppState,
    forceRefresh: boolean = false
): Promise<DelegatorCurrent | undefined> => {
    const currentEntry = getState().delegator.currentByKey[key];
    if (!forceRefresh && isDetailCacheFresh(currentEntry, DELEGATOR_CURRENT_CACHE_TTL_MS)) {
        return currentEntry && currentEntry.data;
    }
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
        const loadedAt = Date.now();
        dispatch({
            type: types.DELEGATOR.DELEGATOR_CURRENT_SUCCESS,
            payload: { key, requestId, data: current, loadedAt }
        });
        writeDelegatorCurrentCache(key, normalizedAddress, chain, current, loadedAt);
        return current;
    })();
    activeDelegatorCurrentRequests[key] = operation;
    try {
        return await operation;
    } finally {
        if (activeDelegatorCurrentRequests[key] === operation) delete activeDelegatorCurrentRequests[key];
    }
};

const abortDelegatorReloadRefreshForOtherDetail = (dispatch: any, detailKey: string): void => {
    const active = activeDelegatorReloadRefresh;
    if (!active || active.detailKey === detailKey) return;
    activeDelegatorReloadRefresh = undefined;
    active.controller.abort();
    if (active.historyRequestId) {
        dispatch({
            type: types.DELEGATOR.DELEGATOR_HISTORY_CANCELLED,
            payload: { detailKey: active.detailKey, requestId: active.historyRequestId }
        });
    }
};

const refreshCachedDelegatorHistory = (
    normalizedAddress: string,
    web3: any,
    chain: CHAINS,
    detailKey: string,
    dispatch: any,
    getState: () => AppState
): Promise<DelegatorCurrent | undefined> => {
    if (activeDelegatorReloadRefresh && activeDelegatorReloadRefresh.detailKey === detailKey) {
        return activeDelegatorReloadRefresh.promise || Promise.resolve(undefined);
    }
    abortDelegatorReloadRefreshForOtherDetail(dispatch, detailKey);

    const request: ActiveDelegatorReloadRefresh = {
        detailKey,
        controller: new AbortController()
    };
    activeDelegatorReloadRefresh = request;
    const operation = (async (): Promise<DelegatorCurrent | undefined> => {
        const current = await ensureDelegatorCurrent(
            normalizedAddress,
            web3,
            chain,
            detailKey,
            dispatch,
            getState,
            true
        );
        if (!current || request.controller.signal.aborted) return current;

        const cachedEntry = getState().delegator.historyByKey[detailKey];
        if (!cachedEntry || !cachedEntry.data) return current;
        const cachedHistory = cachedEntry.data;
        const latestBlock = typeof cachedEntry.latestBlock === 'number'
            ? cachedEntry.latestBlock
            : cachedHistory.range.to_block;
        const coveredFromTime = typeof cachedEntry.coveredFromTime === 'number'
            ? cachedEntry.coveredFromTime
            : cachedHistory.range.from_time;
        if (coveredFromTime === undefined) return current;

        const requestId = nextDetailRequestId(`delegator-reload-history:${detailKey}`);
        request.historyRequestId = requestId;
        dispatch({
            type: types.DELEGATOR.DELEGATOR_HISTORY_REQUEST,
            payload: {
                detailKey,
                address: normalizedAddress,
                chain,
                requestId,
                targetFromTime: coveredFromTime
            }
        });

        if (current.block_number < latestBlock) {
            const loadedAt = Date.now();
            dispatch({
                type: types.DELEGATOR.DELEGATOR_HISTORY_SUCCESS,
                payload: {
                    detailKey,
                    requestId,
                    data: cachedHistory,
                    coveredFromTime,
                    complete: true,
                    loadedAt
                }
            });
            writeDelegatorHistoryCache(
                detailKey,
                normalizedAddress,
                chain,
                cachedHistory,
                coveredFromTime,
                latestBlock,
                loadedAt
            );
            return current;
        }

        const delta = await api.getDelegatorStakeHistoryApi(
            normalizedAddress,
            web3,
            Math.max(
                cachedHistory.range.from_block,
                latestBlock - delegatorHistoryFinalityOverlap(chain) + 1
            ),
            request.controller.signal,
            current,
            DELEGATOR_HISTORY_CACHE_TTL_MS
        );
        if (!delta) {
            const cancelled = request.controller.signal.aborted;
            dispatch({
                type: cancelled
                    ? types.DELEGATOR.DELEGATOR_HISTORY_CANCELLED
                    : types.DELEGATOR.DELEGATOR_HISTORY_FAILURE,
                payload: {
                    detailKey,
                    requestId,
                    error: cancelled ? undefined : 'Unable to refresh Delegator stake history'
                }
            });
            return current;
        }

        let merged: DelegatorStakeHistory;
        try {
            merged = mergeDelegatorStakeHistory(cachedHistory, delta);
        } catch (error) {
            dispatch({
                type: types.DELEGATOR.DELEGATOR_HISTORY_FAILURE,
                payload: {
                    detailKey,
                    requestId,
                    error: detailLoadErrorMessage(error, 'Unable to merge Delegator history refresh')
                }
            });
            return current;
        }
        const loadedAt = Date.now();
        dispatch({
            type: types.DELEGATOR.DELEGATOR_HISTORY_SUCCESS,
            payload: {
                detailKey,
                requestId,
                data: merged,
                coveredFromTime,
                complete: true,
                loadedAt
            }
        });
        writeDelegatorHistoryCache(
            detailKey,
            normalizedAddress,
            chain,
            merged,
            coveredFromTime,
            merged.range.to_block,
            loadedAt
        );
        return current;
    })();
    request.promise = operation;
    return operation.finally(() => {
        if (activeDelegatorReloadRefresh === request) activeDelegatorReloadRefresh = undefined;
    });
};

/** Resets document-navigation tracking between isolated reducer tests. */
export const resetDelegatorReloadRefreshTracking = (): void => {
    if (activeDelegatorReloadRefresh) activeDelegatorReloadRefresh.controller.abort();
    activeDelegatorReloadRefresh = undefined;
    Object.keys(completedDelegatorReloadRefreshes)
        .forEach((key) => delete completedDelegatorReloadRefreshes[key]);
};

export const loadDelegatorHistory = (address: string, web3: any, unit: DetailHistoryUnit) =>
    async (dispatch: any, getState: () => AppState): Promise<DelegatorStakeHistory | undefined> => {
        if (!isDetailHistoryUnit(unit)) throw new Error(`Unsupported Delegator history unit: ${unit}`);
        const normalizedAddress = normalizeDetailAddress(address);
        const chain = getState().main.chain;
        const detailKey = getDetailKey(chain, normalizedAddress);
        abortDelegatorHistoryForOtherDetail(dispatch, detailKey);
        hydrateDelegatorDetail(detailKey, normalizedAddress, chain, dispatch, getState);

        dispatch({
            type: types.DELEGATOR.SELECT_DELEGATOR_HISTORY,
            payload: { detailKey, unit }
        });

        let initialState = getState();
        let initialReferenceTime = cachedDelegatorHistoryReferenceTime(initialState, detailKey);
        let initialEntry = initialState.delegator.historyByKey[detailKey];
        if (shouldRefreshDelegatorCache(initialState, detailKey, normalizedAddress)) {
            await refreshCachedDelegatorHistory(
                normalizedAddress,
                web3,
                chain,
                detailKey,
                dispatch,
                getState
            );
            initialState = getState();
            initialReferenceTime = cachedDelegatorHistoryReferenceTime(initialState, detailKey);
            initialEntry = initialState.delegator.historyByKey[detailKey];
            if (initialReferenceTime !== undefined) {
                const requestedFromTime = getDetailHistoryStartTime(unit, initialReferenceTime);
                if (doesDetailRangeCover(initialEntry, requestedFromTime)) {
                    return initialEntry && initialEntry.data;
                }
            }
        }
        if (initialReferenceTime !== undefined) {
            const requestedFromTime = getDetailHistoryStartTime(unit, initialReferenceTime);
            if (isDetailRangeCacheFresh(
                initialEntry,
                requestedFromTime,
                DELEGATOR_HISTORY_CACHE_TTL_MS
            )) return initialEntry && initialEntry.data;
        }

        const shared = activeDelegatorHistoryRequest;
        if (shared && shared.detailKey === detailKey) {
            addDelegatorHistoryUnit(shared, unit);
            const currentEntry = getState().delegator.currentByKey[detailKey];
            if (currentEntry && currentEntry.data) {
                shared.targetFromTime = delegatorHistoryTarget(
                    shared,
                    currentEntry.data.block_time,
                    getState()
                );
                dispatch({
                    type: types.DELEGATOR.DELEGATOR_HISTORY_REQUEST,
                    payload: {
                        detailKey,
                        address: normalizedAddress,
                        chain,
                        requestId: shared.requestId,
                        targetFromTime: shared.targetFromTime
                    }
                });
            }
            return shared.promise;
        }

        const request: ActiveDelegatorHistoryRequest = {
            detailKey,
            address: normalizedAddress,
            chain,
            requestId: nextDetailRequestId(`delegator-history:${detailKey}`),
            controller: new AbortController(),
            units: [unit]
        };
        activeDelegatorHistoryRequest = request;

        const operation = (async (): Promise<DelegatorStakeHistory | undefined> => {
            const current = await ensureDelegatorCurrent(
                normalizedAddress,
                web3,
                chain,
                detailKey,
                dispatch,
                getState
            );
            if (request.controller.signal.aborted || !current) return undefined;

            while (!request.controller.signal.aborted) {
                const targetFromTime = delegatorHistoryTarget(request, current.block_time, getState());
                request.targetFromTime = targetFromTime;
                const cached = getState().delegator.historyByKey[detailKey];
                if (isDetailRangeCacheFresh(
                    cached,
                    targetFromTime,
                    DELEGATOR_HISTORY_CACHE_TTL_MS
                )) return cached && cached.data;

                dispatch({
                    type: types.DELEGATOR.DELEGATOR_HISTORY_REQUEST,
                    payload: {
                        detailKey,
                        address: normalizedAddress,
                        chain,
                        requestId: request.requestId,
                        targetFromTime
                    }
                });

                const fromBlock = indexedDelegatorHistoryEnabled
                    ? undefined
                    : await api.resolveHistoryStartBlockApi(web3, targetFromTime, request.controller.signal);
                if (!indexedDelegatorHistoryEnabled && fromBlock === undefined) {
                    const cancelled = request.controller.signal.aborted;
                    dispatch({
                        type: cancelled
                            ? types.DELEGATOR.DELEGATOR_HISTORY_CANCELLED
                            : types.DELEGATOR.DELEGATOR_HISTORY_FAILURE,
                        payload: {
                            detailKey,
                            requestId: request.requestId,
                            error: cancelled ? undefined : 'Unable to resolve Delegator history start block'
                        }
                    });
                    return undefined;
                }

                if (delegatorHistoryTarget(request, current.block_time, getState()) < targetFromTime) continue;

                const history = indexedDelegatorHistoryEnabled
                    ? await api.getDelegatorStakeHistoryFromTimeApi(
                        normalizedAddress,
                        web3,
                        targetFromTime,
                        request.controller.signal,
                        current,
                        DELEGATOR_HISTORY_CACHE_TTL_MS
                    )
                    : await api.getDelegatorStakeHistoryApi(
                        normalizedAddress,
                        web3,
                        fromBlock as number,
                        request.controller.signal,
                        current,
                        DELEGATOR_HISTORY_CACHE_TTL_MS
                    );
                if (!history) {
                    const cancelled = request.controller.signal.aborted;
                    dispatch({
                        type: cancelled
                            ? types.DELEGATOR.DELEGATOR_HISTORY_CANCELLED
                            : types.DELEGATOR.DELEGATOR_HISTORY_FAILURE,
                        payload: {
                            detailKey,
                            requestId: request.requestId,
                            error: cancelled ? undefined : 'Unable to load Delegator stake history'
                        }
                    });
                    return undefined;
                }

                const nextTargetFromTime = delegatorHistoryTarget(request, current.block_time, getState());
                const complete = nextTargetFromTime >= targetFromTime;
                const loadedAt = Date.now();
                dispatch({
                    type: types.DELEGATOR.DELEGATOR_HISTORY_SUCCESS,
                    payload: {
                        detailKey,
                        requestId: request.requestId,
                        data: history,
                        coveredFromTime: targetFromTime,
                        complete,
                        loadedAt
                    }
                });
                writeDelegatorHistoryCache(
                    detailKey,
                    normalizedAddress,
                    chain,
                    history,
                    targetFromTime,
                    history.range.to_block,
                    loadedAt
                );
                if (complete) return history;
            }
            return undefined;
        })();
        request.promise = operation;
        try {
            return await operation;
        } finally {
            clearDelegatorHistoryRequest(request);
        }
    };

/** UI-compatible current-only detail loader. The Stake chart loads history. */
export const findDelegatorAction = (address: string, web3: any, _legacyBlockRef?: unknown) =>
    async (dispatch: any, getState: () => AppState): Promise<DelegatorCurrent | undefined> => {
        const normalizedAddress = normalizeDetailAddress(address);
        const chain = getState().main.chain;
        const key = getDetailKey(chain, normalizedAddress);
        abortDelegatorHistoryForOtherDetail(dispatch, key);
        abortDelegatorReloadRefreshForOtherDetail(dispatch, key);
        hydrateDelegatorDetail(key, normalizedAddress, chain, dispatch, getState);
        dispatch({
            type: types.DELEGATOR.SELECT_DELEGATOR_DETAIL,
            payload: { key }
        });

        if (shouldRefreshDelegatorCache(getState(), key, normalizedAddress)) {
            return refreshCachedDelegatorHistory(normalizedAddress, web3, chain, key, dispatch, getState);
        }
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
