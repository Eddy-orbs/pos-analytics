import {
    GuardianCurrent,
    GuardianDelegatorPageItem,
    GuardianDelegatorsCacheSnapshot,
    GuardianStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { CHAINS } from '../../types';

const STORAGE_KEY = 'orbs-analytics:guardian-detail-cache:v1';
const STORAGE_VERSION = 1;
// Time does not evict valid entries. The high LRU ceiling covers the practical
// Guardian population across both chains; the quota fallback below keeps as
// many recent entries as the browser actually permits for this origin.
const MAX_ENTRIES = 100;

interface PersistedCurrent {
    data: GuardianCurrent;
    loadedAt: number;
}

interface PersistedHistory {
    data: GuardianStakeHistory;
    coveredFromTime: number;
    latestBlock: number;
    loadedAt: number;
}

export interface PersistedGuardianDelegators {
    items: GuardianDelegatorPageItem[];
    total: number;
    nextCursor?: string;
    asOfBlock: number;
    cacheSnapshot: GuardianDelegatorsCacheSnapshot;
    loadedAt: number;
}

interface PersistedGuardianDetail {
    detailKey: string;
    address: string;
    chain: CHAINS;
    lastAccessedAt: number;
    current?: PersistedCurrent;
    history?: PersistedHistory;
    delegators?: PersistedGuardianDelegators;
}

interface PersistedGuardianDetailStore {
    version: number;
    entries: { [detailKey: string]: PersistedGuardianDetail };
}

export interface GuardianDetailCacheSnapshot {
    current?: PersistedCurrent;
    history?: PersistedHistory;
    delegators?: PersistedGuardianDelegators;
}

const emptyStore = (): PersistedGuardianDetailStore => ({
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
    finiteNonNegative(value.data.block_time);

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
    Array.isArray(value.data.stake_slices);

const validDelegatorPageItem = (value: any): value is GuardianDelegatorPageItem =>
    !!value &&
    typeof value.address === 'string' &&
    value.address.length > 0 &&
    finiteNonNegative(value.stake) &&
    finiteNonNegative(value.non_stake) &&
    finiteNonNegative(value.last_change_block) &&
    finiteNonNegative(value.last_change_time);

const validDelegatorSnapshot = (
    value: any,
    address: string,
    chain: CHAINS
): value is GuardianDelegatorsCacheSnapshot => {
    if (!value || String(value.guardian_address || '').toLowerCase() !== address) return false;
    const expectedChainId = chain === CHAINS.ETHEREUM ? 1 : 137;
    if (
        value.chain_id !== expectedChainId ||
        !finiteNonNegative(value.as_of_block) ||
        !finiteNonNegative(value.finality_blocks) ||
        (value.cache_source !== 'subgraph+rpc' && value.cache_source !== 'rpc-fallback') ||
        (value.subgraph_block !== undefined && !finiteNonNegative(value.subgraph_block)) ||
        !Array.isArray(value.items)
    ) return false;

    const seen: { [address: string]: boolean } = Object.create(null);
    return value.items.every((item: any) => {
        if (
            !item ||
            typeof item.address !== 'string' ||
            item.address.length === 0 ||
            !finiteNonNegative(item.stake) ||
            item.stake <= 0 ||
            !finiteNonNegative(item.last_change_block) ||
            item.last_change_block > value.as_of_block ||
            !finiteNonNegative(item.last_change_time)
        ) return false;
        const itemAddress = item.address.toLowerCase();
        if (itemAddress === address || seen[itemAddress]) return false;
        seen[itemAddress] = true;
        return true;
    });
};

const validDelegators = (
    value: any,
    address: string,
    chain: CHAINS
): value is PersistedGuardianDelegators => {
    if (
        !value ||
        !finiteNonNegative(value.loadedAt) ||
        !finiteNonNegative(value.total) ||
        !finiteNonNegative(value.asOfBlock) ||
        (value.nextCursor !== undefined && typeof value.nextCursor !== 'string') ||
        !Array.isArray(value.items) ||
        !value.items.every(validDelegatorPageItem) ||
        value.items.length > value.total ||
        !validDelegatorSnapshot(value.cacheSnapshot, address, chain) ||
        value.cacheSnapshot.as_of_block !== value.asOfBlock ||
        value.cacheSnapshot.items.length !== value.total
    ) return false;
    const activeAddresses: { [address: string]: boolean } = Object.create(null);
    value.cacheSnapshot.items.forEach((item: any) => {
        activeAddresses[item.address.toLowerCase()] = true;
    });
    return value.items.every((item: GuardianDelegatorPageItem) => activeAddresses[item.address.toLowerCase()]);
};

const readStore = (): PersistedGuardianDetailStore => {
    const target = storage();
    if (!target) return emptyStore();
    try {
        const raw = target.getItem(STORAGE_KEY);
        if (!raw) return emptyStore();
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== STORAGE_VERSION || !parsed.entries || typeof parsed.entries !== 'object') {
            return emptyStore();
        }
        return parsed as PersistedGuardianDetailStore;
    } catch (_error) {
        return emptyStore();
    }
};

const compactStore = (store: PersistedGuardianDetailStore): PersistedGuardianDetailStore => {
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
        }, {} as { [detailKey: string]: PersistedGuardianDetail })
    };
};

