// ============================================================
// src/ui/collectionIcons.ts — MORE 圖鑑的 code-native SVG icon
// ============================================================

type IconDefinition = { color: string; paths: string };

const ICONS: Record<string, IconDefinition> = {
  snake: { color: '#69B84A', paths: '<path d="M5 22c5-9 12-12 20-7 4 3 1 10-4 8-3-1-1-5 2-3"/><circle cx="24" cy="15" r="1" fill="currentColor" stroke="none"/>' },
  fly: { color: '#F2C14E', paths: '<ellipse cx="16" cy="17" rx="4" ry="8"/><path d="M12 12 5 8m7 7-8 1m16-4 7-4m-7 7 8 1M14 9l-2-4m6 4 2-4"/>' },
  salamander: { color: '#EE6638', paths: '<path d="M5 20c5-7 10-10 17-6l5 4-5 3-5-2-5 6-3-1 3-7zM8 18l-4-3m2 8-3 3"/><path d="m23 13 4-2-2 4"/>' },
  water_spirit: { color: '#4CA7D8', paths: '<path d="M16 3c7 8 10 12 10 17a10 10 0 0 1-20 0c0-5 3-9 10-17z"/><path d="M11 21c2 2 5 3 8 0"/>' },
  golem: { color: '#B77A45', paths: '<path d="M9 6h14l4 7-3 13H8L5 13zM11 6l2 7m6-7-2 7M9 19h14M12 16h.1m8 0h.1"/>' },
  beetle: { color: '#F2C14E', paths: '<path d="M11 10c0-5 10-5 10 0v13c0 5-10 5-10 0zM16 7v19M11 13 6 10m5 7-6 1m16-5 5-3m-5 7 6 1M13 8l-3-4m9 4 3-4"/>' },
  boss_dragon: { color: '#A84639', paths: '<path d="m5 18 7-9 3 4 3-8 4 8 5-3-2 10-7 7-7-3zM9 18l-5 2m17-2 6 2M14 20h5"/>' },
  fire: { color: '#EE6638', paths: '<path d="M17 3c4 6 9 9 7 17a9 9 0 1 1-16 0c0-4 3-7 6-11 0 5 2 6 3 7 2-3 1-7 0-13z"/>' },
  water: { color: '#4CA7D8', paths: '<path d="M16 3v26M5 9l22 14M27 9 5 23M8 5l16 22M24 5 8 27"/>' },
  wood: { color: '#69B84A', paths: '<path d="M16 28V5M16 15C8 15 6 9 7 5c6 0 9 4 9 10M16 21c8 0 10-6 9-10-6 0-9 4-9 10"/>' },
  earth: { color: '#B77A45', paths: '<path d="m4 25 8-14 4 6 5-10 7 18zM4 25h24M10 21h5m3 0h5"/>' },
  metal: { color: '#F2C14E', paths: '<path d="m7 6 19 19M22 6 6 22M5 27l5-2m17 2-2-5M5 5l5 2m17-2-2 5"/>' },
  yin: { color: '#6656A8', paths: '<path d="M21 4a12 12 0 1 0 7 21A10 10 0 1 1 21 4z"/><circle cx="12" cy="11" r="1.4" fill="currentColor" stroke="none"/>' },
  yang: { color: '#F5D85A', paths: '<circle cx="16" cy="16" r="7"/><path d="M16 2v4m0 20v4M2 16h4m20 0h4M6 6l3 3m14 14 3 3m0-20-3 3M9 23l-3 3"/>' },
};

function svg(paths: string, color: string, className = 'collection-icon'): string {
  return `<svg class="${className}" viewBox="0 0 32 32" fill="none" stroke="#2A1F14" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:${color}" aria-hidden="true" focusable="false">${paths}</svg>`;
}

export function getCollectionIcon(id: string): string {
  const icon = ICONS[id];
  return icon ? svg(icon.paths, icon.color) : svg('<path d="M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24zM16 10v7m0 5h.1"/>', '#83745E');
}

export function getAchievementIcon(completed: boolean): string {
  return completed
    ? svg('<path d="M8 4h16v7c0 5-3 8-8 8s-8-3-8-8zM10 27h12M16 19v8M8 7H4v2c0 4 2 6 5 6m15-8h4v2c0 4-2 6-5 6"/>', '#F2C14E', 'collection-icon achievement-icon')
    : svg('<circle cx="16" cy="16" r="11"/><path d="M16 9v8l5 3"/>', '#9B8568', 'collection-icon achievement-icon');
}
