import { normalizeInclusiveBlockRanges, subtractCoveredBlockRanges } from './history-range';

describe('history range utilities', () => {
    it('normalizes overlapping ranges without changing the input', () => {
        const ranges = [
            { fromBlock: 20, toBlock: 40 },
            { fromBlock: 10, toBlock: 25 },
            { fromBlock: 80, toBlock: 90 }
        ];

        expect(normalizeInclusiveBlockRanges(ranges)).toEqual([
            { fromBlock: 10, toBlock: 40 },
            { fromBlock: 80, toBlock: 90 }
        ]);
        expect(ranges).toEqual([
            { fromBlock: 20, toBlock: 40 },
            { fromBlock: 10, toBlock: 25 },
            { fromBlock: 80, toBlock: 90 }
        ]);
    });

    it('merges adjacent inclusive ranges', () => {
        expect(
            normalizeInclusiveBlockRanges([
                { fromBlock: 10, toBlock: 20 },
                { fromBlock: 21, toBlock: 30 }
            ])
        ).toEqual([{ fromBlock: 10, toBlock: 30 }]);
    });

    it('returns no gap when the requested range is fully covered', () => {
        expect(subtractCoveredBlockRanges({ fromBlock: 100, toBlock: 200 }, [{ fromBlock: 50, toBlock: 250 }])).toEqual(
            []
        );
    });

    it('returns every inclusive gap within the requested range', () => {
        expect(
            subtractCoveredBlockRanges({ fromBlock: 100, toBlock: 200 }, [
                { fromBlock: 150, toBlock: 170 },
                { fromBlock: 120, toBlock: 130 }
            ])
        ).toEqual([
            { fromBlock: 100, toBlock: 119 },
            { fromBlock: 131, toBlock: 149 },
            { fromBlock: 171, toBlock: 200 }
        ]);
    });
});
