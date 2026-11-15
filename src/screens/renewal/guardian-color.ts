// Figma 19:136–257: Guardian data palette (identical in both themes).
export const guardianPalette = [
    '#7A89E9',
    '#DC8AE0',
    '#63DDB5',
    '#49AAFF',
    '#FFADAE',
    '#A17AE9',
    '#2CEDFC',
    '#3346F2',
    '#C6DC82',
    '#AB83B5',
    '#36C9CA',
    '#E998BD',
    '#B99DEE',
    '#35B8A6',
    '#6298DD',
    '#E8AF7D',
    '#B56BBC',
    '#A6C98B',
    '#7DA6BC',
    '#CC789E',
    '#92D6C8',
    '#DDC477'
];
export const otherGuardiansColor = '#89849A';
// Product rule: committee rank owns the slot; identities are resolved before filtering.
export function guardianColor(rank?: number): string {
    return rank !== undefined && Number.isInteger(rank) && rank >= 1 && rank <= guardianPalette.length
        ? guardianPalette[rank - 1]
        : otherGuardiansColor;
}
