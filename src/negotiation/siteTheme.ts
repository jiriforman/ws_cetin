// Generated "generic corporate website" look for each supplier. The theme is picked
// deterministically from the supplier key, so the six sites look different from each
// other but every one of them looks like an ordinary company website. Leaders can pin
// a palette / font / hero per supplier in site_content.theme.

export interface Palette {
  id: string;
  primary: string;
  primaryDark: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}

export const PALETTES: Palette[] = [
  { id: 'corporate-blue', primary: '#1f4e8c', primaryDark: '#163a69', accent: '#f0a500', bg: '#f6f8fb', surface: '#ffffff', text: '#1d2a3a', muted: '#5d6b7c', border: '#dde3ea' },
  { id: 'agri-green', primary: '#2e7d4f', primaryDark: '#21603b', accent: '#e9b949', bg: '#f5f8f4', surface: '#ffffff', text: '#1f2d24', muted: '#5f6f66', border: '#d9e3dc' },
  { id: 'earth', primary: '#8a5a2b', primaryDark: '#6a431d', accent: '#c9a227', bg: '#faf6f0', surface: '#fffdf9', text: '#33261a', muted: '#7a6a5b', border: '#e8dccb' },
  { id: 'slate', primary: '#3b4a5c', primaryDark: '#2b3745', accent: '#d97706', bg: '#f4f5f7', surface: '#ffffff', text: '#1f2933', muted: '#616e7c', border: '#dcdfe4' },
  { id: 'teal', primary: '#0f766e', primaryDark: '#0b5a54', accent: '#f59e0b', bg: '#f2f8f7', surface: '#ffffff', text: '#143531', muted: '#5b716d', border: '#d4e4e1' },
  { id: 'burgundy', primary: '#7b2d3b', primaryDark: '#5c202c', accent: '#d4a017', bg: '#faf5f6', surface: '#ffffff', text: '#2f1a1f', muted: '#73585e', border: '#e9d6da' },
  { id: 'sunrise', primary: '#c2410c', primaryDark: '#9a3412', accent: '#15803d', bg: '#fff8f3', surface: '#ffffff', text: '#2d1b12', muted: '#7c5a4a', border: '#f1dccd' },
];

export interface FontPair {
  id: string;
  body: string;
  heading: string;
}

export const FONTS: FontPair[] = [
  { id: 'modern-sans', body: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', heading: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' },
  { id: 'classic-serif', body: 'Georgia, "Times New Roman", serif', heading: 'Georgia, "Times New Roman", serif' },
  { id: 'humanist', body: 'Verdana, Geneva, Tahoma, sans-serif', heading: '"Trebuchet MS", Verdana, sans-serif' },
  { id: 'editorial', body: '"Segoe UI", Roboto, Arial, sans-serif', heading: 'Georgia, "Times New Roman", serif' },
  { id: 'geometric', body: '"Century Gothic", "Trebuchet MS", Arial, sans-serif', heading: '"Century Gothic", "Trebuchet MS", Arial, sans-serif' },
];

export type HeroLayout = 'band' | 'split' | 'centered';
export const HEROES: HeroLayout[] = ['band', 'split', 'centered'];

export interface SiteTheme {
  palette: Palette;
  font: FontPair;
  hero: HeroLayout;
  /** CSS background for the hero image area, built from gradients so no asset is needed. */
  heroArt: string;
  monogramShape: 'circle' | 'square' | 'hex';
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const heroArtFor = (p: Palette, seed: number) => {
  const variants = [
    `linear-gradient(135deg, ${p.primaryDark} 0%, ${p.primary} 55%, ${p.accent} 140%)`,
    `radial-gradient(circle at 20% 30%, ${p.accent}55 0%, transparent 40%), linear-gradient(160deg, ${p.primary} 0%, ${p.primaryDark} 100%)`,
    `repeating-linear-gradient(45deg, ${p.primaryDark} 0 18px, ${p.primary} 18px 36px)`,
    `linear-gradient(180deg, ${p.primary} 0%, ${p.primaryDark} 100%), radial-gradient(circle, ${p.accent} 1px, transparent 1px)`,
  ];
  return variants[seed % variants.length];
};

export const themeFor = (key: string, override?: { palette?: string; font?: string; hero?: string }): SiteTheme => {
  const h = hash(key);
  const palette = PALETTES.find((p) => p.id === override?.palette) ?? PALETTES[h % PALETTES.length];
  const font = FONTS.find((f) => f.id === override?.font) ?? FONTS[(h >>> 4) % FONTS.length];
  const hero = (HEROES.find((x) => x === override?.hero) ?? HEROES[(h >>> 8) % HEROES.length]) as HeroLayout;
  const shapes: SiteTheme['monogramShape'][] = ['circle', 'square', 'hex'];
  return { palette, font, hero, heroArt: heroArtFor(palette, h >>> 12), monogramShape: shapes[(h >>> 16) % shapes.length] };
};

/** CSS custom properties for the `.corp-site` scope. */
export const themeVars = (t: SiteTheme): Record<string, string> => ({
  '--c-primary': t.palette.primary,
  '--c-primary-dark': t.palette.primaryDark,
  '--c-accent': t.palette.accent,
  '--c-bg': t.palette.bg,
  '--c-surface': t.palette.surface,
  '--c-text': t.palette.text,
  '--c-muted': t.palette.muted,
  '--c-border': t.palette.border,
  '--c-font-body': t.font.body,
  '--c-font-head': t.font.heading,
  '--c-hero-art': t.heroArt,
});

export const initials = (name: string) =>
  name
    .replace(/\b(S\.A\.|Ltda\.|Ltd\.|Inc\.|GmbH)\b/gi, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** Neutral theme for the trade portal itself. */
export const PORTAL_THEME: SiteTheme = {
  palette: { id: 'portal', primary: '#0f4c81', primaryDark: '#0b3860', accent: '#e07a1f', bg: '#f3f5f8', surface: '#ffffff', text: '#1b2430', muted: '#5f6c7b', border: '#d9dfe7' },
  font: FONTS[0],
  hero: 'band',
  heroArt: 'linear-gradient(135deg, #0b3860 0%, #0f4c81 60%, #1b6fb3 100%)',
  monogramShape: 'square',
};
