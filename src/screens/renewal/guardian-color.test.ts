import { guardianColor, guardianPalette, otherGuardiansColor } from './guardian-color';
it('assigns the 22 Figma colors by rank', () => {
    guardianPalette.forEach((color, i) => expect(guardianColor(i + 1)).toBe(color));
    expect(guardianColor(1)).toBe('#7A89E9');
    expect(guardianColor(5)).toBe('#FFADAE');
});
it('uses neutral for unranked and outside the top 22', () => {
    [undefined, 0, -1, 23, 100, NaN, 1.5].forEach((rank) => expect(guardianColor(rank)).toBe(otherGuardiansColor));
});
