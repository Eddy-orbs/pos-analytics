import { ChartUnit } from '../global/enums';
import { ChartDatasetObject } from '../global/types';
import {
    DelegatorStake,
    DelegatorStakeHistory,
    GuardianStake,
    GuardianStakeHistory
} from '@orbs-network/pos-analytics-lib';

const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * MILLISECONDS_PER_SECOND;
const MILLISECONDS_PER_WEEK = 7 * 24 * 60 * 60 * MILLISECONDS_PER_SECOND;

export interface HistoryPointLike {
    block_number: number;
    /** Unix timestamp in seconds. */
    block_time: number;
    transactionHash?: string;
    transaction_hash?: string;
    tx_hash?: string;
    logIndex?: number | string;
    log_index?: number | string;
}

export interface HistoryTimeWindow {
    /** Inclusive Unix timestamp in seconds. */
    fromTime: number;
    /** Inclusive Unix timestamp in seconds. */
    toTime: number;
}

export interface AnchoredSeriesOptions {
    /** Value at the exact beginning of the requested window. */
    anchorValue?: number | null;
    /** Current value, written at the exact end of the requested window. */
    currentValue?: number | null;
}

export interface UtcBucketWindow {
    startMs: number;
    endMs: number;
}

export type HistoryKeySelector<T> = (point: T) => string;

const assertTimeWindow = ({ fromTime, toTime }: HistoryTimeWindow): void => {
    if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || toTime < fromTime) {
        throw new RangeError(`Invalid history time window: ${fromTime}-${toTime}`);
    }
};

const getTransactionHash = (point: HistoryPointLike): string | undefined =>
    point.transactionHash || point.transaction_hash || point.tx_hash;

const getLogIndex = (point: HistoryPointLike): number | string | undefined =>
    point.logIndex === undefined ? point.log_index : point.logIndex;

/**
 * Event identity prefers transaction hash + log index. Generated stake slices
 * do not currently retain those fields, so block + timestamp is the stable
 * fallback used to deduplicate overlapping RPC pages.
 */
export const getStableHistoryPointKey = (point: HistoryPointLike): string => {
    const transactionHash = getTransactionHash(point);
    const logIndex = getLogIndex(point);
    if (transactionHash && logIndex !== undefined) {
        return `event:${transactionHash.toLowerCase()}:${String(logIndex)}`;
    }
    return `slice:${point.block_number}:${point.block_time}`;
};

export const compareHistoryPoints = (a: HistoryPointLike, b: HistoryPointLike): number => {
    const blockDifference = a.block_number - b.block_number;
    if (blockDifference !== 0) return blockDifference;

    const aLogIndex = Number(getLogIndex(a));
    const bLogIndex = Number(getLogIndex(b));
    if (Number.isFinite(aLogIndex) && Number.isFinite(bLogIndex) && aLogIndex !== bLogIndex) {
        return aLogIndex - bLogIndex;
    }

    return a.block_time - b.block_time;
};

/**
 * Merges overlapping history pages. Later collections replace earlier values
 * with the same stable key, which lets a freshly fetched page refresh cache.
 */
export const mergeHistoryPoints = <T extends HistoryPointLike>(
    collections: ReadonlyArray<ReadonlyArray<T>>,
    keySelector: HistoryKeySelector<T> = getStableHistoryPointKey
): T[] => {
    const merged: T[] = [];
    const indexesByKey: { [key: string]: number } = Object.create(null);

    collections.forEach((collection) => {
        collection.forEach((point) => {
            const key = keySelector(point);
            const existingIndex = indexesByKey[key];
            if (existingIndex === undefined) {
                indexesByKey[key] = merged.length;
                merged.push(point);
            } else {
                merged[existingIndex] = point;
            }
        });
    });

    return merged.slice().sort(compareHistoryPoints);
};

const sameGuardianStake = (left: GuardianStake, right: GuardianStake): boolean =>
    left.self_stake === right.self_stake &&
    left.delegated_stake === right.delegated_stake &&
    left.total_stake === right.total_stake &&
    left.n_delegates === right.n_delegates;

