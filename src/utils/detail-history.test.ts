import { ChartUnit } from '../global/enums';
import {
    bucketSeriesByUtcPeriod,
    buildAnchoredWindowSeries,
    filterHistoryWindow,
    getUtcBucketWindows,
    mergeGuardianStakeHistory,
    mergeHistoryPoints,
    mergeDelegatorStakeHistory
} from './detail-history';
import { DelegatorStakeHistory, GuardianStakeHistory } from '@orbs-network/pos-analytics-lib';

interface StakePoint {
    block_number: number;
    block_time: number;
    stake: number;
    transactionHash?: string;
    logIndex?: number;
}

describe('detail history utilities', () => {
    it('deduplicates overlapping pages by timestamp/block and sorts them', () => {
        const oldPage: StakePoint[] = [
            { block_number: 20, block_time: 200, stake: 2 },
            { block_number: 10, block_time: 100, stake: 1 }
        ];
        const freshPage: StakePoint[] = [
            { block_number: 20, block_time: 200, stake: 22 },
            { block_number: 30, block_time: 300, stake: 3 }
        ];

        expect(mergeHistoryPoints([oldPage, freshPage])).toEqual([
            { block_number: 10, block_time: 100, stake: 1 },
            { block_number: 20, block_time: 200, stake: 22 },
            { block_number: 30, block_time: 300, stake: 3 }
        ]);
        expect(oldPage[0].stake).toBe(2);
    });

    it('uses transaction hash and log index as the event key when present', () => {
        const first = { block_number: 10, block_time: 100, stake: 1, transactionHash: '0xABC', logIndex: 4 };
        const replacement = { ...first, stake: 9, transactionHash: '0xabc' };

        expect(mergeHistoryPoints([[first], [replacement]])).toEqual([replacement]);
    });

    it('merges a Guardian reload delta without duplicating its synthetic anchor', () => {
        const quality = {
            exact: true,
            stake_values_exact: true,
            anchor_exact: true,
            anchor_source: 'prior-event' as const,
            mode: 'event-reconstruction' as const,
            event_source: 'rpc-logs' as const,
            n_delegates_available: true,
            n_delegates_source: 'subgraph-checkpoint+range-events' as const
        };
        const cached: GuardianStakeHistory = {
            address: '0xabc',
            range: { from_block: 10, to_block: 100, from_time: 100, to_time: 1000 },
            stake_slices: [
                { block_number: 10, block_time: 100, self_stake: 10, delegated_stake: 20, total_stake: 30, n_delegates: 1 },
                { block_number: 100, block_time: 1000, self_stake: 20, delegated_stake: 30, total_stake: 50, n_delegates: 2 }
            ],
            data_quality: quality
        };
        const delta: GuardianStakeHistory = {
            address: '0xABC',
            range: { from_block: 101, to_block: 110, from_time: 1010, to_time: 1100 },
            stake_slices: [
                { block_number: 101, block_time: 1010, self_stake: 20, delegated_stake: 30, total_stake: 50, n_delegates: 2 },
                {
                    block_number: 105,
                    block_time: 1050,
                    self_stake: 25,
                    delegated_stake: 35,
                    total_stake: 60,
                    n_delegates: 3,
                    transaction_hash: '0xevent',
                    log_index: 0
                },
                { block_number: 110, block_time: 1100, self_stake: 25, delegated_stake: 35, total_stake: 60, n_delegates: 3 }
            ],
            data_quality: quality
        };

        const merged = mergeGuardianStakeHistory(cached, delta);

        expect(merged.range).toEqual({ from_block: 10, to_block: 110, from_time: 100, to_time: 1100 });
        expect(merged.stake_slices.map((point) => point.block_number)).toEqual([10, 100, 105, 110]);
        expect(merged.data_quality.exact).toBe(true);
        expect(merged.data_quality.n_delegates_available).toBe(true);
    });

    it('replaces the mutable Delegator finality tail during an overlapping refresh', () => {
        const rpcQuality = {
            exact: true,
            stake_values_exact: true,
            anchor_exact: true,
            anchor_source: 'current-state-reverse' as const,
            mode: 'event-reconstruction' as const,
            event_source: 'rpc-logs' as const
        };
        const cached: DelegatorStakeHistory = {
            address: '0xabc',
            range: { from_block: 10, to_block: 100, from_time: 100, to_time: 1000 },
            stake_slices: [
                { block_number: 10, block_time: 100, stake: 1, cooldown: 0 },
                {
                    block_number: 90,
                    block_time: 900,
                    stake: 9,
                    cooldown: 0,
                    transaction_hash: '0xorphaned',
                    log_index: 1
                },
                { block_number: 100, block_time: 1000, stake: 9, cooldown: 0 }
            ],
            data_quality: { ...rpcQuality, event_source: 'subgraph+rpc-logs' }
        };
        const delta: DelegatorStakeHistory = {
            address: '0xABC',
            range: { from_block: 80, to_block: 105, from_time: 800, to_time: 1050 },
            stake_slices: [
                { block_number: 80, block_time: 800, stake: 1, cooldown: 0 },
                {
                    block_number: 95,
                    block_time: 950,
                    stake: 5,
                    cooldown: 0,
                    transaction_hash: '0xcanonical',
                    log_index: 0
                },
                { block_number: 105, block_time: 1050, stake: 5, cooldown: 0 }
            ],
            data_quality: rpcQuality
        };

        const merged = mergeDelegatorStakeHistory(cached, delta);

        expect(merged.stake_slices.map((point) => point.block_number)).toEqual([10, 95, 105]);
        expect(merged.stake_slices.some((point) => point.transaction_hash === '0xorphaned')).toBe(false);
        expect(merged.data_quality.event_source).toBe('subgraph+rpc-logs');
    });

    it('filters an exact inclusive time window without changing its input', () => {
        const points: StakePoint[] = [
            { block_number: 1, block_time: 99, stake: 1 },
            { block_number: 2, block_time: 100, stake: 2 },
            { block_number: 3, block_time: 200, stake: 3 },
            { block_number: 4, block_time: 201, stake: 4 }
        ];

        expect(filterHistoryWindow(points, { fromTime: 100, toTime: 200 }).map((point) => point.stake)).toEqual([2, 3]);
        expect(points).toHaveLength(4);
    });

    it('builds an anchor and current flat line when no events exist', () => {
        expect(
            buildAnchoredWindowSeries<StakePoint>([], { fromTime: 100, toTime: 200 }, (point) => point.stake, {
                currentValue: 7
            })
        ).toEqual([
            { x: 100000, y: 7 },
            { x: 200000, y: 7 }
        ]);
    });

    it('creates ten ISO-week UTC buckets and samples their end values', () => {
        const asOfMs = Date.UTC(2026, 6, 15, 12, 0, 0);
        const windows = getUtcBucketWindows(ChartUnit.WEEK, asOfMs, 10);
        const source = Object.freeze([
            Object.freeze({ x: windows[0].startMs, y: 1 }),
            Object.freeze({ x: windows[5].startMs, y: 5 })
        ]);
        const output = bucketSeriesByUtcPeriod(source, ChartUnit.WEEK, asOfMs, 10);

        expect(output).toHaveLength(10);
        expect(output[0]).toEqual({ x: windows[0].endMs, y: 1 });
        expect(output[5]).toEqual({ x: windows[5].endMs, y: 5 });
        expect(output[9]).toEqual({ x: asOfMs, y: 5 });
        windows.slice(0, -1).forEach((window) => {
            const end = new Date(window.endMs);
            expect(end.getUTCDay()).toBe(0);
            expect([end.getUTCHours(), end.getUTCMinutes(), end.getUTCSeconds(), end.getUTCMilliseconds()]).toEqual([
                23,
                59,
                59,
                999
            ]);
        });
    });

    it('creates ten UTC-day buckets ending at the current instant', () => {
        const asOfMs = Date.UTC(2026, 6, 15, 12, 0, 0);
        const windows = getUtcBucketWindows(ChartUnit.DAY, asOfMs, 10);
        const output = bucketSeriesByUtcPeriod([{ x: windows[0].startMs, y: 7 }], ChartUnit.DAY, asOfMs, 10);

        expect(windows[0]).toEqual({
            startMs: Date.UTC(2026, 6, 6),
            endMs: Date.UTC(2026, 6, 7) - 1
        });
        expect(output).toHaveLength(10);
        expect(output[9]).toEqual({ x: asOfMs, y: 7 });
    });

    it('creates ten calendar-month UTC buckets ending at the current instant', () => {
        const asOfMs = Date.UTC(2026, 6, 15, 12, 0, 0);
        const windows = getUtcBucketWindows(ChartUnit.MONTH, asOfMs, 10);
        const output = bucketSeriesByUtcPeriod([{ x: windows[0].startMs, y: 42 }], ChartUnit.MONTH, asOfMs, 10);

        expect(output).toHaveLength(10);
        expect(windows[0]).toEqual({
            startMs: Date.UTC(2025, 9, 1),
            endMs: Date.UTC(2025, 10, 1) - 1
        });
        expect(output[8]).toEqual({ x: Date.UTC(2026, 6, 1) - 1, y: 42 });
        expect(output[9]).toEqual({ x: asOfMs, y: 42 });
    });
});
