import {
    Guardian,
    GuardianCurrent,
    GuardianDelegatorPageItem,
    GuardianInfo,
    GuardianStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { ChartUnit } from '../../global/enums';
import { ChartData } from '../../global/types';
import { DetailCurrentEntry, DetailHistoryEntry, DetailHistoryUnit } from './detail-types';
import { CHAINS } from '../../types';

export interface GuardianDelegatorsPageEntry {
    key: string;
    address: string;
    chain: CHAINS;
    requestId?: string;
    status: 'idle' | 'loading' | 'loaded' | 'error';
    items: GuardianDelegatorPageItem[];
    total: number;
    nextCursor?: string;
    asOfBlock?: number;
    error?: string;
    loadedAt?: number;
}

export interface GuardiansState {
    selectedGuardian?: GuardianInfo;
    guardianCurrent?: GuardianCurrent;
    guardians?: Guardian[];
    guardianNotFound: boolean;
    guardianIsLoading: boolean;
    guardianCurrentError?: string;
    guardianHistoryIsLoading: boolean;
    guardianHistoryError?: string;
    guardianChartData?: ChartData;
    guardiansColors?: { [id: string]: string };
    activeGuardianKey?: string;
    activeGuardianHistoryUnit: DetailHistoryUnit;
    currentByKey: { [key: string]: DetailCurrentEntry<GuardianCurrent> };
    historyByKey: { [key: string]: DetailHistoryEntry<GuardianStakeHistory> };
    delegatorsByKey: { [key: string]: GuardianDelegatorsPageEntry };
}

export const DEFAULT_GUARDIAN_HISTORY_UNIT: DetailHistoryUnit = ChartUnit.WEEK;
