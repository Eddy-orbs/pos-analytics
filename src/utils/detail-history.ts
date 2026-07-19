import { ChartUnit } from '../global/enums';
import { ChartDatasetObject } from '../global/types';

const MILLISECONDS_PER_SECOND = 1000;
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

const startOfUtcWeek = (timestampMs: number): number => {
    const date = new Date(timestampMs);
    const daysSinceMonday = (date.getUTCDay() + 6) % 7;
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - daysSinceMonday);
};

const startOfUtcMonth = (timestampMs: number): number => {
    const date = new Date(timestampMs);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
};

const shiftUtcPeriodStart = (periodStartMs: number, unit: ChartUnit.WEEK | ChartUnit.MONTH, amount: number): number => {
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
    unit: ChartUnit.WEEK | ChartUnit.MONTH,
    asOfMs: number,
    count: number = 10
): UtcBucketWindow[] => {
    if (unit !== ChartUnit.WEEK && unit !== ChartUnit.MONTH) {
        throw new RangeError(`Unsupported history bucket unit: ${unit}`);
    }
    if (!Number.isFinite(asOfMs) || !Number.isInteger(count) || count <= 0) {
        throw new RangeError(`Invalid UTC bucket arguments: ${asOfMs}, ${count}`);
    }

    const currentPeriodStart = unit === ChartUnit.WEEK ? startOfUtcWeek(asOfMs) : startOfUtcMonth(asOfMs);
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
    unit: ChartUnit.WEEK | ChartUnit.MONTH,
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
    unit: ChartUnit.WEEK | ChartUnit.MONTH,
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
