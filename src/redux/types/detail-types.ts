import { ChartUnit } from '../../global/enums';
import { CHAINS } from '../../types';

export type DetailHistoryUnit = ChartUnit.DAY | ChartUnit.WEEK | ChartUnit.MONTH;
export type DetailRequestStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface DetailCurrentEntry<T> {
    key: string;
    address: string;
    chain: CHAINS;
    requestId?: string;
    status: DetailRequestStatus;
    data?: T;
    error?: string;
    loadedAt?: number;
    notFound?: boolean;
}

export interface DetailHistoryEntry<T> extends DetailCurrentEntry<T> {
    detailKey: string;
    unit: DetailHistoryUnit;
}

/** One range-aware raw history resource shared by every chart period. */
export interface DetailRangeHistoryEntry<T> extends DetailCurrentEntry<T> {
    detailKey: string;
    /** Oldest requested Unix timestamp fully represented by `data`. */
    coveredFromTime?: number;
    /** Newest block represented by the raw event history. */
    latestBlock?: number;
    /** Oldest Unix timestamp requested by the active shared loader. */
    targetFromTime?: number;
}
