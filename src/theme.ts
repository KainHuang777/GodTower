// ============================================================
// src/theme.ts — 五行美術主題集中配置 (Mindustry 風格)
// ============================================================
// 單一真相來源 (Single Source of Truth)：
//   所有元素顏色、描邊、背景色統一從此檔匯出。
//   sprites.ts、gameRenderer.ts、particles.ts、uiManager.ts、wuxingCompass.ts
//   皆應 import 本檔，禁止再硬編碼元素色 HEX。
//
// 設計原則（Mindustry 風格）：
//   - 暗背景 + 高飽和螢光 accent + 2px 深色描邊 = 三層分離
//   - accent 用於 halo/glow/outline；base 用於 sprite 暗部
//   - 永遠不用純黑 (#000)，改用 #0E1117 讓 glow 有漸層落點

/** 背景與 UI 面板色（取代純黑，讓 glow 有落點） */
export const CANVAS_BG = '#0E1117';        // 畫布/遊戲背景（深空藍黑）
export const PANEL_BG = '#1A1F2A';         // UI 面板（比背景亮一階）
export const OUTLINE_COLOR = '#0E1117';    // 統一描邊色（與背景同色，切割形狀）

/** 五行 + 陰陽 的主題色定義 */
export interface ElementTheme {
  /** 高飽和螢光 accent — 用於 halo、glow、描邊、UI 強調 */
  accent: string;
  /** 暗部 base — 用於 sprite 暗面、面板底色 */
  base: string;
  /** 外環色（比 accent 暗一階，製造「光源在內部」錯覺） */
  ring?: string;
}

/** 五行 + 陰陽 主題色表（Mindustry 高飽和螢光風格） */
export const ELEMENT_THEME: Record<string, ElementTheme> = {
  fire:  { accent: '#FF5E3A', base: '#3D0F12', ring: '#FFD23A' },  // 螢光橘紅 + 火心金黃
  water: { accent: '#3FE0FF', base: '#0B2540' },                   // 青藍螢光（偏青拉開與 metal 距離）
  wood:  { accent: '#7FFF66', base: '#1B3A2F' },                   // 螢光綠
  earth: { accent: '#E8B855', base: '#3E2A1A' },                   // 赭金（與火拉開色相）
  metal: { accent: '#9FE4FF', base: '#2A3340' },                   // 冷光冰藍銀（加 8% 藍避免過曝糊邊）
  yin:   { accent: '#C060FF', base: '#1F0F3A', ring: '#7B1FB0' },  // 品紅紫（偏紅不沉悶）
  yang:  { accent: '#FFE45E', base: '#3A2A08', ring: '#FFA940' },  // 聖光金 + 外環橙
};

/** 快捷：元素 accent 色（取代舊 ELEMENT_COLORS） */
export const ELEMENT_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(ELEMENT_THEME).map(([k, v]) => [k, v.accent])
);

/** 快捷：元素 base 色 */
export const ELEMENT_BASE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(ELEMENT_THEME).map(([k, v]) => [k, v.base])
);

/** 快捷：元素 ring 色（fallback 到 accent） */
export const ELEMENT_RING_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(ELEMENT_THEME).map(([k, v]) => [k, v.ring ?? v.accent])
);

/** 取得元素的 accent 色（安全 fallback） */
export function getElementAccent(element: string): string {
  return ELEMENT_COLORS[element] ?? '#ffffff';
}

/** 取得元素的 base 色（安全 fallback） */
export function getElementBase(element: string): string {
  return ELEMENT_BASE_COLORS[element] ?? '#333333';
}

/** 將 HEX 色轉為 rgba 字串（用於 fillStyle 半透明疊加） */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
