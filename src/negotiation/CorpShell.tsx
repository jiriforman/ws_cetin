import type { CSSProperties, ReactNode } from 'react';
import { useEffect } from 'react';
import './corp.css';
import { type SiteTheme, initials, themeVars } from './siteTheme';

/** Root of every negotiation page: applies the scoped corporate theme instead of the Narcos one. */
export const CorpShell = ({ theme, title, children }: { theme: SiteTheme; title: string; children: ReactNode }) => {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="corp-site" style={themeVars(theme) as CSSProperties}>
      {children}
    </div>
  );
};

export const Monogram = ({ name, theme, size = 40 }: { name: string; theme: SiteTheme; size?: number }) => {
  const shape =
    theme.monogramShape === 'circle' ? 'rounded-full' : theme.monogramShape === 'square' ? 'rounded-md' : 'corp-monogram-hex';
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center font-bold text-white ${shape}`}
      style={{ width: size, height: size, background: 'var(--c-primary)', fontSize: size * 0.4, fontFamily: 'var(--c-font-head)' }}
    >
      {initials(name)}
    </span>
  );
};
