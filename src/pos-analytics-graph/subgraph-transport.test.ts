import { afterEach, expect, it, vi } from 'vitest';
import { createSubgraphTransport, SUBGRAPH_TIMEOUT_MS } from './subgraph-transport';
const primary = 'https://official/eth', alt = 'https://local/eth';
const ok = (data: any = { stakeds: [] }) => ({ ok: true, json: async () => ({ data }) });
function setup() {
    const transport = createSubgraphTransport();
    transport.configure({ [primary]: alt, 'https://official/polygon': 'https://local/polygon' });
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    return { transport, fetcher };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('accepts empty results without calling alt', async () => {
    const { transport, fetcher } = setup(); fetcher.mockResolvedValue(ok());
    expect(await transport.post(primary, '{}')).toEqual({ stakeds: [] });
    expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([403, 408, 429, 500, 502, 503])('fails over on HTTP %s and keeps paging on alt', async (status) => {
    const { transport, fetcher } = setup();
    fetcher.mockResolvedValueOnce({ ok: false, status }).mockResolvedValue(ok());
    await transport.post(primary, '{}'); await transport.post(primary, '{}');
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([primary, alt, alt]);
    await transport.post('https://official/polygon', '{}');
    expect(fetcher.mock.calls[3][0]).toBe('https://official/polygon');
});
it('network failure falls back; a fresh transport starts at primary again', async () => {
    const { transport, fetcher } = setup();
    fetcher.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(ok());
    await transport.post(primary, '{}');
    const reloaded = createSubgraphTransport(); reloaded.configure({ [primary]: alt });
    await reloaded.post(primary, '{}');
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([primary, alt, primary]);
});
it('times out even if fetch does not settle and aborts primary', async () => {
    vi.useFakeTimers();
    const { transport, fetcher } = setup();
    fetcher.mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(ok());
    const result = transport.post(primary, '{}');
    await vi.advanceTimersByTimeAsync(SUBGRAPH_TIMEOUT_MS);
    await expect(result).resolves.toEqual({ stakeds: [] });
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});
it('rejects when both endpoints fail without returning empty success', async () => {
    const { transport, fetcher } = setup(); fetcher.mockRejectedValue(new Error('offline'));
    await expect(transport.post(primary, '{}')).rejects.toThrow('offline');
    expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([400, 422])('does not fail over on invalid HTTP query %s', async (status) => {
    const { transport, fetcher } = setup(); fetcher.mockResolvedValue({ ok: false, status });
    await expect(transport.post(primary, '{}')).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not hide GraphQL validation errors', async () => {
    const { transport, fetcher } = setup();
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ errors: [{ message: 'Cannot query field missing' }] }) });
    await expect(transport.post(primary, '{}')).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([{ data: null }, { errors: [{ message: 'indexing_error' }], data: { stakeds: [] } }])('fails over on unusable or partial GraphQL response', async (payload) => {
    const { transport, fetcher } = setup();
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => payload }).mockResolvedValue(ok());
    await expect(transport.post(primary, '{}')).resolves.toEqual({ stakeds: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
});
it('works without configured alternative and does not loop', async () => {
    const { transport, fetcher } = setup(); transport.configure({}); fetcher.mockRejectedValue(new Error('offline'));
    await expect(transport.post(primary, '{}')).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(1);
});
