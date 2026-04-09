/**
 * Theme Configuration
 * ===================
 * Controlled by VITE_THEME in .env:
 *   VITE_THEME=deluxe    → red  (#D61120)
 *   VITE_THEME=siriusai  → blue (#1B3C71)
 *
 * CSS variables in index.css handle most theming via --primary.
 * This file provides hex values for inline styles that can't use CSS vars.
 */

export type ThemeName = 'deluxe' | 'siriusai';

export const THEME: ThemeName =
  (import.meta.env.VITE_THEME as ThemeName) === 'siriusai' ? 'siriusai' : 'deluxe';

interface ThemeColors {
  brand: string;        // primary brand color
  brandLight: string;   // light tint for backgrounds
  brandRgb: string;     // RGB values for rgba() usage
  avatarBg: string;     // avatar fallback background
  avatarFg: string;     // avatar fallback text
}

const themes: Record<ThemeName, ThemeColors> = {
  deluxe: {
    brand: '#D61120',
    brandLight: '#FBE7E9',
    brandRgb: '214, 17, 32',
    avatarBg: '#FBE7E9',
    avatarFg: '#D61120',
  },
  siriusai: {
    brand: '#1B3C71',
    brandLight: '#E8EDF4',
    brandRgb: '27, 60, 113',
    avatarBg: '#E8EDF4',
    avatarFg: '#1B3C71',
  },
};

export const colors = themes[THEME];
