import { ChartUnit } from '../../global/enums';
import { CHAINS } from '../../types';
import { DetailHistoryUnit } from '../types/detail-types';
import { getUtcBucketWindows } from '../../utils/detail-history';

const SECONDS_PER_WEEK = 7 * 24 * 60 * 60;
let requestSequence = 0;

export const DETAIL_CURRENT_CACHE_TTL_MS = 60 * 1000;
export const DETAIL_HISTORY_CACHE_TTL_MS = 5 * 60 * 1000;
export const GUARDIAN_DELEGATORS_CACHE_TTL_MS = 5 * 60 * 1000;

export const isDetailCacheFresh = (
    entry: { status: string; loadedAt?: number } | undefined,
    ttlMs: number,
    now: number = Date.now()
): boolean => !!entry &&
    entry.status === 'loaded' &&
    typeof entry.loadedAt === 'number' &&
    now - entry.loadedAt >= 0 &&
    now - entry.loadedAt < ttlMs;

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
    unit === ChartUnit.WEEK || unit === ChartUnit.MONTH;

/**
 * Archive-state sample points used by a detail chart. The first timestamp is
 * the oldest bucket start; the remaining values are every bucket end. This
 * yields 11 sample points for the ten-week view and 13 for the twelve-month cache.
 */
export const getDetailHistorySampleTimestamps = (
    unit: DetailHistoryUnit,
    asOfTime: number
): number[] => {
    const count = unit === ChartUnit.WEEK ? 10 : 12;
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
    if (unit === ChartUnit.WEEK) {
        const daysSinceMonday = (asOf.getUTCDay() + 6) % 7;
        const currentWeekStart = Date.UTC(
            asOf.getUTCFullYear(),
            asOf.getUTCMonth(),
            asOf.getUTCDate() - daysSinceMonday
        ) / 1000;
        return currentWeekStart - 9 * SECONDS_PER_WEEK;
    }
    return Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 11, 1) / 1000;
};
