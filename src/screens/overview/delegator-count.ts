// Official status-page guardian totals, used as a reference count (not a wallet union).
export function officialDelegatorCount(payload: unknown, chainId: number): number | null {
    const key = chainId === 1 ? 'EthDelegators' : chainId === 137 ? 'MaticDelegators' : null;
    const counts = key ? (payload as any)?.[key] : null;
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return null;
    let total = 0;
    for (const count of Object.values(counts)) {
        if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return null;
        total += count;
        if (!Number.isSafeInteger(total)) return null;
    }
    return total;
}
