/**
 * Design tokens, mirroring DESIGN §2. `styles.css` carries the same values as CSS
 * custom properties; keep the two in sync and never invent a colour outside this list.
 */

export const COLOR = {
  sawah500: '#5E9E3A',
  sawah700: '#3D6B25',
  kunyit400: '#F2B632',
  terakota500: '#C3593A',
  indigo700: '#27335C',
  indigo900: '#161D38',
  kapur50: '#FBF6EC',
  kayu500: '#8A5A36',
  ink900: '#1B1410',
  ink500: '#6B5B4E',
  hujan400: '#6FA8C9',
  bahaya500: '#D23C3C',
} as const;

export type ColorToken = keyof typeof COLOR;

/** Same palette as 0xRRGGBB, which is what Three.js materials and lights want. */
export function colorHex(token: ColorToken): number {
  return Number.parseInt(COLOR[token].slice(1), 16);
}
