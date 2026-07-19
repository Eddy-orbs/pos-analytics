import { useEffect, useState } from 'react';

export const MOBILE_VIEWPORT_MAX = 767;
export const TABLET_VIEWPORT_MAX = 1199;

export type ViewportMode = 'mobile' | 'tablet' | 'desktop';

export const getViewportMode = (width: number): ViewportMode => {
    if (width <= MOBILE_VIEWPORT_MAX) return 'mobile';
    if (width <= TABLET_VIEWPORT_MAX) return 'tablet';
    return 'desktop';
};

const getInitialMatch = (query: string) => {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia === 'function') return window.matchMedia(query).matches;
    return window.innerWidth <= MOBILE_VIEWPORT_MAX;
};

export const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(() => getInitialMatch(query));

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        if (typeof window.matchMedia !== 'function') {
            const onResize = () => setMatches(window.innerWidth <= MOBILE_VIEWPORT_MAX);
            window.addEventListener('resize', onResize);
            onResize();
            return () => window.removeEventListener('resize', onResize);
        }

        const mediaQuery = window.matchMedia(query);
        const onChange = () => setMatches(mediaQuery.matches);
        onChange();

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', onChange);
            return () => mediaQuery.removeEventListener('change', onChange);
        }

        mediaQuery.addListener(onChange);
        return () => mediaQuery.removeListener(onChange);
    }, [query]);

    return matches;
};

export const useIsMobileViewport = () => useMediaQuery(`(max-width: ${MOBILE_VIEWPORT_MAX}px)`);
