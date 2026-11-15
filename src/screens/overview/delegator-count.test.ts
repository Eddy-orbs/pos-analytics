import { expect, it } from 'vitest';
import { officialDelegatorCount } from './delegator-count';

it('sums the selected official network totals without deduplicating across guardians or chains', () => {
    const payload = { EthDelegators: { guardianA: 324, guardianB: 74 }, MaticDelegators: { guardianA: 62, guardianB: 11 } };
    expect(officialDelegatorCount(payload, 1)).toBe(398);
    expect(officialDelegatorCount(payload, 137)).toBe(73);
    expect(officialDelegatorCount({ EthDelegators: { guardianA: 0 } }, 1)).toBe(0);
});

it('distinguishes unavailable or invalid counts from a valid zero and never returns partial totals', () => {
    for (const counts of [null, [], '324', { a: 3, b: -1 }, { a: '3' }, { a: 1.5 }, { a: NaN }, { a: Number.MAX_SAFE_INTEGER, b: 1 }]) {
        expect(officialDelegatorCount({ EthDelegators: counts }, 1)).toBe(null);
    }
    expect(officialDelegatorCount({}, 1)).toBe(null);
    expect(officialDelegatorCount({ EthDelegators: { a: 2 } }, 137)).toBe(null);
    expect(officialDelegatorCount({ EthDelegators: { a: 2 } }, 999)).toBe(null);
});
