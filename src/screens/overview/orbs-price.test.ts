import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createOrbsPriceReader, parseOrbsPrice } from './orbs-price';
beforeEach(() => { vi.stubEnv('REACT_APP_COINGECKO_API_KEY_ALT', ''); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
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
        expect(await createOrbsPriceReader()()).toBe(null);
    }
});
it('times out including stalled body reading', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: () => new Promise(() => {}) })));
    const result = createOrbsPriceReader()();
    await vi.advanceTimersByTimeAsync(8000);
    expect(await result).toBe(null);
});

function mockStorage() {
    const entries = new Map<string, string>();
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
    });
    return entries;
}
function mockPrice() {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ orbs: { usd: 0.01, usd_24h_change: 2 } }) }));
    vi.stubGlobal('fetch', fetch);
    return fetch;
}
it('shares persisted prices across reloads for ten minutes, then refreshes', async () => {
    vi.useFakeTimers();
    mockStorage();
    const fetch = mockPrice();
    const first = createOrbsPriceReader();
    expect(await first()).toEqual({ usd: 0.01, change24h: 2 });
    await vi.advanceTimersByTimeAsync(599999);
    expect(await createOrbsPriceReader()()).toEqual({ usd: 0.01, change24h: 2 });
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await first();
    expect(fetch).toHaveBeenCalledTimes(2);
});
it('merges simultaneous reads and serializes tabs through Web Locks', async () => {
    mockStorage();
    let queue: Promise<unknown> = Promise.resolve();
    vi.stubGlobal('navigator', { locks: { request: (_key: string, callback: () => Promise<unknown>) => {
        queue = queue.then(callback);
        return queue;
    } } });
    const fetch = mockPrice();
    const first = createOrbsPriceReader();
    const results = await Promise.all([first(), first(), createOrbsPriceReader()()]);
    expect(results).toEqual(Array(3).fill({ usd: 0.01, change24h: 2 }));
    expect(fetch).toHaveBeenCalledTimes(1);
});
it('retries immediately after a failed read, including after reload', async () => {
    mockStorage();
    const fetch = vi.fn(async () => ({ ok: false }));
    vi.stubGlobal('fetch', fetch);
    const reader = createOrbsPriceReader();
    expect(await reader()).toBe(null);
    expect(await createOrbsPriceReader()()).toBe(null);
    expect(await reader()).toBe(null);
    expect(fetch).toHaveBeenCalledTimes(3);
});
it('uses page-local caching when browser storage is blocked', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); } });
    const fetch = mockPrice();
    const reader = createOrbsPriceReader();
    await reader();
    await reader();
    expect(fetch).toHaveBeenCalledTimes(1);
});
it('ignores corrupted persistent cache', async () => {
    const entries = mockStorage();
    entries.set('orbs:usd-price:v2', '{invalid');
    const fetch = mockPrice();
    expect(await createOrbsPriceReader()()).not.toBe(null);
    expect(fetch).toHaveBeenCalledTimes(1);
});

it('falls back once to the optional key and persists the successful result', async () => {
    mockStorage();
    vi.stubEnv('REACT_APP_COINGECKO_API_KEY', 'test-main');
    vi.stubEnv('REACT_APP_COINGECKO_API_KEY_ALT', 'test-alt');
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({
        ok: true, json: async () => ({ orbs: { usd: 1 } })
    });
    vi.stubGlobal('fetch', fetch);
    expect((await createOrbsPriceReader()())?.usd).toBe(1);
    expect(fetch.mock.calls[0][0]).toContain('x_cg_demo_api_key=test-main');
    expect(fetch.mock.calls[1][0]).toContain('x_cg_demo_api_key=test-alt');
    expect((await createOrbsPriceReader()())?.usd).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(2);
});
it('does not request the alternative after primary success or for identical keys', async () => {
    vi.stubEnv('REACT_APP_COINGECKO_API_KEY', 'test-main');
    vi.stubEnv('REACT_APP_COINGECKO_API_KEY_ALT', 'test-alt');
    const fetch = mockPrice();
    await createOrbsPriceReader()();
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.stubEnv('REACT_APP_COINGECKO_API_KEY_ALT', 'test-main');
    fetch.mockResolvedValue({ ok: false, json: async () => ({ orbs: { usd: 0, usd_24h_change: 0 } }) });
    expect(await createOrbsPriceReader()()).toBe(null);
    expect(fetch).toHaveBeenCalledTimes(2);
});
it('retries primary first immediately after both keys fail', async () => {
    vi.useFakeTimers();
    mockStorage();
    vi.stubEnv('REACT_APP_COINGECKO_API_KEY', 'test-main');
    vi.stubEnv('REACT_APP_COINGECKO_API_KEY_ALT', 'test-alt');
    const fetch = vi.fn(async () => ({ ok: false }));
    vi.stubGlobal('fetch', fetch);
    expect(await createOrbsPriceReader()()).toBe(null);
    await createOrbsPriceReader()();
    expect(fetch).toHaveBeenCalledTimes(4);
    expect((fetch.mock.calls[2] as unknown[])[0]).toContain('x_cg_demo_api_key=test-main');
});
