import { getViewportMode } from './useViewport';

describe('getViewportMode', () => {
    it('uses the same mobile and tablet boundaries as the responsive styles', () => {
        expect(getViewportMode(360)).toBe('mobile');
        expect(getViewportMode(767)).toBe('mobile');
        expect(getViewportMode(768)).toBe('tablet');
        expect(getViewportMode(1199)).toBe('tablet');
        expect(getViewportMode(1200)).toBe('desktop');
    });
});
