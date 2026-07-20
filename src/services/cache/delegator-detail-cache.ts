import {
    DelegatorCurrent,
    DelegatorStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { CHAINS } from '../../types';

const STORAGE_KEY = 'orbs-analytics:delegator-detail-cache:v1';
const STORAGE_VERSION = 1;
const MAX_ENTRIES = 100;

interface PersistedCurrent {
    data: DelegatorCurrent;
    loadedAt: number;
}

interface PersistedHistory {
    data: DelegatorStakeHistory;
    coveredFromTime: number;
    latestBlock: number;
    loadedAt: number;
}

interface PersistedDelegatorDetail {
    detailKey: string;
    address: string;
    chain: CHAINS;
    lastAccessedAt: number;
    current?: PersistedCurrent;
    history?: PersistedHistory;
}

interface PersistedDelegatorDetailStore {
    version: number;
    entries: { [detailKey: string]: PersistedDelegatorDetail };
}

export interface DelegatorDetailCacheSnapshot {
    current?: PersistedCurrent;
    history?: PersistedHistory;
}

const emptyStore = (): PersistedDelegatorDetailStore => ({
    version: STORAGE_VERSION,
    entries: {}
});

const storage = (): Storage | undefined => {
    try {
        return typeof window !== 'undefined' ? window.localStorage : undefined;
    } catch (_error) {
        return undefined;
    }
};

const finiteNonNegative = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;

const validChain = (value: unknown): value is CHAINS =>
    value === CHAINS.ETHEREUM || value === CHAINS.POLYGON;

const validCurrent = (value: any, address: string): value is PersistedCurrent =>
    !!value &&
    finiteNonNegative(value.loadedAt) &&
    !!value.data &&
    String(value.data.address || '').toLowerCase() === address &&
    finiteNonNegative(value.data.block_number) &&
    finiteNonNegative(value.data.block_time) &&
    finiteNonNegative(value.data.total_stake) &&
    finiteNonNegative(value.data.cooldown_stake);

const validHistorySlice = (value: any): boolean =>
    !!value &&
    finiteNonNegative(value.block_number) &&
    finiteNonNegative(value.block_time) &&
    finiteNonNegative(value.stake) &&
    finiteNonNegative(value.cooldown);

const validHistory = (value: any, address: string): value is PersistedHistory =>
    !!value &&
    finiteNonNegative(value.loadedAt) &&
    finiteNonNegative(value.coveredFromTime) &&
    finiteNonNegative(value.latestBlock) &&
    !!value.data &&
    String(value.data.address || '').toLowerCase() === address &&
    !!value.data.range &&
    finiteNonNegative(value.data.range.from_block) &&
    finiteNonNegative(value.data.range.to_block) &&
    value.data.range.from_block <= value.data.range.to_block &&
    value.latestBlock === value.data.range.to_block &&
    Array.isArray(value.data.stake_slices) &&
    value.data.stake_slices.every(validHistorySlice);

const readStore = (): PersistedDelegatorDetailStore => {
    const target = storage();
    if (!target) return emptyStore();
    try {
        const raw = target.getItem(STORAGE_KEY);
        if (!raw) return emptyStore();
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== STORAGE_VERSION || !parsed.entries || typeof parsed.entries !== 'object') {
            return emptyStore();
        }
        return parsed as PersistedDelegatorDetailStore;
    } catch (_error) {
        return emptyStore();
    }
};

const compactStore = (store: PersistedDelegatorDetailStore): PersistedDelegatorDetailStore => {
    const entries = Object.keys(store.entries)
        .map((key) => store.entries[key])
        .filter((entry) => !!entry && finiteNonNegative(entry.lastAccessedAt))
        .sort((left, right) => right.lastAccessedAt - left.lastAccessedAt)
        .slice(0, MAX_ENTRIES);
    return {
        version: STORAGE_VERSION,
        entries: entries.reduce((result, entry) => {
            result[entry.detailKey] = entry;
            return result;
        }, {} as { [detailKey: string]: PersistedDelegatorDetail })
    };
};

const writeStore = (store: PersistedDelegatorDetailStore): void => {
    const target = storage();
    if (!target) return;
    const compacted = compactStore(store);
    const newest = Object.keys(compacted.entries)
        .map((key) => compacted.entries[key])
        .sort((left, right) => right.lastAccessedAt - left.lastAccessedAt);
    if (newest.length === 0) {
        try {
            target.setItem(STORAGE_KEY, JSON.stringify(emptyStore()));
        } catch (_error) {
            // Storage can be disabled; persistence remains optional.
        }
        return;
    }
    while (newest.length > 0) {
        try {
            target.setItem(STORAGE_KEY, JSON.stringify({
                version: STORAGE_VERSION,
                entries: newest.reduce((result, entry) => {
                    result[entry.detailKey] = entry;
                    return result;
                }, {} as { [detailKey: string]: PersistedDelegatorDetail })
            }));
            return;
        } catch (_error) {
            newest.pop();
        }
    }
};

export const readDelegatorDetailCache = (
    detailKey: string,
    now: number = Date.now()
): DelegatorDetailCacheSnapshot => {
    const store = readStore();
    const entry = store.entries[detailKey];
    if (!entry || entry.detailKey !== detailKey || !validChain(entry.chain)) return {};
    const address = entry.address && entry.address.toLowerCase();
    if (!address || detailKey !== `${entry.chain}:${address}`) return {};

    // Time controls refresh cadence only. Valid data remains an incremental
    // baseline until the user or browser removes this origin's storage.
    const current = validCurrent(entry.current, address) ? entry.current : undefined;
    const history = validHistory(entry.history, address) ? entry.history : undefined;
    if (!current && !history) {
        delete store.entries[detailKey];
        writeStore(store);
        return {};
    }
    entry.current = current;
    entry.history = history;
    entry.lastAccessedAt = now;
    writeStore(store);
    return { current, history };
};

const updateEntry = (
    detailKey: string,
    address: string,
    chain: CHAINS,
    update: (entry: PersistedDelegatorDetail) => void,
    now: number
): void => {
    const store = readStore();
    const normalizedAddress = address.toLowerCase();
    const existing = store.entries[detailKey];
    const entry: PersistedDelegatorDetail = existing &&
        existing.detailKey === detailKey &&
        existing.address === normalizedAddress &&
        existing.chain === chain
        ? existing
        : { detailKey, address: normalizedAddress, chain, lastAccessedAt: now };
    update(entry);
    entry.lastAccessedAt = now;
    store.entries[detailKey] = entry;
    writeStore(store);
};

export const writeDelegatorCurrentCache = (
    detailKey: string,
    address: string,
    chain: CHAINS,
    data: DelegatorCurrent,
    loadedAt: number
): void => updateEntry(detailKey, address, chain, (entry) => {
    entry.current = { data, loadedAt };
}, loadedAt);

export const writeDelegatorHistoryCache = (
    detailKey: string,
    address: string,
    chain: CHAINS,
    data: DelegatorStakeHistory,
    coveredFromTime: number,
    latestBlock: number,
    loadedAt: number
): void => updateEntry(detailKey, address, chain, (entry) => {
    entry.history = { data, coveredFromTime, latestBlock, loadedAt };
}, loadedAt);

/** Test-only helper; production code never clears the persistent cache. */
export const clearDelegatorDetailCache = (): void => {
    const target = storage();
    if (!target) return;
    try {
        target.removeItem(STORAGE_KEY);
    } catch (_error) {
        // Persistence is optional when storage is unavailable.
    }
};