/**
 * Appends an incremental Guardian response to one persisted raw range.
 * The delta's synthetic start anchor is dropped when the previous cached
 * endpoint already represents the same state.
 */
export const mergeGuardianStakeHistory = (
    cached: GuardianStakeHistory,
    delta: GuardianStakeHistory
): GuardianStakeHistory => {
    if (cached.address.toLowerCase() !== delta.address.toLowerCase()) {
        throw new Error('Cannot merge Guardian histories for different addresses');
    }
    if (delta.range.from_block > cached.range.to_block + 1) {
        throw new Error('Cannot merge Guardian histories with an uncovered block gap');
    }

    const cachedPoints = cached.stake_slices.slice().sort(compareHistoryPoints);
    let deltaPoints = delta.stake_slices.slice().sort(compareHistoryPoints);
    const cachedTail = cachedPoints[cachedPoints.length - 1];
    const deltaAnchor = deltaPoints[0];
    if (
        cachedTail &&
        deltaAnchor &&
        !getTransactionHash(deltaAnchor) &&
        getLogIndex(deltaAnchor) === undefined &&
        sameGuardianStake(cachedTail, deltaAnchor)
    ) {
        deltaPoints = deltaPoints.slice(1);
    }

    const notes = Array.from(new Set([
        ...(cached.data_quality.notes || []),
        ...(delta.data_quality.notes || [])
    ]));
    const countsAvailable = cached.data_quality.n_delegates_available === true &&
        delta.data_quality.n_delegates_available === true;
    const eventSource = cached.data_quality.event_source === 'subgraph+rpc-logs' ||
        delta.data_quality.event_source === 'subgraph+rpc-logs'
        ? 'subgraph+rpc-logs' as const
        : delta.data_quality.event_source || cached.data_quality.event_source;

    return {
        address: cached.address.toLowerCase(),
        range: {
            from_block: cached.range.from_block,
            to_block: Math.max(cached.range.to_block, delta.range.to_block),
            from_time: cached.range.from_time,
            to_time: delta.range.to_time === undefined ? cached.range.to_time : delta.range.to_time
        },
        stake_slices: mergeHistoryPoints([cachedPoints, deltaPoints]),
        data_quality: {
            ...cached.data_quality,
            exact: cached.data_quality.exact && delta.data_quality.exact,
            stake_values_exact: cached.data_quality.stake_values_exact && delta.data_quality.stake_values_exact,
            anchor_exact: cached.data_quality.anchor_exact,
            anchor_source: cached.data_quality.anchor_source,
            mode: 'event-reconstruction',
            event_source: eventSource,
            sampled_state: false,
            n_delegates_available: countsAvailable,
            n_delegates_source: countsAvailable
                ? delta.data_quality.n_delegates_source || cached.data_quality.n_delegates_source
                : 'unavailable',
            n_delegates_checkpoint_block: countsAvailable
                ? cached.data_quality.n_delegates_checkpoint_block || delta.data_quality.n_delegates_checkpoint_block
                : undefined,
            notes
        }
    };
};

const sameDelegatorStake = (left: DelegatorStake, right: DelegatorStake): boolean =>
    left.stake === right.stake && left.cooldown === right.cooldown;

/**
 * Appends an incremental Delegator response to one persisted raw range.
 * The first point of an incremental response is a synthetic pre-range
 * anchor, so it is omitted when the cached endpoint already has that state.
 */
