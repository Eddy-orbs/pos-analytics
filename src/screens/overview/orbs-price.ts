export type OrbsPrice = { usd: number; change24h: number | null };
export const ORBS_PRICE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=orbs&include_24hr_change=true&vs_currencies=usd';

export function parseOrbsPrice(payload: unknown): OrbsPrice | null {
    const orbs = (payload as any)?.orbs;
    if (typeof orbs?.usd !== 'number' || !Number.isFinite(orbs.usd) || orbs.usd <= 0) return null;
    const change = orbs.usd_24h_change;
    return { usd: orbs.usd, change24h: typeof change === 'number' && Number.isFinite(change) ? change : null };
}

async function requestPriceWithKey(key: string | undefined): Promise<OrbsPrice | null> {
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


async function requestOrbsPrice(): Promise<OrbsPrice | null> {
    const mainKey = process.env.REACT_APP_COINGECKO_API_KEY?.trim();
    const altKey = process.env.REACT_APP_COINGECKO_API_KEY_ALT?.trim();
    const price = await requestPriceWithKey(mainKey);
    if (price || !altKey || altKey === mainKey) return price;
    return requestPriceWithKey(altKey);
}

export const ORBS_PRICE_CACHE_MS = 10 * 60 * 1000;
export const ORBS_PRICE_CACHE_KEY = 'orbs:usd-price:v2';
type PriceCache = { price: OrbsPrice; expiresAt: number };

// One reader per page, shared localStorage across reloads and same-origin tabs.
export function createOrbsPriceReader() {
    let memory: PriceCache | null = null;
    let pending: Promise<OrbsPrice | null> | null = null;
    function read(): PriceCache | null {
        try {
            const raw = localStorage.getItem(ORBS_PRICE_CACHE_KEY);
            if (raw) {
                const value = JSON.parse(raw);
                const now = Date.now();
                if (Number.isFinite(value.expiresAt) && value.expiresAt <= now + ORBS_PRICE_CACHE_MS) {
                    const price = value.price === null ? null : parseOrbsPrice({ orbs: {
                        usd: value.price?.usd, usd_24h_change: value.price?.change24h
                    } });
                    if (price) memory = { price, expiresAt: value.expiresAt };
                }
            }
        } catch { /* Storage may be unavailable; retain the page-local cache. */ }
        return memory;
    }
    function write(value: PriceCache) {
        memory = value;
        try { localStorage.setItem(ORBS_PRICE_CACHE_KEY, JSON.stringify(value)); } catch { /* Memory-only fallback. */ }
    }
    async function refresh() {
        const now = Date.now();
        const cached = read();
        if (cached && now < cached.expiresAt) return cached.price;
        const price = await requestOrbsPrice();
        if (price) write({ price, expiresAt: Date.now() + ORBS_PRICE_CACHE_MS });
        return price;
    }
    return function readPrice(): Promise<OrbsPrice | null> {
        if (pending) return pending;
        const locks = typeof navigator === 'undefined' ? undefined : (navigator as any).locks;
        pending = Promise.resolve().then(() => locks?.request
            ? locks.request(ORBS_PRICE_CACHE_KEY, refresh).catch(() => refresh())
            : refresh()).finally(() => { pending = null; });
        return pending!;
    };
}

export const fetchOrbsPrice = createOrbsPriceReader();
