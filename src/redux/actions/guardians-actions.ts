import {
    Guardian,
    GuardianCurrent,
    GuardianDelegatorsPage,
    GuardianStake,
    GuardianStakeHistoryAnchorSnapshot,
    GuardianStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { CHAINS } from 'types';
import { getChainConfig } from 'utils/chain';
import { getGuardianColor } from 'utils/overview/overview';
import { ChartData } from '../../global/types';
import { api } from '../../services/api';
import {
    readGuardianDetailCache,
    writeGuardianCurrentCache,
    writeGuardianDelegatorsCache,
    writeGuardianHistoryCache
} from '../../services/cache/guardian-detail-cache';
import { DetailHistoryUnit } from '../types/detail-types';
import { AppState, types } from '../types/types';
import { compareHistoryPoints, mergeGuardianStakeHistory } from '../../utils/detail-history';
import {
    GUARDIAN_CURRENT_CACHE_TTL_MS,
    GUARDIAN_DELEGATORS_CACHE_TTL_MS,
    GUARDIAN_HISTORY_CACHE_TTL_MS,
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

interface ActiveGuardianHistoryRequest {
    detailKey: string;
    address: string;
    chain: CHAINS;
    requestId: string;
    controller: AbortController;
    units: DetailHistoryUnit[];
    targetFromTime?: number;
    promise?: Promise<GuardianStakeHistory | undefined>;
}

interface ActiveGuardianReloadRefresh {
    detailKey: string;
    controller: AbortController;
    historyRequestId?: string;
    promise?: Promise<GuardianCurrent | undefined>;
}

let activeGuardianHistoryRequest: ActiveGuardianHistoryRequest | undefined;
let activeGuardianReloadRefresh: ActiveGuardianReloadRefresh | undefined;
const completedGuardianReloadRefreshes: { [key: string]: boolean | undefined } = Object.create(null);
const completedGuardianDelegatorsReloadRefreshes: { [key: string]: boolean | undefined } = Object.create(null);
const activeGuardianCurrentRequests: {
    [key: string]: Promise<GuardianCurrent | undefined> | undefined;
} = Object.create(null);
let activeGuardianDelegatorsRequest: {
    key: string;
    requestId: string;
    controller: AbortController;
} | undefined;

const hydrateGuardianDetail = (
    detailKey: string,
    address: string,
    chain: CHAINS,
    dispatch: any,
    getState: () => AppState
): boolean => {
    const guardianState = getState().guardians;
    if (
        guardianState.currentByKey[detailKey] &&
        guardianState.historyByKey[detailKey] &&
        guardianState.delegatorsByKey[detailKey]
    ) return false;
    const cached = readGuardianDetailCache(detailKey);
    if (!cached.current && !cached.history && !cached.delegators) return false;
    dispatch({
        type: types.GUARDIAN.GUARDIAN_DETAIL_HYDRATE,
        payload: {
            key: detailKey,
            address,
            chain,
            current: guardianState.currentByKey[detailKey] ? undefined : cached.current,
            history: guardianState.historyByKey[detailKey] ? undefined : cached.history,
            delegators: guardianState.delegatorsByKey[detailKey] ? undefined : cached.delegators
        }
    });
    return true;
};

const isGuardianReloadNavigation = (normalizedAddress: string): boolean => {
    if (typeof window === 'undefined') return false;
    let pathname = '';
    try {
        pathname = decodeURIComponent(window.location.pathname || '').toLowerCase();
    } catch (_error) {
        pathname = (window.location.pathname || '').toLowerCase();
    }
    const segments = pathname.split('/').filter(Boolean);
    if (segments.indexOf('guardians') === -1 || segments.indexOf(normalizedAddress) === -1) return false;

    const performanceApi: any = window.performance;
    if (!performanceApi) return false;
    if (typeof performanceApi.getEntriesByType === 'function') {
        const entries = performanceApi.getEntriesByType('navigation');
        if (entries && entries.length > 0) return entries[0].type === 'reload';
    }
    return !!performanceApi.navigation && performanceApi.navigation.type === 1;
};

const shouldRefreshGuardianCache = (
    state: AppState,
    detailKey: string,
    normalizedAddress: string
): boolean => {
    const history = state.guardians.historyByKey[detailKey];
    if (!history || !history.data) return false;
    const current = state.guardians.currentByKey[detailKey];
    const reloadRefresh = isGuardianReloadNavigation(normalizedAddress) &&
        !completedGuardianReloadRefreshes[detailKey];
    const freshnessRefresh = !isDetailCacheFresh(current, GUARDIAN_CURRENT_CACHE_TTL_MS) ||
        !isDetailCacheFresh(history, GUARDIAN_HISTORY_CACHE_TTL_MS);
    if (reloadRefresh) completedGuardianReloadRefreshes[detailKey] = true;
    return reloadRefresh || freshnessRefresh;
};

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
        hydrateGuardianDetail(key, normalizedAddress, chain, dispatch, getState);

        if (activeGuardianDelegatorsRequest && activeGuardianDelegatorsRequest.key !== key) {
            abortActiveGuardianDelegatorsRequest(dispatch);
        }

        const cached = getState().guardians.delegatorsByKey[key];
        const reloadRefresh = !cursor &&
            !!cached &&
            !!cached.cacheSnapshot &&
            isGuardianReloadNavigation(normalizedAddress) &&
            !completedGuardianDelegatorsReloadRefreshes[key];
        if (reloadRefresh) completedGuardianDelegatorsReloadRefreshes[key] = true;
        if (!cursor && !reloadRefresh && isDetailCacheFresh(cached, GUARDIAN_DELEGATORS_CACHE_TTL_MS)) {
            return undefined;
        }
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
                append: Boolean(cursor),
                preserveExisting: !cursor && !!cached
            }
        });

        const page = await api.getGuardianDelegatorsPageApi(
            normalizedAddress,
            web3,
            cursor,
            controller.signal,
            cached && cached.cacheSnapshot
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
        const persisted = getState().guardians.delegatorsByKey[key];
        if (persisted && persisted.cacheSnapshot && persisted.asOfBlock !== undefined && persisted.loadedAt !== undefined) {
            writeGuardianDelegatorsCache(key, normalizedAddress, chain, {
                items: persisted.items,
                total: persisted.total,
                nextCursor: persisted.nextCursor,
                asOfBlock: persisted.asOfBlock,
                cacheSnapshot: persisted.cacheSnapshot,
                loadedAt: persisted.loadedAt
            });
        }
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
            detailKey: active.detailKey,
            requestId: active.requestId
        }
    });
};

