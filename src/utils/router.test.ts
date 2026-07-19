import { CHAINS } from '../types';
import { getRouterBasePath } from './router';

describe('router base path', () => {
    it('joins a root PUBLIC_URL without a double slash', () => {
        expect(getRouterBasePath('/', CHAINS.ETHEREUM)).toBe('/ethereum');
    });

    it('uses only the pathname of an absolute PUBLIC_URL', () => {
        expect(getRouterBasePath('https://analytics.orbs.kryp.xyz/', CHAINS.POLYGON)).toBe('/polygon');
        expect(getRouterBasePath('https://example.test/analytics/', CHAINS.POLYGON)).toBe('/analytics/polygon');
    });
});
