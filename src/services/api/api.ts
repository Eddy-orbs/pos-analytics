import {
    DelegatorCurrent,
    DelegatorStakeHistory,
    getDelegatorCurrent,
    getDelegatorStakeHistory,
    getGuardianCurrent,
    getGuardianDelegatorsPage,
    getGuardianStakeHistory,
    getGuardians,
    GuardianCurrent,
    GuardianDelegatorsCacheSnapshot,
    GuardianDelegatorsPage,
    GuardianStakeHistoryAnchorSnapshot,
    GuardianStakeHistory,
    getOverview,
    resolveBlockAtOrAfterTimestamp
} from '@orbs-network/pos-analytics-lib';
import axios from 'axios';
import { indexedDelegatorHistoryEnabled, subgraphBaseUrl } from '../../config';
import { SupportedLanguage } from '../../global/types';
import { LOCAIZE_API, LOCAIZE_PROJECT_ID } from '../../global/variables';

class Api {
    async getDelegatorCurrentApi(address: string, web3: any): Promise<DelegatorCurrent> {
        return getDelegatorCurrent(address, web3);
    }

    async getGuardianCurrentApi(address: string, web3: any): Promise<GuardianCurrent> {
        return getGuardianCurrent(address, web3);
    }

    async getGuardianDelegatorsPageApi(
        address: string,
        web3: any,
        cursor?: string,
        signal?: AbortSignal,
        cachedSnapshot?: GuardianDelegatorsCacheSnapshot
    ): Promise<GuardianDelegatorsPage | undefined> {
        try {
            return await getGuardianDelegatorsPage(address, web3, {
                cursor,
                page_size: 50,
                signal,
                cached_snapshot: cachedSnapshot,
                subgraph_base_url: subgraphBaseUrl
            });
        } catch (error) {
            return undefined;
        }
    }

    async resolveHistoryStartBlockApi(web3: any, fromTime: number, signal?: AbortSignal): Promise<number | undefined> {
        try {
            return await resolveBlockAtOrAfterTimestamp(web3, fromTime, {
                signal,
                minRequestIntervalMs: 150
            });
        } catch (error) {
            return undefined;
        }
    }

    async getDelegatorStakeHistoryApi(
        address: string,
        web3: any,
        fromBlock: number,
        signal?: AbortSignal,
        currentSnapshot?: DelegatorCurrent,
        mutableCacheTtlMs: number = 0
    ): Promise<DelegatorStakeHistory | undefined> {
        try {
            return await getDelegatorStakeHistory(address, web3, {
                from_block: fromBlock,
                current_snapshot: currentSnapshot,
                signal,
                ...(indexedDelegatorHistoryEnabled ? { subgraph_base_url: subgraphBaseUrl } : {}),
                event_query_options: {
                    cache: true,
                    cacheMutableForMs: mutableCacheTtlMs,
                    loadHistoricalContractManifest: false,
                    minRequestIntervalMs: 150,
                    signal
                }
            });
        } catch (error) {
            return undefined;
        }
    }

    async getDelegatorStakeHistoryFromTimeApi(
        address: string,
        web3: any,
        fromTime: number,
        signal?: AbortSignal,
        currentSnapshot?: DelegatorCurrent,
        mutableCacheTtlMs: number = 0
    ): Promise<DelegatorStakeHistory | undefined> {
        if (!indexedDelegatorHistoryEnabled) return undefined;
        try {
            return await getDelegatorStakeHistory(address, web3, {
                from_time: fromTime,
                current_snapshot: currentSnapshot,
                signal,
                subgraph_base_url: subgraphBaseUrl,
                event_query_options: {
                    cache: true,
                    cacheMutableForMs: mutableCacheTtlMs,
                    loadHistoricalContractManifest: false,
                    minRequestIntervalMs: 150,
                    signal
                }
            });
        } catch (error) {
            return undefined;
        }
    }

    async getGuardianStakeHistoryApi(
        address: string,
        web3: any,
        fromBlock: number,
        signal?: AbortSignal,
        currentSnapshot?: GuardianCurrent,
        mutableCacheTtlMs: number = 0,
        anchorSnapshot?: GuardianStakeHistoryAnchorSnapshot
    ): Promise<GuardianStakeHistory | undefined> {
        try {
            return await getGuardianStakeHistory(address, web3, {
                from_block: fromBlock,
                current_snapshot: currentSnapshot,
                guardian_anchor_snapshot: anchorSnapshot,
                signal,
                subgraph_base_url: subgraphBaseUrl,
                event_query_options: {
                    cache: true,
                    cacheMutableForMs: mutableCacheTtlMs,
                    loadHistoricalContractManifest: false,
                    minRequestIntervalMs: 150,
                    signal
                }
            });
        } catch (error) {
            return undefined;
        }
    }

    async getGuardianStakeHistoryFromTimeApi(
        address: string,
        web3: any,
        fromTime: number,
        signal?: AbortSignal,
        currentSnapshot?: GuardianCurrent,
        mutableCacheTtlMs: number = 0
    ): Promise<GuardianStakeHistory | undefined> {
        try {
            return await getGuardianStakeHistory(address, web3, {
                from_time: fromTime,
                current_snapshot: currentSnapshot,
                signal,
                subgraph_base_url: subgraphBaseUrl,
                event_query_options: {
                    cache: true,
                    cacheMutableForMs: mutableCacheTtlMs,
                    loadHistoricalContractManifest: false,
                    minRequestIntervalMs: 150,
                    signal
                }
            });
        } catch (error) {
            return undefined;
        }
    }

    async getGuardiansApi(nodeEndpoints: string[]) {
        try {
            return getGuardians(nodeEndpoints);
        } catch (error) {
            return null;
        }
    }
    async getOverviewApi(nodeEndpoints: string[], web3: any) {
        try {
            return getOverview(nodeEndpoints, web3);
        } catch (error) {
            console.log(error);
            
            return null;
        }
    }

    async getSupportedlanguages(): Promise<{ [id: string]: SupportedLanguage } | null> {
        try {
            const res = await axios.get(`${LOCAIZE_API}/languages/${LOCAIZE_PROJECT_ID}`);
            return res.data;
        } catch (error) {
            return null;
        }
    }
}

export const api = new Api();
