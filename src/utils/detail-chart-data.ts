import {
    DelegatorCurrent,
    DelegatorStake,
    DelegatorStakeHistory,
    GuardianCurrent,
    GuardianStake,
    GuardianStakeHistory
} from '@orbs-network/pos-analytics-lib';
import { ChartColors, ChartUnit, ChartYaxis } from '../global/enums';
import { ChartData, ChartDataset } from '../global/types';
import {
    buildAnchoredWindowSeries,
    getUtcBucketWindows,
    HistoryPointLike
} from './detail-history';

export type DetailChartUnit = ChartUnit.DAY | ChartUnit.WEEK | ChartUnit.MONTH;

const DETAIL_CHART_BUCKET_COUNT = 10;

interface BoundaryValues {
    first?: number | null;
    last?: number | null;
}

const getBoundaryValues = <T extends HistoryPointLike>(
    points: ReadonlyArray<T>,
    valueSelector: (point: T) => number | null
): BoundaryValues => {
    if (points.length === 0) return {};

    const sorted = points.slice().sort((a, b) => {
        const blockDifference = a.block_number - b.block_number;
        return blockDifference === 0 ? a.block_time - b.block_time : blockDifference;
    });
    return {
        first: valueSelector(sorted[0]),
        last: valueSelector(sorted[sorted.length - 1])
    };
};

const buildEventDataset = <T extends HistoryPointLike>(
    points: ReadonlyArray<T>,
    fromTime: number,
    toTime: number,
    valueSelector: (point: T) => number | null,
    currentValue: number | null,
    color: ChartColors,
    yAxis: ChartYaxis
): ChartDataset => {
    const boundary = getBoundaryValues(points, valueSelector);
    return {
        data: buildAnchoredWindowSeries(
            points,
            { fromTime, toTime },
            valueSelector,
            { anchorValue: boundary.first, currentValue }
        ),
        color,
        yAxis
    };
};

/** Converts lazy Guardian history/current resources into chart-ready data. */
export const buildGuardianDetailChartData = (
    history: GuardianStakeHistory,
    current: GuardianCurrent,
    unit: DetailChartUnit
): ChartData => {
    const points = history.stake_slices;
    const windows = getUtcBucketWindows(unit, current.block_time * 1000, DETAIL_CHART_BUCKET_COUNT);
    const fromTime = Math.floor(windows[0].startMs / 1000);
    const datasets: ChartDataset[] = [
        buildEventDataset(
            points,
            fromTime,
            current.block_time,
            (point: GuardianStake) => point.total_stake,
            current.stake_status.total_stake,
            ChartColors.TOTAL_STAKE,
            ChartYaxis.Y2
        )
    ];

    if (history.data_quality.n_delegates_available === true) {
        const delegateCount = getBoundaryValues(points, (point: GuardianStake) => point.n_delegates);
        datasets.push(
            buildEventDataset(
                points,
                fromTime,
                current.block_time,
                (point: GuardianStake) => point.n_delegates,
                delegateCount.last === undefined ? null : delegateCount.last,
                ChartColors.DELEGATORS,
                ChartYaxis.Y1
            )
        );
    }

    datasets.push(
        buildEventDataset(
            points,
            fromTime,
            current.block_time,
            (point: GuardianStake) => point.self_stake,
            current.stake_status.self_stake,
            ChartColors.SELF_STAKE,
            ChartYaxis.Y2
        )
    );

    return { datasets, unit };
};

/** Converts lazy Delegator history/current resources into chart-ready data. */
export const buildDelegatorDetailChartData = (
    history: DelegatorStakeHistory,
    current: DelegatorCurrent,
    unit: DetailChartUnit
): ChartData => {
    const points = history.stake_slices;
    const windows = getUtcBucketWindows(unit, current.block_time * 1000, DETAIL_CHART_BUCKET_COUNT);
    const fromTime = Math.floor(windows[0].startMs / 1000);
    return {
        datasets: [
            buildEventDataset(
                points,
                fromTime,
                current.block_time,
                (point: DelegatorStake) => point.stake,
                current.total_stake,
                ChartColors.TOTAL_STAKE,
                ChartYaxis.Y1
            ),
            buildEventDataset(
                points,
                fromTime,
                current.block_time,
                (point: DelegatorStake) => point.cooldown,
                current.cooldown_stake,
                ChartColors.SELF_STAKE,
                ChartYaxis.Y1
            )
        ],
        unit
    };
};