const writeStore = (store: PersistedGuardianDetailStore): void => {
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
            // Storage can be disabled; cache persistence must remain optional.
        }
        return;
    }

    // localStorage quota is browser/origin-specific. If the write does not
    // fit, evict one oldest entry at a time instead of expiring by age or
    // discarding half the useful cache in one step.
    while (newest.length > 0) {
        try {
            target.setItem(STORAGE_KEY, JSON.stringify({
                version: STORAGE_VERSION,
                entries: newest.reduce((result, entry) => {
                    result[entry.detailKey] = entry;
                    return result;
                }, {} as { [detailKey: string]: PersistedGuardianDetail })
            }));
            return;
        } catch (_retryError) {
            newest.pop();
        }
    }
    // Browser storage can be disabled or a single entry can exceed quota.
    // Persistence is an optimization, so leave the previous value untouched.
};

export const readGuardianDetailCache = (
    detailKey: string,
    now: number = Date.now()
): GuardianDetailCacheSnapshot => {
    const store = readStore();
    const entry = store.entries[detailKey];
    if (!entry || entry.detailKey !== detailKey || !validChain(entry.chain)) return {};
    const address = entry.address && entry.address.toLowerCase();
    if (!address || detailKey !== `${entry.chain}:${address}`) return {};

    // `loadedAt` controls refresh cadence only. Valid cached data never expires
    // by time and remains the baseline for a latestBlock + 1 delta refresh.
    const current = validCurrent(entry.current, address) ? entry.current : undefined;
    const history = validHistory(entry.history, address) ? entry.history : undefined;
    const delegators = validDelegators(entry.delegators, address, entry.chain) ? entry.delegators : undefined;

    if (!current && !history && !delegators) {
        delete store.entries[detailKey];
        writeStore(store);
        return {};
    }
    entry.current = current;
    entry.history = history;
    entry.delegators = delegators;
    entry.lastAccessedAt = now;
    writeStore(store);
    return { current, history, delegators };
};

const updateEntry = (
    detailKey: string,
    address: string,
    chain: CHAINS,
    update: (entry: PersistedGuardianDetail) => void,
    now: number
): void => {
    const store = readStore();
    const normalizedAddress = address.toLowerCase();
    const existing = store.entries[detailKey];
    const entry: PersistedGuardianDetail = existing &&
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

export const writeGuardianCurrentCache = (
    detailKey: string,
    address: string,
    chain: CHAINS,
    data: GuardianCurrent,
    loadedAt: number
): void => updateEntry(detailKey, address, chain, (entry) => {
    entry.current = { data, loadedAt };
}, loadedAt);

export const writeGuardianHistoryCache = (
    detailKey: string,
    address: string,
    chain: CHAINS,
    data: GuardianStakeHistory,
    coveredFromTime: number,
    latestBlock: number,
    loadedAt: number
): void => updateEntry(detailKey, address, chain, (entry) => {
    entry.history = { data, coveredFromTime, latestBlock, loadedAt };
}, loadedAt);

export const writeGuardianDelegatorsCache = (
    detailKey: string,
    address: string,
    chain: CHAINS,
    data: PersistedGuardianDelegators
): void => updateEntry(detailKey, address, chain, (entry) => {
    entry.delegators = data;
}, data.loadedAt);

/** Test-only helper; production code never clears the persistent cache. */
export const clearGuardianDetailCache = (): void => {
    const target = storage();
    if (!target) return;
    try {
        target.removeItem(STORAGE_KEY);
    } catch (_error) {
        // Ignore unavailable browser storage.
    }
};
