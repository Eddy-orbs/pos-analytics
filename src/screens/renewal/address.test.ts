import { fitAddress } from './address';
const address = '0x9520f53fd81c668e8088ae194c40e3f977b73d28';
const width = (text: string) => text.length * 7;
it('keeps the full address whenever it fits, including exact fit', () => {
    expect(fitAddress(address, width(address), width)).toBe(address);
    expect(fitAddress(address, 600, width)).toBe(address);
});
it('only truncates overflowing addresses and uses the available width', () => {
    const value = fitAddress(address, 210, width);
    expect(value).toContain('…');
    expect(value.length).toBe(30);
    expect(value.startsWith('0x')).toBe(true);
    expect(value.endsWith('3d28')).toBe(true);
    expect(width(value)).toBeLessThanOrEqual(210);
});
