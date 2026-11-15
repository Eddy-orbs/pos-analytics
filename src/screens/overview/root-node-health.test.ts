import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyRootNodeHealth, fetchRootNodeHealth, ROOT_NODE_HEALTH_URL } from './root-node-health';
const payload = (Status: unknown) => ({ Statuses: { 'Root Node Health': { Status } } });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('Root Node Health only', () => {
    it('requires exact Green and ignores other services', () => {
        expect(classifyRootNodeHealth({ ...payload('Green'), other: { Status: 'Red' } })).toBe('GOOD');
        for (const value of ['green', 'GREEN', 'Green ', 'Yellow', 'Red', '', null, false, 0]) {
            expect(classifyRootNodeHealth(payload(value))).toBe('DEGRADED');
        }
    });
    it('returns unavailable for missing fields regardless of other healthy services', () => {
        for (const value of [null, {}, { Statuses: {} }, { Statuses: { 'Root Node Health': {} } }, { Statuses: { Other: { Status: 'Green' } } }]) {
            expect(classifyRootNodeHealth(value)).toBe(null);
        }
    });
    it('uses the specified endpoint and successful body', async () => {
        const request = vi.fn().mockResolvedValue({ ok: true, json: async () => payload('Green') });
        vi.stubGlobal('fetch', request);
        expect(await fetchRootNodeHealth()).toBe('GOOD');
        expect(request.mock.calls[0][0]).toBe(ROOT_NODE_HEALTH_URL);
    });
    it('returns unavailable for HTTP, network and JSON failures', async () => {
        for (const response of [
            () => Promise.resolve({ ok: false, json: async () => payload('Green') }),
            () => Promise.reject(new Error('network')),
            () => Promise.resolve({ ok: true, json: async () => { throw new Error('JSON'); } })
        ]) {
            vi.stubGlobal('fetch', vi.fn(response));
            expect(await fetchRootNodeHealth()).toBe(null);
        }
    });
    it.each(['headers', 'body'])('returns unavailable at exactly 10 seconds while waiting for %s', async phase => {
        vi.useFakeTimers();
        const pending = new Promise(() => {});
        const request = vi.fn().mockImplementation(() => phase === 'headers' ? pending : Promise.resolve({ ok: true, json: () => pending }));
        vi.stubGlobal('fetch', request);
        let finished = false;
        const result = fetchRootNodeHealth().then(value => { finished = true; return value; });
        await vi.advanceTimersByTimeAsync(9999);
        expect(finished).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(await result).toBe(null);
        expect(request.mock.calls[0][1].signal.aborted).toBe(true);
    });
});

it('accepts a successful response after the old four-second deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => setTimeout(() => resolve({ ok: true, json: async () => payload('Green') }), 5000))));
    const result = fetchRootNodeHealth();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toBe('GOOD');
});

it('returns health and both delegator totals from a single shared request', async () => {
    const { fetchNetworkStatus } = await import('./root-node-health');
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...payload('Green'), EthDelegators: { a: 324, b: 74 }, MaticDelegators: { a: 62 } }) });
    vi.stubGlobal('fetch', request);
    expect(await fetchNetworkStatus()).toEqual({ health: 'GOOD', ethDelegators: 398, polygonDelegators: 62 });
    expect(request).toHaveBeenCalledTimes(1);
});

it('keeps independent status fields usable when another field is missing', async () => {
    const { fetchNetworkStatus } = await import('./root-node-health');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ EthDelegators: { a: 4 } }) }));
    expect(await fetchNetworkStatus()).toEqual({ health: null, ethDelegators: 4, polygonDelegators: null });
});
