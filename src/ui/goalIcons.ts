// 程式化目標圖示：避免 emoji 字型差異，所有圖示可隨 UI 色彩縮放。

const ICON_PATHS: Record<string, string> = {
  reach_wave_15: '<path d="M3 21c4-5 8-5 12 0s8 5 14 0M3 15c4-5 8-5 12 0s8 5 14 0M14 5l2-2 2 2v6h-4z"/>',
  clear_20_boss: '<path d="M7 10 3 5m22 5 4-5M7 14c0-5 4-8 9-8s9 3 9 8v8c-3 4-15 4-18 0zM12 15h.1M20 15h.1M13 21h6"/>',
  synthesis_master: '<path d="M12 3h8M14 3v8L7 25h18l-7-14V3M11 18h10"/>',
  five_elements: '<path d="M16 3a13 13 0 1 0 0 26 8 8 0 1 1 0-16 5 5 0 1 0 0-10z"/><circle cx="12" cy="10" r="1.8" fill="currentColor"/><circle cx="20" cy="22" r="1.8" fill="currentColor"/>',
  minimalist: '<path d="m16 4 12 24H4zM16 10v12M11 22h10"/>',
  speed_clear: '<path d="M4 10h13M3 16h18M7 22h10M21 7l6 9-6 9"/>',
  asc2_clear: '<path d="m16 3 4 7 8 1-6 6 2 8-8-4-8 4 2-8-6-6 8-1z"/>',
  boss_slayer: '<path d="m7 4 21 21M25 4 4 25M10 7l-3-3M22 25l3 3M22 7l3-3M10 25l-3 3"/>',
};

export function getGoalIconMarkup(goalId: string): string {
  const path = ICON_PATHS[goalId] ?? '<circle cx="16" cy="16" r="9"/>';
  return `<svg class="goal-icon" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}
