import { Guardian, GuardianInfo } from 'pos-analytics-graph';
import { ChartData } from '../../global/types';

export interface GuardiansState {
    selectedGuardian?: GuardianInfo;
    guardians?: Guardian[];
    guardianNotFound: boolean;
    guardianIsLoading: boolean;
    guardianChartData?: ChartData;
    guardiansColors?: { [id: string]: string };
}
