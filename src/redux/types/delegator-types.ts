import { DelegatorInfo } from 'pos-analytics-graph';
import { ChartData } from '../../global/types';

export interface DelegatorState {
    selectedDelegator?: DelegatorInfo;
    delegatorNotFound: boolean;
    delegatorIsLoading: boolean;
    delegatorChartData?: ChartData;
}