export const mergeDelegatorStakeHistory = (
    cached: DelegatorStakeHistory,
    delta: DelegatorStakeHistory
): DelegatorStakeHistory => {
    if (cached.address.toLowerCase() !== delta.address.toLowerCase()) {
        throw new Error('Cannot merge Delegator histories for different addresses');
    }
    if (delta.range.from_block > cached.range.to_block + 1) {
        throw new Error('Cannot merge Delegator histories with an uncovered block gap');
    }

    // The incremental query deliberately overlaps the mutable finality tail.
    // Replace that entire suffix so logs removed by a reorg cannot survive in
    // the persisted cache merely because their event identity disappeared.
    const cachedPoints = cached.stake_slices
        .filter((point) => point.block_number < delta.range.from_block)
        .sort(compareHistoryPoints);
    let deltaPoints = delta.stake_slices.slice().sort(compareHistoryPoints);
    const cachedTail = cachedPoints[cachedPoints.length - 1];
    const deltaAnchor = deltaPoints[0];
    if (
        cachedTail &&
        deltaAnchor &&
        !getTransactionHash(deltaAnchor) &&
        getLogIndex(deltaAnchor) === undefined &&
        sameDelegatorStake(cachedTail, deltaAnchor)
    ) {
        deltaPoints = deltaPoints.slice(1);
    }

    return {
        address: cached.address.toLowerCase(),
        range: {
            from_block: cached.range.from_block,
            to_block: Math.max(cached.range.to_block, delta.range.to_block),
            from_time: cached.range.from_time,
            to_time: delta.range.to_time === undefined ? cached.range.to_time : delta.range.to_time
        },
        stake_slices: mergeHistoryPoints([cachedPoints, deltaPoints]),
        data_quality: {
            ...cached.data_quality,
            exact: cached.data_quality.exact && delta.data_quality.exact,
            stake_values_exact: cached.data_quality.stake_values_exact && delta.data_quality.stake_values_exact,
            anchor_exact: cached.data_quality.anchor_exact,
            anchor_source: cached.data_quality.anchor_source,
            mode: 'event-reconstruction',
            event_source: cached.data_quality.event_source === 'subgraph+rpc-logs' ||
                delta.data_quality.event_source === 'subgraph+rpc-logs'
                ? 'subgraph+rpc-logs'
                : delta.data_quality.event_source || cached.data_quality.event_source,
            sampled_state: false,
            notes: Array.from(new Set([
                ...(cached.data_quality.notes || []),
                ...(delta.data_quality.notes || [])
            ]))
        }
    };
};

/** Filters by the exact inclusive timestamp window and returns a sorted copy. */
export const filterHistoryWindow = <T extends HistoryPointLike>(
    points: ReadonlyArray<T>,
    window: HistoryTimeWindow
): T[] => {
    assertTimeWindow(window);
    return points
        .filter((point) => point.block_time >= window.fromTime && point.block_time <= window.toTime)
        .slice()
        .sort(compareHistoryPoints);
};

/**
 * Builds a step-series with a point at both exact window boundaries.
 * A point at or before `fromTime` is used as the anchor when available.
 * With no events, a supplied current value produces a two-point flat line.
 */
export const buildAnchoredWindowSeries = <T extends HistoryPointLike>(
    points: ReadonlyArray<T>,
    window: HistoryTimeWindow,
    valueSelector: (point: T) => number | null,
    options: AnchoredSeriesOptions = {}
): ChartDatasetObject[] => {
    assertTimeWindow(window);
    const sorted = points.slice().sort(compareHistoryPoints);
    let anchorValue = options.anchorValue;

    sorted.forEach((point) => {
        if (point.block_time <= window.fromTime) anchorValue = valueSelector(point);
    });

    if (anchorValue === undefined) anchorValue = options.currentValue === undefined ? null : options.currentValue;

    const fromMs = window.fromTime * MILLISECONDS_PER_SECOND;
    const toMs = window.toTime * MILLISECONDS_PER_SECOND;
    const series: ChartDatasetObject[] = [{ x: fromMs, y: anchorValue }];

    sorted.forEach((point) => {
        if (point.block_time <= window.fromTime || point.block_time > window.toTime) return;
        series.push({ x: point.block_time * MILLISECONDS_PER_SECOND, y: valueSelector(point) });
    });

    const latestValue = series[series.length - 1].y;
    const currentValue = options.currentValue === undefined ? latestValue : options.currentValue;
    if (toMs === fromMs) {
        series[0] = { x: toMs, y: currentValue };
    } else if (series[series.length - 1].x === toMs) {
        series[series.length - 1] = { x: toMs, y: currentValue };
    } else {
        series.push({ x: toMs, y: currentValue });
    }

    return series;
};

