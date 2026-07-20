import { PosOverview } from 'pos-analytics-graph';

export interface OverviewState {
    overviewData?: PosOverview;
    overviewStakeChartData?: any;
    overviewWeightsChartData?: any;
    overviewDataLoding: boolean;
}
