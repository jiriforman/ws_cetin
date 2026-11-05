export function normalizeReadingSize(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(150, Math.max(80, Math.round(value / 5) * 5));
}