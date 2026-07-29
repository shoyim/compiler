export const LANG_META: Record<string, { color: string }> = {
  python: { color: '#3776AB' },
  node: { color: '#339933' },
  javascript: { color: '#ca8a04' },
  java: { color: '#ED8B00' },
  c: { color: '#A8B9CC' },
  'c++': { color: '#00599C' },
  rust: { color: '#CE422B' },
  go: { color: '#00ACD7' },
  ruby: { color: '#CC342D' },
  php: { color: '#777BB4' },
  bash: { color: '#4EAA25' },
  typescript: { color: '#3178C6' },
  kotlin: { color: '#7F52FF' },
  swift: { color: '#FA7343' },
  pypy: { color: '#e08e25' },
  pascal: { color: '#3b82f6' },
  default: { color: '#6B7280' },
};

export function getLangMeta(lang: string) {
  return LANG_META[(lang || '').toLowerCase()] || LANG_META.default;
}