const abortGuardianHistoryForOtherDetail = (dispatch: any, detailKey: string): void => {
    if (activeGuardianHistoryRequest && activeGuardianHistoryRequest.detailKey !== detailKey) {
        cancelActiveGuardianHistoryRequest(dispatch);
    }
};

const clearGuardianHistoryRequest = (request: ActiveGuardianHistoryRequest): void => {
    if (activeGuardianHistoryRequest === request) {
        activeGuardianHistoryRequest = undefined;
    }
};

const addGuardianHistoryUnit = (
    request: ActiveGuardianHistoryRequest,
    unit: DetailHistoryUnit
): void => {
    if (request.units.indexOf(unit) === -1) request.units.push(unit);
};

const requestedGuardianHistoryStart = (
    request: ActiveGuardianHistoryRequest,
    asOfTime: number
): number => Math.min(...request.units.map((unit) => getDetailHistoryStartTime(unit, asOfTime)));

const guardianHistoryTarget = (
    request: ActiveGuardianHistoryRequest,
    asOfTime: number,
    state: AppState
): number => {
    const requestedFromTime = requestedGuardianHistoryStart(request, asOfTime);
    const cached = state.guardians.historyByKey[request.detailKey];
    // Once a long raw range exists, a TTL refresh must keep that range intact
    // instead of replacing it with a shorter currently selected period.
    return cached && cached.data && typeof cached.coveredFromTime === 'number'
        ? Math.min(requestedFromTime, cached.coveredFromTime)
        : requestedFromTime;
};

