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
  fire_2: { color: '#EE6638', paths: '<path d="M12 5c4 5 8 8 6 14a7 7 0 1 1-12 0c0-3 2-5 4-8 0 4 2 4 2 5 1-2 0-6 0-11zM18 7l4-2-1 4"/><path d="M20 6c3 4 5 7 4 11a4 4 0 0 1-7 1"/>' },
  water_2: { color: '#4CA7D8', paths: '<path d="M14 4v22M22 6v20M10 12l-5 4 5 4M22 14l5-4-5-4M8 20l8 6 8-6"/>' },
  wood_2: { color: '#69B84A', paths: '<path d="M16 26V8M16 16c-5 0-7-4-6-7 4 0 6 3 6 7M10 23l6 4 6-4"/><path d="M16 12c5 0 7-4 6-7-4 0-6 3-6 7"/>' },
  earth_2: { color: '#B77A45', paths: '<path d="m3 24 7-12 4 5 4-8 7 15zM3 24h24M9 21h5m3 0h5M7 26l5 2 5-2 5 2 5-2"/>' },
  metal_2: { color: '#F2C14E', paths: '<path d="m5 7 9 9 9-9M5 25l9-9 9 9M14 16v10M14 6v10M6 14h16"/>' },
  yin_2: { color: '#6656A8', paths: '<path d="M20 5a10 10 0 1 0 5 18A8 8 0 1 1 20 5zM24 7l2-1-1 3M27 9l1 3-3-1"/><circle cx="13" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="20" cy="20" r="0.8" fill="currentColor" stroke="none"/>' },
  yang_2: { color: '#F5D85A', paths: '<circle cx="12" cy="12" r="4"/><circle cx="20" cy="20" r="4"/><path d="M16 2v3m0 25v3M2 16h3m25 0h3M7 7l2 2m16 16 2 2M7 25l2-2M25 7l-2 2"/>' },
  wood_fire: { color: '#E07B3F', paths: '<path d="M10 24V8c-2 4-5 7-3 12a7 7 0 0 0 11-3"/><path d="M13 18c0-3 2-4 3-6 1 2-1 7-3 6z"/><path d="M20 10l6 4-6 4"/>' },
  fire_earth: { color: '#C46A3A', paths: '<path d="M16 2v6M8 8l2 3M24 8l-2 3"/><path d="M12 24c3-8 8-10 10-8 1 2-1 6-5 8"/><path d="M5 22l8-5 4 3 4-4 7 6"/><path d="M22 15v10"/>' },
  earth_metal: { color: '#C99A4A', paths: '<path d="M8 14h16v12H8z"/><circle cx="16" cy="20" r="3"/><path d="M10 10 8 14m16 0-2-4M14 8v6m4-6v6M12 26l2-4m4 4-2-4"/><path d="M4 28h24"/>' },
  metal_water: { color: '#7FB8C8', paths: '<path d="M8 6 4 9l4 3M22 6l4 3-4 3"/><path d="M16 10v14M10 18l-3 3 3 3M22 18l3 3-3 3"/><path d="M12 10h8v14h-8z"/>' },
  water_wood: { color: '#5AB87A', paths: '<path d="M10 8v10c0 4 3 6 6 6s6-2 6-6V8"/><path d="M16 8V5M6 18h20"/><path d="M10 14c3 0 5 2 6 4 1-2 3-4 6-4"/>' },
  yin_yang: { color: '#888888', paths: '<circle cx="16" cy="16" r="12"/><path d="M16 4a12 12 0 0 1 0 24 6 6 0 0 0 0-12 6 6 0 0 1 0-12z"/><circle cx="16" cy="10" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="22" r="2" fill="white" stroke="none"/>' },
  trait_armor: { color: '#A89F91', paths: '<path d="M16 3 5 8v8c0 16 11 16 11 16s11 0 11-16V8z"/><path d="M12 16l3 4 6-7"/>' },
  trait_regen: { color: '#6BB86A', paths: '<path d="M16 4c-4 4-8 8-8 12a8 8 0 0 0 16 0c0-4-4-8-8-12z"/><path d="M13 15h6M16 12v6"/>' },
  trait_split: { color: '#B86A6A', paths: '<circle cx="8" cy="8" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="16" cy="24" r="3"/><path d="M10 10l4 11M22 10l-4 11"/><path d="M16 3v5"/>' },
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
