import Web3 from 'web3';
import { afterEach, expect, it, vi } from 'vitest';
import { createRpcProvider, RPC_TIMEOUT_MS } from './rpc-provider';
const main = 'https://primary.test', alt = 'https://backup.test';
const payload = { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] };
const success = (request: any, result = '0x1') => ({ ok: true, json: async () => ({ jsonrpc: '2.0', id: request.id, result }) });
function send(provider: any, request = payload): Promise<any> {
    return new Promise((resolve, reject) => provider.send(request, (error: any, result: any) => error ? reject(error) : resolve(result)));
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it.each([undefined, '', '   '])('optional ALT %s does not affect a working main (real Web3 adapter)', async (backup) => {
    const fetcher = vi.fn(async (_url, options) => success(JSON.parse(options.body), '0x64'));
    vi.stubGlobal('fetch', fetcher);
    const web3 = new Web3(createRpcProvider(main, backup, 1) as any);
    expect(await web3.eth.getBlockNumber()).toBe(100); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('HTTP outage verifies alt chain, retries read and stays on alt', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
        const request = JSON.parse(options.body); calls.push(url+':'+request.method);
        return url === main ? { ok: false, status: 403 } : success(request, request.method === 'eth_chainId' ? '0x1' : '0x64');
    }));
    const provider = createRpcProvider(main, alt, 1), web3 = new Web3(provider as any);
    expect(await web3.eth.getBlockNumber()).toBe(100); expect(await web3.eth.getBlockNumber()).toBe(100);
    expect(calls).toEqual([main+':eth_blockNumber', alt+':eth_chainId', alt+':eth_blockNumber', alt+':eth_blockNumber']);
});
it('rejects wrong-chain ALT before submitting original read', async () => {
    const fetcher = vi.fn(async (url, options) => url === main ? { ok: false, status: 503 } : success(JSON.parse(options.body), '0x89'));
    vi.stubGlobal('fetch', fetcher);
    await expect(send(createRpcProvider(main, alt, 1))).rejects.toThrow('network does not match');
    expect(fetcher).toHaveBeenCalledTimes(2);
});
it('shares alternate validation across concurrent reads', async () => {
    const fetcher = vi.fn(async (url, options) => url === main ? { ok: false, status: 503 } : success(JSON.parse(options.body)));
    vi.stubGlobal('fetch', fetcher);const provider = createRpcProvider(main, alt, 1);
    await Promise.all([send(provider), send(provider)]);
    expect(fetcher.mock.calls.filter(([, options]) => JSON.parse(options.body).method === 'eth_chainId')).toHaveLength(1);
});
it.each([3, -32603])('preserves execution error %s without failover', async (code) => {
    const error = { code, message: 'execution reverted' };
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, error }) }));
    vi.stubGlobal('fetch', fetcher);
    expect((await send(createRpcProvider(main, alt, 1))).error).toEqual(error); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not replay writes on a backup', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));vi.stubGlobal('fetch', fetcher);
    await expect(send(createRpcProvider(main, alt, 1), { ...payload, method: 'eth_sendRawTransaction' })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
});
it('both unavailable and missing backup propagate failures', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));vi.stubGlobal('fetch', fetcher);
    await expect(send(createRpcProvider(main, alt, 1))).rejects.toThrow(); expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockClear();await expect(send(createRpcProvider(main, '', 1))).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);
});
it('timeout aborts stalled primary then succeeds through backup', async () => {
    vi.useFakeTimers();const fetcher = vi.fn().mockImplementationOnce(() => new Promise(() => {}))
        .mockImplementation(async (_url, options) => success(JSON.parse(options.body)));
    vi.stubGlobal('fetch', fetcher);const result = send(createRpcProvider(main, alt, 1));
    await vi.advanceTimersByTimeAsync(RPC_TIMEOUT_MS);await expect(result).resolves.toHaveProperty('result','0x1');
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
});
it('fresh provider starts with primary again; malformed response fails over', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockImplementation(async (_url, options) => success(JSON.parse(options.body)));
    vi.stubGlobal('fetch', fetcher);await send(createRpcProvider(main, alt, 1));await send(createRpcProvider(main, alt, 1));
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([main, alt, alt, main]);
});
