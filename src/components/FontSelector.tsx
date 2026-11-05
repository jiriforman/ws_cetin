import { useLayoutEffect, useState } from 'react';
import { Type, Minus, Plus } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { normalizeReadingSize } from '@/lib/readingSize';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import '@fontsource/bebas-neue/latin-ext-400.css';
import '@fontsource/share-tech-mono/400.css';
import '@fontsource/roboto-condensed/latin-ext-400.css';
import '@fontsource/roboto-condensed/latin-ext-700.css';
import '@fontsource/atkinson-hyperlegible/latin-ext-400.css';
import '@fontsource/atkinson-hyperlegible/latin-ext-700.css';
import '@fontsource/source-sans-3/latin-ext-400.css';
import '@fontsource/source-sans-3/latin-ext-600.css';
import '@fontsource/source-sans-3/latin-ext-700.css';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/roboto-condensed/latin-400.css';
import '@fontsource/roboto-condensed/latin-700.css';
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/600.css';
import '@fontsource/nunito-sans/700.css';
import '@fontsource/nunito-sans/800.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/700.css';
import '@fontsource/merriweather/400.css';
import '@fontsource/merriweather/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/comic-neue/400.css';
import '@fontsource/comic-neue/700.css';

const fonts = [
  { id: 'original', name: 'Default (Nunito Sans)' },
  { id: 'atkinson', name: 'Atkinson Hyperlegible' },
  { id: 'source', name: 'Source Sans 3' },
  { id: 'arial', name: 'Arial' },
  { id: 'verdana', name: 'Verdana' },
  { id: 'roboto', name: 'Roboto Condensed' },
  { id: 'nunito', name: 'Nunito Sans' },
  { id: 'lato', name: 'Lato' },
  { id: 'open-sans', name: 'Open Sans' },
  { id: 'merriweather', name: 'Merriweather' },
  { id: 'ibm-plex', name: 'IBM Plex Sans' },
  { id: 'georgia', name: 'Georgia' },
  { id: 'tahoma', name: 'Tahoma' },
  { id: 'trebuchet', name: 'Trebuchet MS' },
  { id: 'comic', name: 'Comic Sans' },
];

export default function FontSelector({ floating = false }: { floating?: boolean }) {
  const [font, setFont] = useState(() => {
    try {
      const saved = localStorage.getItem('workshop-font');
      return fonts.some((item) => item.id === saved) ? saved ?? 'original' : 'original';
    } catch { return 'original'; }
  });

  const [size, setSize] = useState(() => {
    try {
      const saved = localStorage.getItem('workshop-reading-size');
      return saved === null ? 100 : normalizeReadingSize(Number(saved));
    } catch { return 100; }
  });

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--reading-root-size', `${16 * size / 100}px`);
    try { localStorage.setItem('workshop-reading-size', String(size)); } catch { /* Storage may be blocked. */ }
  }, [size]);

  useLayoutEffect(() => {
    document.documentElement.dataset.readingFont = font;
    try { localStorage.setItem('workshop-font', font); } catch { /* Private browsing can block storage. */ }
  }, [font]);

  return (
    <div className={floating ? 'fixed bottom-4 right-4 z-50' : 'shrink-0'}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Font settings" title="Font settings">
            <Type aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 max-w-[calc(100vw-2rem)] max-h-[70dvh] overflow-y-auto space-y-4">
          <label id="reading-font-label" className="block text-sm font-semibold">Website font</label>
          <Select value={font} onValueChange={setFont}>
            <SelectTrigger aria-labelledby="reading-font-label"><SelectValue /></SelectTrigger>
            <SelectContent>
              {fonts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span id="reading-size-label" className="text-sm font-semibold">Text size</span>
              <output className="text-sm tabular-nums" aria-live="polite">{size}%</output>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="shrink-0" aria-label="Decrease text size" disabled={size === 80} onClick={() => setSize(normalizeReadingSize(size - 5))}><Minus /></Button>
              <Slider aria-labelledby="reading-size-label" min={80} max={150} step={5} value={[size]} onValueChange={([value]) => { if (value !== undefined) setSize(normalizeReadingSize(value)); }} />
              <Button variant="outline" size="icon" className="shrink-0" aria-label="Increase text size" disabled={size === 150} onClick={() => setSize(normalizeReadingSize(size + 5))}><Plus /></Button>
            </div>
          </div>
          <div className="space-y-1 border-y border-border py-3">
            <p className="text-lg font-semibold">Evaluation · Team 1</p>
            <p className="text-sm">Cartel Rankings · Tým č. 1</p>
            <p className="text-sm tabular-nums">$125,000.00 · 12 weeks</p>
          </div>
          <Button variant="outline" className="w-full" onClick={() => { setFont('original'); setSize(100); }}>Reset to original</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}