const cachedGuardianHistoryReferenceTime = (state: AppState, detailKey: string): number | undefined => {
    const currentEntry = state.guardians.currentByKey[detailKey];
    if (currentEntry && currentEntry.data) return currentEntry.data.block_time;
    const historyEntry = state.guardians.historyByKey[detailKey];
    return historyEntry && historyEntry.data && historyEntry.data.range.to_time;
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
    getState: () => AppState,
    forceRefresh: boolean = false
): Promise<GuardianCurrent | undefined> => {
    const currentEntry = getState().guardians.currentByKey[key];
    if (!forceRefresh && isDetailCacheFresh(currentEntry, GUARDIAN_CURRENT_CACHE_TTL_MS)) {
        return currentEntry && currentEntry.data;
    }
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
        const loadedAt = Date.now();
        dispatch({
            type: types.GUARDIAN.GUARDIAN_CURRENT_SUCCESS,
            payload: { key, requestId, data: current, loadedAt }
        });
        writeGuardianCurrentCache(key, normalizedAddress, chain, current, loadedAt);
        return current;
    })();
    activeGuardianCurrentRequests[key] = operation;
    try {
        return await operation;
    } finally {
        if (activeGuardianCurrentRequests[key] === operation) delete activeGuardianCurrentRequests[key];
    }
};

const guardianHistoryAnchor = (
    history: GuardianStakeHistory,
    latestBlock: number
): GuardianStakeHistoryAnchorSnapshot | undefined => {
    const endpoint = history.stake_slices
        .slice()
        .sort(compareHistoryPoints)
        .filter((slice: GuardianStake) => slice.block_number === latestBlock)
        .pop();
    if (!endpoint) return undefined;
    return {
        block_number: endpoint.block_number,
        block_time: endpoint.block_time,
        stake_status: {
            self_stake: endpoint.self_stake,
            delegated_stake: endpoint.delegated_stake,
            total_stake: endpoint.total_stake
        }
    };
};

const abortGuardianReloadRefreshForOtherDetail = (dispatch: any, detailKey: string): void => {
    const active = activeGuardianReloadRefresh;
    if (!active || active.detailKey === detailKey) return;
    activeGuardianReloadRefresh = undefined;
    active.controller.abort();
    if (active.historyRequestId) {
        dispatch({
            type: types.GUARDIAN.GUARDIAN_HISTORY_CANCELLED,
            payload: { detailKey: active.detailKey, requestId: active.historyRequestId }
        });
    }
};

