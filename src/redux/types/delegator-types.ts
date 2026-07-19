import {
    DelegatorCurrent,
    DelegatorInfo,
    DelegatorStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { ChartUnit } from '../../global/enums';
import { ChartData } from '../../global/types';
import { DetailCurrentEntry, DetailHistoryEntry, DetailHistoryUnit } from './detail-types';

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
    currentByKey: { [key: string]: DetailCurrentEntry<DelegatorCurrent> };
    historyByKey: { [key: string]: DetailHistoryEntry<DelegatorStakeHistory> };
}

export const DEFAULT_DELEGATOR_HISTORY_UNIT: DetailHistoryUnit = ChartUnit.WEEK;
