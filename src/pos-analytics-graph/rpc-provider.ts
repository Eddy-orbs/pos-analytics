// Read-only analytics RPC failover. Selection is in memory, never persisted.
export const RPC_TIMEOUT_MS = 12000;
const READ_METHODS = new Set(['eth_call', 'eth_chainId', 'net_version', 'eth_blockNumber',
    'eth_getBlockByNumber', 'eth_getBlockByHash', 'eth_getBalance', 'eth_getCode',
    'eth_getStorageAt', 'eth_getLogs', 'eth_getTransactionReceipt', 'eth_getTransactionByHash']);
class RpcUnavailable extends Error {}
async function request(url: string, payload: any): Promise<any> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => { reject(new RpcUnavailable('RPC request timed out')); controller.abort(); }, RPC_TIMEOUT_MS);
    });
    try {
        return await Promise.race([deadline, (async () => {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload), signal: controller.signal });
            if (!response.ok) throw new RpcUnavailable(`RPC HTTP ${response.status}`);
            const result = await response.json();
            const requests = Array.isArray(payload) ? payload : [payload];
            const replies = Array.isArray(result) ? result : [result];
            if (requests.length !== replies.length || requests.some((item: any) => !replies.some((reply: any) =>
                reply && reply.id === item.id && reply.jsonrpc === '2.0' && ('result' in reply || reply.error)))) {
                throw new RpcUnavailable('Invalid RPC response');
            }
            // Execution reverts / invalid params are valid RPC responses, not outages.
            if (replies.some((reply: any) => reply.error && !/revert|invalid opcode/i.test(reply.error.message || '') && (
                [-32005, -32002, -32603].includes(reply.error.code) ||
                /rate limit|too many requests|service unavailable|timeout|timed out/i.test(reply.error.message || '')
            ))) throw new RpcUnavailable('RPC service unavailable');
            return result;
        })()]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
}

export function createRpcProvider(primary: string, alternative: string | undefined, chainId: number) {
    const alt = alternative?.trim();
    let useAlternative = false;
    let verification: Promise<void> | undefined;
    async function verifyAlternative() {
        if (!verification) {
            verification = request(alt!, { jsonrpc: '2.0', id: 'analytics-alt-chain', method: 'eth_chainId', params: [] })
                .then((response) => {
                    if (Number(response.result) !== chainId) throw new Error('ALT RPC network does not match selected chain');
                }).catch(error => { verification = undefined; throw error; });
        }
        return verification;
    }
    async function read(payload: any) {
        const items = Array.isArray(payload) ? payload : [payload];
        const eligible = items.length > 0 && items.every((item: any) => READ_METHODS.has(item.method));
        if (eligible && alt && useAlternative) {
            await verifyAlternative();
            return request(alt, payload);
        }
        try { return await request(primary, payload); }
        catch (error) {
            if (!eligible || !alt || alt === primary) throw error;
            useAlternative = true;
            await verifyAlternative();
            return request(alt, payload);
        }
    }
    const send = (payload: any, callback: (error: any, result?: any) => void) => {
        read(payload).then(result => callback(null, result), error => callback(error));
    };
    return { send, sendAsync: send };
}

const providers = new Map<string, ReturnType<typeof createRpcProvider>>();
export function getAnalyticsRpcProvider(primary: string, alternative: string | undefined, chainId: number) {
    const key = JSON.stringify([chainId, primary, alternative?.trim() || '']);
    let provider = providers.get(key);
    if (!provider) { provider = createRpcProvider(primary, alternative, chainId); providers.set(key, provider); }
    return provider;
}
