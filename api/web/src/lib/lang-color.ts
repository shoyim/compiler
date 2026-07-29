const PALETTE = [
  'hsl(217 91% 60%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(280 70% 60%)',
  'hsl(0 72% 60%)',
  'hsl(199 89% 48%)',
  'hsl(330 70% 55%)',
  'hsl(160 70% 42%)',
  'hsl(25 85% 55%)',
  'hsl(260 60% 60%)',
];

export function langColor(lang: string) {
  let hash = 0;
  for (let i = 0; i < lang.length; i++) hash = (hash * 31 + lang.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export function langInitial(lang: string) {
  return lang.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || lang[0]?.toUpperCase() || '?';
}