const refreshCachedGuardianHistory = (
    normalizedAddress: string,
    web3: any,
    chain: CHAINS,
    detailKey: string,
    dispatch: any,
    getState: () => AppState
): Promise<GuardianCurrent | undefined> => {
    if (activeGuardianReloadRefresh && activeGuardianReloadRefresh.detailKey === detailKey) {
        return activeGuardianReloadRefresh.promise || Promise.resolve(undefined);
    }
    abortGuardianReloadRefreshForOtherDetail(dispatch, detailKey);

    const request: ActiveGuardianReloadRefresh = {
        detailKey,
        controller: new AbortController()
    };
    activeGuardianReloadRefresh = request;
    const operation = (async (): Promise<GuardianCurrent | undefined> => {
        const current = await ensureGuardianCurrent(
            normalizedAddress,
            web3,
            chain,
            detailKey,
            dispatch,
            getState,
            true
        );
        if (!current || request.controller.signal.aborted) return current;

        const cachedEntry = getState().guardians.historyByKey[detailKey];
        if (!cachedEntry || !cachedEntry.data) {
            return current;
        }

        const cachedHistory = cachedEntry.data;
        const latestBlock = typeof cachedEntry.latestBlock === 'number'
            ? cachedEntry.latestBlock
            : cachedHistory.range.to_block;
        const coveredFromTime = typeof cachedEntry.coveredFromTime === 'number'
            ? cachedEntry.coveredFromTime
            : cachedHistory.range.from_time;
        if (coveredFromTime === undefined) {
            return current;
        }

        const requestId = nextDetailRequestId(`guardian-reload-history:${detailKey}`);
        request.historyRequestId = requestId;
        dispatch({
            type: types.GUARDIAN.GUARDIAN_HISTORY_REQUEST,
            payload: {
                detailKey,
                address: normalizedAddress,
                chain,
                requestId,
                targetFromTime: coveredFromTime
            }
        });

        if (current.block_number <= latestBlock) {
            const loadedAt = Date.now();
            dispatch({
                type: types.GUARDIAN.GUARDIAN_HISTORY_SUCCESS,
                payload: {
                    detailKey,
                    requestId,
                    data: cachedHistory,
                    coveredFromTime,
                    complete: true,
                    loadedAt
                }
            });
            writeGuardianHistoryCache(
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

        const anchor = guardianHistoryAnchor(cachedHistory, latestBlock);
        if (!anchor) {
            dispatch({
                type: types.GUARDIAN.GUARDIAN_HISTORY_FAILURE,
                payload: {
                    detailKey,
                    requestId,
                    error: 'Cached Guardian history endpoint is incomplete'
                }
            });
            return current;
        }

        const delta = await api.getGuardianStakeHistoryApi(
            normalizedAddress,
            web3,
            latestBlock + 1,
            request.controller.signal,
            current,
            GUARDIAN_HISTORY_CACHE_TTL_MS,
            anchor
        );
        if (!delta) {
            const cancelled = request.controller.signal.aborted;
            dispatch({
                type: cancelled
                    ? types.GUARDIAN.GUARDIAN_HISTORY_CANCELLED
                    : types.GUARDIAN.GUARDIAN_HISTORY_FAILURE,
                payload: {
                    detailKey,
                    requestId,
                    error: cancelled ? undefined : 'Unable to refresh Guardian stake history'
                }
            });
            return current;
        }

        let merged: GuardianStakeHistory;
        try {
            merged = mergeGuardianStakeHistory(cachedHistory, delta);
        } catch (error) {
            dispatch({
                type: types.GUARDIAN.GUARDIAN_HISTORY_FAILURE,
                payload: {
                    detailKey,
                    requestId,
                    error: detailLoadErrorMessage(error, 'Unable to merge Guardian history refresh')
                }
            });
            return current;
        }
        const loadedAt = Date.now();
        dispatch({
            type: types.GUARDIAN.GUARDIAN_HISTORY_SUCCESS,
            payload: {
                detailKey,
                requestId,
                data: merged,
                coveredFromTime,
                complete: true,
                loadedAt
            }
        });
        writeGuardianHistoryCache(
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
        if (activeGuardianReloadRefresh === request) activeGuardianReloadRefresh = undefined;
    });
};

/** Resets document-navigation tracking between isolated reducer tests. */
export const resetGuardianReloadRefreshTracking = (): void => {
    if (activeGuardianReloadRefresh) activeGuardianReloadRefresh.controller.abort();
    activeGuardianReloadRefresh = undefined;
    Object.keys(completedGuardianReloadRefreshes).forEach((key) => delete completedGuardianReloadRefreshes[key]);
    Object.keys(completedGuardianDelegatorsReloadRefreshes)
        .forEach((key) => delete completedGuardianDelegatorsReloadRefreshes[key]);
};

export const loadGuardianHistory = (address: string, web3: any, unit: DetailHistoryUnit) =>
    async (dispatch: any, getState: () => AppState): Promise<GuardianStakeHistory | undefined> => {
        if (!isDetailHistoryUnit(unit)) throw new Error(`Unsupported Guardian history unit: ${unit}`);
        const normalizedAddress = normalizeDetailAddress(address);
        const chain = getState().main.chain;
        const detailKey = getDetailKey(chain, normalizedAddress);
        abortGuardianHistoryForOtherDetail(dispatch, detailKey);
        hydrateGuardianDetail(detailKey, normalizedAddress, chain, dispatch, getState);

        dispatch({
            type: types.GUARDIAN.SELECT_GUARDIAN_HISTORY,
            payload: { detailKey, unit }
        });

        let initialState = getState();
        let initialReferenceTime = cachedGuardianHistoryReferenceTime(initialState, detailKey);
        let initialEntry = initialState.guardians.historyByKey[detailKey];
        if (initialEntry && initialEntry.data && shouldRefreshGuardianCache(
            initialState,
            detailKey,
            normalizedAddress
        )) {
            await refreshCachedGuardianHistory(
                normalizedAddress,
                web3,
                chain,
                detailKey,
                dispatch,
                getState
            );
            initialState = getState();
            initialReferenceTime = cachedGuardianHistoryReferenceTime(initialState, detailKey);
            initialEntry = initialState.guardians.historyByKey[detailKey];
            if (initialReferenceTime !== undefined) {
                const requestedFromTime = getDetailHistoryStartTime(unit, initialReferenceTime);
                // A failed delta refresh must not discard a still-usable old
                // range or fall back to a full replay. Only a genuinely wider
                // period continues below to fetch its missing prefix.
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
                GUARDIAN_HISTORY_CACHE_TTL_MS
            )) return initialEntry && initialEntry.data;
        }

        const shared = activeGuardianHistoryRequest;
        if (shared && shared.detailKey === detailKey) {
            addGuardianHistoryUnit(shared, unit);
            const currentEntry = getState().guardians.currentByKey[detailKey];
            if (currentEntry && currentEntry.data) {
                shared.targetFromTime = guardianHistoryTarget(
                    shared,
                    currentEntry.data.block_time,
                    getState()
                );
                dispatch({
                    type: types.GUARDIAN.GUARDIAN_HISTORY_REQUEST,
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

        const request: ActiveGuardianHistoryRequest = {
            detailKey,
            address: normalizedAddress,
            chain,
            requestId: nextDetailRequestId(`guardian-history:${detailKey}`),
            controller: new AbortController(),
            units: [unit]
        };
        activeGuardianHistoryRequest = request;

        const operation = (async (): Promise<GuardianStakeHistory | undefined> => {
            const current = await ensureGuardianCurrent(
                normalizedAddress,
                web3,
                chain,
                detailKey,
                dispatch,
                getState
            );
            if (request.controller.signal.aborted) return undefined;
            if (!current) return undefined;

            while (!request.controller.signal.aborted) {
                const targetFromTime = guardianHistoryTarget(request, current.block_time, getState());
                request.targetFromTime = targetFromTime;
                const cached = getState().guardians.historyByKey[detailKey];
                if (isDetailRangeCacheFresh(
                    cached,
                    targetFromTime,
                    GUARDIAN_HISTORY_CACHE_TTL_MS
                )) return cached && cached.data;

                dispatch({
                    type: types.GUARDIAN.GUARDIAN_HISTORY_REQUEST,
                    payload: {
                        detailKey,
                        address: normalizedAddress,
                        chain,
                        requestId: request.requestId,
                        targetFromTime
                    }
                });

                // If a wider period was selected before the indexed request,
                // skip the narrower request and resolve only the new edge.
                if (guardianHistoryTarget(request, current.block_time, getState()) < targetFromTime) continue;

                const history = await api.getGuardianStakeHistoryFromTimeApi(
                    normalizedAddress,
                    web3,
                    targetFromTime,
                    request.controller.signal,
                    current,
                    GUARDIAN_HISTORY_CACHE_TTL_MS
                );
                if (!history) {
                    const cancelled = request.controller.signal.aborted;
                    dispatch({
                        type: cancelled
                            ? types.GUARDIAN.GUARDIAN_HISTORY_CANCELLED
                            : types.GUARDIAN.GUARDIAN_HISTORY_FAILURE,
                        payload: {
                            detailKey,
                            requestId: request.requestId,
                            error: cancelled ? undefined : 'Unable to load Guardian stake history'
                        }
                    });
                    return undefined;
                }

                const nextTargetFromTime = guardianHistoryTarget(request, current.block_time, getState());
                const complete = nextTargetFromTime >= targetFromTime;
                const loadedAt = Date.now();
                dispatch({
                    type: types.GUARDIAN.GUARDIAN_HISTORY_SUCCESS,
                    payload: {
                        detailKey,
                        requestId: request.requestId,
                        data: history,
                        coveredFromTime: targetFromTime,
                        complete,
                        loadedAt
                    }
                });
                writeGuardianHistoryCache(
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
            clearGuardianHistoryRequest(request);
        }
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
        abortGuardianReloadRefreshForOtherDetail(dispatch, key);
        hydrateGuardianDetail(key, normalizedAddress, chain, dispatch, getState);
        dispatch({
            type: types.GUARDIAN.SELECT_GUARDIAN_DETAIL,
            payload: { key }
        });

        if (shouldRefreshGuardianCache(getState(), key, normalizedAddress)) {
            return refreshCachedGuardianHistory(normalizedAddress, web3, chain, key, dispatch, getState);
        }
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
