import { chains } from "config"
import { CHAINS } from "types"

const publicUrlPath = (publicUrl?: string): string => {
    if (!publicUrl) return '';
    try {
        if (/^https?:\/\//i.test(publicUrl)) return new URL(publicUrl).pathname;
    } catch (_) {
        return '';
    }
    return publicUrl;
};

export const getRouterBasePath = (publicUrl: string | undefined, chain: CHAINS): string => {
    const publicPath = publicUrlPath(publicUrl).replace(/^\/+|\/+$/g, '');
    return `/${[publicPath, chain].filter(Boolean).join('/')}`;
};

const getRouterBaseName = (): CHAINS => {
    const segments = window.location.pathname.split('/').filter(Boolean);
    for (const segment of segments) {
        const chain = segment.toLocaleLowerCase();
        if (chains[chain as CHAINS]) return chain as CHAINS;
    }
    return CHAINS.ETHEREUM
    
}

export { getRouterBaseName }
