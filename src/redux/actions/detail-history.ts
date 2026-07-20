import { ChartUnit } from '../../global/enums';
import { CHAINS } from '../../types';
import { DetailHistoryUnit } from '../types/detail-types';
import { getUtcBucketWindows } from '../../utils/detail-history';

const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_WEEK = 7 * SECONDS_PER_DAY;
let requestSequence = 0;

export const DETAIL_CURRENT_CACHE_TTL_MS = 60 * 1000;
export const DETAIL_HISTORY_CACHE_TTL_MS = 5 * 60 * 1000;
export const GUARDIAN_CURRENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const GUARDIAN_HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const GUARDIAN_DELEGATORS_CACHE_TTL_MS = 5 * 60 * 1000;
export const DELEGATOR_CURRENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const DELEGATOR_HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const isDetailCacheFresh = (
    entry: { status: string; loadedAt?: number } | undefined,
    ttlMs: number,
    now: number = Date.now()
): boolean => !!entry &&
    entry.status === 'loaded' &&
    typeof entry.loadedAt === 'number' &&
    now - entry.loadedAt >= 0 &&
    now - entry.loadedAt < ttlMs;

export const doesDetailRangeCover = (
    entry: { data?: unknown; coveredFromTime?: number } | undefined,
    requestedFromTime: number
): boolean => !!entry &&
    !!entry.data &&
    typeof entry.coveredFromTime === 'number' &&
    entry.coveredFromTime <= requestedFromTime;

/** A raw range can remain usable while a wider background extension is loading. */
export const isDetailRangeCacheFresh = (
    entry: { data?: unknown; coveredFromTime?: number; loadedAt?: number } | undefined,
    requestedFromTime: number,
    ttlMs: number,
    now: number = Date.now()
): boolean => {
    if (!doesDetailRangeCover(entry, requestedFromTime) || !entry || typeof entry.loadedAt !== 'number') {
        return false;
    }
    return now - entry.loadedAt >= 0 && now - entry.loadedAt < ttlMs;
};

export const detailLoadErrorMessage = (error: unknown, fallback: string): string => {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) {
        return `${fallback} (RPC rate limit)`;
    }
    if (message.includes('timeout') || message.includes('network') || message.includes('connection')) {
        return `${fallback} (RPC unavailable)`;
    }
    return fallback;
};

export const normalizeDetailAddress = (address: string): string => address.trim().toLowerCase();

export const getDetailKey = (chain: CHAINS, address: string): string =>
    `${chain}:${normalizeDetailAddress(address)}`;

export const getDetailHistoryKey = (chain: CHAINS, address: string, unit: DetailHistoryUnit): string =>
    `${getDetailKey(chain, address)}:${unit}`;

export const nextDetailRequestId = (scope: string): string => {
    requestSequence += 1;
    return `${scope}:${Date.now()}:${requestSequence}`;
};

export const isDetailHistoryUnit = (unit: ChartUnit): unit is DetailHistoryUnit =>
    unit === ChartUnit.DAY || unit === ChartUnit.WEEK || unit === ChartUnit.MONTH;

/**
 * Archive-state sample points used by a detail chart. The first timestamp is
 * the oldest bucket start; the remaining values are every bucket end. This
 * yields 11 sample points for ten displayed UTC buckets.
 */
export const getDetailHistorySampleTimestamps = (
    unit: DetailHistoryUnit,
    asOfTime: number
): number[] => {
    const count = 10;
    const windows = getUtcBucketWindows(unit, Math.floor(asOfTime) * 1000, count);
    const timestamps = [windows[0].startMs, ...windows.map((window) => window.endMs)]
        .map((timestampMs) => Math.floor(timestampMs / 1000));
    return timestamps.filter((timestamp, index) => index === 0 || timestamp !== timestamps[index - 1]);
};

/**
 * Returns the start of the oldest UTC calendar bucket requested by a detail
 * chart. The current partial bucket counts toward the requested total.
 */
export const getDetailHistoryStartTime = (unit: DetailHistoryUnit, asOfTime: number): number => {
    if (!Number.isFinite(asOfTime) || asOfTime < 0) {
        throw new RangeError(`Invalid history reference time: ${asOfTime}`);
    }
    const asOf = new Date(Math.floor(asOfTime) * 1000);
    if (unit === ChartUnit.DAY) {
        const currentDayStart = Date.UTC(
            asOf.getUTCFullYear(),
            asOf.getUTCMonth(),
            asOf.getUTCDate()
        ) / 1000;
        return currentDayStart - 9 * SECONDS_PER_DAY;
    }
    if (unit === ChartUnit.WEEK) {
        const daysSinceMonday = (asOf.getUTCDay() + 6) % 7;
        const currentWeekStart = Date.UTC(
            asOf.getUTCFullYear(),
            asOf.getUTCMonth(),
            asOf.getUTCDate() - daysSinceMonday
        ) / 1000;
        return currentWeekStart - 9 * SECONDS_PER_WEEK;
    }
    return Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 9, 1) / 1000;
};
