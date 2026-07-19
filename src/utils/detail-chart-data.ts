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
import { buildBucketedHistorySeries, HistoryPointLike } from './detail-history';

export type DetailChartUnit = ChartUnit.WEEK | ChartUnit.MONTH;

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

const buildDataset = <T extends HistoryPointLike>(
    points: ReadonlyArray<T>,
    unit: DetailChartUnit,
    asOfTime: number,
    valueSelector: (point: T) => number | null,
    currentValue: number | null,
    color: ChartColors,
    yAxis: ChartYaxis
): ChartDataset => {
    const boundary = getBoundaryValues(points, valueSelector);
    return {
        data: buildBucketedHistorySeries(
            points,
            unit,
            asOfTime,
            valueSelector,
            {
                // A history response starts with a synthetic range anchor. Use
                // it even when its resolved block lands just after a calendar
                // boundary.
                anchorValue: boundary.first,
                // Contract state is authoritative for the open bucket, even
                // if the last event precedes the current block.
                currentValue
            },
            DETAIL_CHART_BUCKET_COUNT
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
    const datasets: ChartDataset[] = [
        buildDataset(
            points,
            unit,
            current.block_time,
            (point: GuardianStake) => point.total_stake,
            current.stake_status.total_stake,
            ChartColors.TOTAL_STAKE,
            ChartYaxis.Y1
        ),
        buildDataset(
            points,
            unit,
            current.block_time,
            (point: GuardianStake) => point.self_stake,
            current.stake_status.self_stake,
            ChartColors.SELF_STAKE,
            ChartYaxis.Y1
        ),
        buildDataset(
            points,
            unit,
            current.block_time,
            (point: GuardianStake) => point.delegated_stake,
            current.stake_status.delegated_stake,
            ChartColors.DELEGATORS,
            ChartYaxis.Y1
        )
    ];

    // The current contracts do not expose an exact historical aggregate
    // delegator count. Keep that series out of the chart unless the producer
    // explicitly guarantees it.
    if (history.data_quality.n_delegates_available === true) {
        const delegateCount = getBoundaryValues(points, (point: GuardianStake) => point.n_delegates);
        datasets.push(
            buildDataset(
                points,
                unit,
                current.block_time,
                (point: GuardianStake) => point.n_delegates,
                delegateCount.last === undefined ? null : delegateCount.last,
                ChartColors.DELEGATORS,
                ChartYaxis.Y1
            )
        );
    }

    return { datasets, unit };
};

/** Converts lazy Delegator history/current resources into chart-ready data. */
export const buildDelegatorDetailChartData = (
    history: DelegatorStakeHistory,
    current: DelegatorCurrent,
    unit: DetailChartUnit
): ChartData => {
    const points = history.stake_slices;
    return {
        datasets: [
            buildDataset(
                points,
                unit,
                current.block_time,
                (point: DelegatorStake) => point.stake,
                current.total_stake,
                ChartColors.TOTAL_STAKE,
                ChartYaxis.Y1
            ),
            buildDataset(
                points,
                unit,
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
