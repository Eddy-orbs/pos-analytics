import { ChartUnit } from '../../global/enums';
import { CHAINS } from '../../types';

export type DetailHistoryUnit = ChartUnit.WEEK | ChartUnit.MONTH;
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
