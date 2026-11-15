import { officialDelegatorCount } from './delegator-count';

export type RootNodeHealth = 'GOOD' | 'DEGRADED' | null;
export const ROOT_NODE_HEALTH_URL = 'https://status.orbs.network/json';

export function classifyRootNodeHealth(payload: unknown): RootNodeHealth {
    const root = (payload as any)?.Statuses?.['Root Node Health'];
    if (!root || !Object.prototype.hasOwnProperty.call(root, 'Status')) return null;
    return root.Status === 'Green' ? 'GOOD' : 'DEGRADED';
}

export type NetworkStatus = { health: RootNodeHealth; ethDelegators: number | null; polygonDelegators: number | null };

// The deadline includes response-body reading and JSON parsing, not just headers.
export async function fetchNetworkStatus(): Promise<NetworkStatus | null> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<null>(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve(null); }, 10000);
    });
    const request = (async () => {
        try {
            const response = await fetch(ROOT_NODE_HEALTH_URL, { signal: controller.signal, cache: 'no-store' });
            if (!response.ok) return null;
            const payload = await response.json();
            return { health: classifyRootNodeHealth(payload), ethDelegators: officialDelegatorCount(payload, 1), polygonDelegators: officialDelegatorCount(payload, 137) };
        } catch { return null; }
    })();
    try { return await Promise.race([request, deadline]); }
    finally { if (timer !== undefined) clearTimeout(timer); }
}

export async function fetchRootNodeHealth(): Promise<RootNodeHealth> {
    return (await fetchNetworkStatus())?.health ?? null;
}
