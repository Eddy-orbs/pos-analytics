import {
    DelegatorCurrent,
    DelegatorInfo,
    DelegatorStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { ChartUnit } from '../../global/enums';
import { ChartData } from '../../global/types';
import { DetailCurrentEntry, DetailHistoryUnit, DetailRangeHistoryEntry } from './detail-types';

export interface DelegatorState {
    selectedDelegator?: DelegatorInfo;
    delegatorCurrent?: DelegatorCurrent;
    delegatorNotFound: boolean;
    delegatorIsLoading: boolean;
    delegatorCurrentError?: string;
    delegatorHistoryIsLoading: boolean;
    delegatorHistoryError?: string;
    delegatorChartData?: ChartData;
    activeDelegatorKey?: string;
    activeDelegatorHistoryUnit: DetailHistoryUnit;
    historyUnitByKey: { [key: string]: DetailHistoryUnit };
    currentByKey: { [key: string]: DetailCurrentEntry<DelegatorCurrent> };
    /** Raw event history keyed only by chain + Delegator address. */
    historyByKey: { [key: string]: DetailRangeHistoryEntry<DelegatorStakeHistory> };
}

export const DEFAULT_DELEGATOR_HISTORY_UNIT: DetailHistoryUnit = ChartUnit.WEEK;
