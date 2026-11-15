export type OrbsPrice = { usd: number; change24h: number | null };
export const ORBS_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=orbs&include_24hr_change=true&vs_currencies=usd';

export function parseOrbsPrice(payload: unknown): OrbsPrice | null {
    const orbs = (payload as any)?.orbs;
    if (typeof orbs?.usd !== 'number' || !Number.isFinite(orbs.usd) || orbs.usd <= 0) return null;
    const change = orbs.usd_24h_change;
    return { usd: orbs.usd, change24h: typeof change === 'number' && Number.isFinite(change) ? change : null };
}

export async function fetchOrbsPrice(): Promise<OrbsPrice | null> {
    const key = process.env.REACT_APP_COINGECKO_DEMO_API_KEY;
    const url = key ? `${ORBS_PRICE_URL}&x_cg_demo_api_key=${encodeURIComponent(key)}` : ORBS_PRICE_URL;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<null>(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve(null); }, 8000);
    });
    const request = (async () => {
        try {
            const response = await fetch(url, { signal: controller.signal });
            return response.ok ? parseOrbsPrice(await response.json()) : null;
        } catch { return null; }
    })();
    try { return await Promise.race([request, deadline]); }
    finally { if (timer !== undefined) clearTimeout(timer); }
}
