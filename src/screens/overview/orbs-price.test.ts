import { afterEach, expect, it, vi } from 'vitest';
import { fetchOrbsPrice, parseOrbsPrice } from './orbs-price';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('maps USD and signed 24-hour percentage without converting it again', () => {
    expect(parseOrbsPrice({ orbs: { usd: 0.012345, usd_24h_change: -2.7 } })).toEqual({ usd: 0.012345, change24h: -2.7 });
    expect(parseOrbsPrice({ orbs: { usd: 1, usd_24h_change: 0 } })?.change24h).toBe(0);
    expect(parseOrbsPrice({ orbs: { usd: 1, usd_24h_change: null } })?.change24h).toBe(null);
    for (const usd of [null, '0.01', 0, -1, Infinity, NaN]) expect(parseOrbsPrice({ orbs: { usd } })).toBe(null);
    expect(parseOrbsPrice({})).toBe(null);
});
it('returns no price on HTTP, network or malformed body failures', async () => {
    for (const response of [() => Promise.resolve({ ok: false }), () => Promise.reject(new Error()), () => Promise.resolve({ ok: true, json: async () => { throw new Error(); } })]) {
        vi.stubGlobal('fetch', vi.fn(response));
        expect(await fetchOrbsPrice()).toBe(null);
    }
});
it('times out including stalled body reading', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: () => new Promise(() => {}) })));
    const result = fetchOrbsPrice();
    await vi.advanceTimersByTimeAsync(8000);
    expect(await result).toBe(null);
});
