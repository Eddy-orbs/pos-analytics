export interface InclusiveBlockRange {
    fromBlock: number;
    toBlock: number;
}

const assertBlockRange = ({ fromBlock, toBlock }: InclusiveBlockRange): void => {
    if (!Number.isInteger(fromBlock) || !Number.isInteger(toBlock) || fromBlock < 0 || toBlock < fromBlock) {
        throw new RangeError(`Invalid inclusive block range: ${fromBlock}-${toBlock}`);
    }
};

/**
 * Sorts inclusive block ranges and merges both overlaps and adjacency.
 * The input ranges are never changed.
 */
export const normalizeInclusiveBlockRanges = (ranges: ReadonlyArray<InclusiveBlockRange>): InclusiveBlockRange[] => {
    const sorted = ranges.map((range) => {
        assertBlockRange(range);
        return { ...range };
    });

    sorted.sort((a, b) => a.fromBlock - b.fromBlock || a.toBlock - b.toBlock);

    return sorted.reduce<InclusiveBlockRange[]>((normalized, range) => {
        const previous = normalized[normalized.length - 1];
        if (!previous || range.fromBlock > previous.toBlock + 1) {
            normalized.push(range);
            return normalized;
        }

        previous.toBlock = Math.max(previous.toBlock, range.toBlock);
        return normalized;
    }, []);
};

/**
 * Returns the inclusive pieces of `requested` which are not covered yet.
 */
export const subtractCoveredBlockRanges = (
    requested: InclusiveBlockRange,
    covered: ReadonlyArray<InclusiveBlockRange>
): InclusiveBlockRange[] => {
    assertBlockRange(requested);
    const normalizedCovered = normalizeInclusiveBlockRanges(covered);
    const missing: InclusiveBlockRange[] = [];
    let cursor = requested.fromBlock;

    normalizedCovered.forEach((range) => {
        if (cursor > requested.toBlock || range.toBlock < cursor || range.fromBlock > requested.toBlock) return;

        if (range.fromBlock > cursor) {
            missing.push({
                fromBlock: cursor,
                toBlock: Math.min(requested.toBlock, range.fromBlock - 1)
            });
        }

        cursor = Math.max(cursor, range.toBlock + 1);
    });

    if (cursor <= requested.toBlock) {
        missing.push({ fromBlock: cursor, toBlock: requested.toBlock });
    }

    return missing;
};