const startOfUtcDay = (timestampMs: number): number => {
    const date = new Date(timestampMs);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const startOfUtcWeek = (timestampMs: number): number => {
    const date = new Date(timestampMs);
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday);
};

const startOfUtcMonth = (timestampMs: number): number => {
    const date = new Date(timestampMs);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
};

const shiftUtcPeriodStart = (periodStartMs: number, unit: ChartUnit.DAY | ChartUnit.WEEK | ChartUnit.MONTH, amount: number): number => {
    if (unit === ChartUnit.DAY) return periodStartMs + amount * MILLISECONDS_PER_DAY;
    if (unit === ChartUnit.WEEK) return periodStartMs + amount * MILLISECONDS_PER_WEEK;

    const date = new Date(periodStartMs);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1);
};

/**
 * Produces calendar-aligned UTC buckets, oldest first. The last (currently
 * open) period ends at `asOfMs`; completed periods end one millisecond before
 * the next period starts.
 */
export const getUtcBucketWindows = (
    unit: ChartUnit.DAY | ChartUnit.WEEK | ChartUnit.MONTH,
    asOfMs: number,
    count: number = 10
): UtcBucketWindow[] => {
    if (unit !== ChartUnit.DAY && unit !== ChartUnit.WEEK && unit !== ChartUnit.MONTH) {
        throw new RangeError(`Unsupported history bucket unit: ${unit}`);
    }
    if (!Number.isFinite(asOfMs) || !Number.isInteger(count) || count <= 0) {
        throw new RangeError(`Invalid UTC bucket arguments: ${asOfMs}, ${count}`);
    }

    const currentPeriodStart = unit === ChartUnit.DAY
        ? startOfUtcDay(asOfMs)
        : unit === ChartUnit.WEEK
            ? startOfUtcWeek(asOfMs)
            : startOfUtcMonth(asOfMs);
    const firstPeriodStart = shiftUtcPeriodStart(currentPeriodStart, unit, -(count - 1));

    return Array.from({ length: count }, (_, index) => {
        const startMs = shiftUtcPeriodStart(firstPeriodStart, unit, index);
        const nextStartMs = shiftUtcPeriodStart(firstPeriodStart, unit, index + 1);
        return {
            startMs,
            endMs: index === count - 1 ? asOfMs : nextStartMs - 1
        };
    });
};

/**
 * Samples a step-series at each UTC period end. Always returns `count` points,
 * using null until the first known value.
 */
export const bucketSeriesByUtcPeriod = (
    series: ReadonlyArray<ChartDatasetObject>,
    unit: ChartUnit.DAY | ChartUnit.WEEK | ChartUnit.MONTH,
    asOfMs: number,
    count: number = 10
): ChartDatasetObject[] => {
    const buckets = getUtcBucketWindows(unit, asOfMs, count);
    const sorted = series.slice().sort((a, b) => a.x - b.x);
    let pointIndex = 0;
    let value: number | null = null;

    return buckets.map((bucket) => {
        while (pointIndex < sorted.length && sorted[pointIndex].x <= bucket.endMs) {
            value = sorted[pointIndex].y;
            pointIndex += 1;
        }
        return { x: bucket.endMs, y: value };
    });
};

/** Convenience transformation used by guardian/delegator detail charts. */
export const buildBucketedHistorySeries = <T extends HistoryPointLike>(
    points: ReadonlyArray<T>,
    unit: ChartUnit.DAY | ChartUnit.WEEK | ChartUnit.MONTH,
    asOfTime: number,
    valueSelector: (point: T) => number | null,
    options: AnchoredSeriesOptions = {},
    count: number = 10
): ChartDatasetObject[] => {
    const asOfMs = asOfTime * MILLISECONDS_PER_SECOND;
    const buckets = getUtcBucketWindows(unit, asOfMs, count);
    const window = {
        fromTime: Math.floor(buckets[0].startMs / MILLISECONDS_PER_SECOND),
        toTime: asOfTime
    };
    const anchored = buildAnchoredWindowSeries(points, window, valueSelector, options);
    return bucketSeriesByUtcPeriod(anchored, unit, asOfMs, count);
};
