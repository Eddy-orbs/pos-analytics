import { ChartUnit } from '../global/enums';
import {
    bucketSeriesByUtcPeriod,
    buildAnchoredWindowSeries,
    filterHistoryWindow,
    getUtcBucketWindows,
    mergeHistoryPoints
} from './detail-history';

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
