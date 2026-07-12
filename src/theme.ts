// ============================================================
// src/theme.ts — 五行美術主題集中配置（明亮東方像素風）
// ============================================================
// 單一真相來源 (Single Source of Truth)：
//   所有元素顏色、描邊、背景色統一從此檔匯出。
//   sprites.ts、gameRenderer.ts、particles.ts、uiManager.ts、wuxingCompass.ts
//   皆應 import 本檔，禁止再硬編碼元素色 HEX。
//
// 設計原則：
//   - 中高明度自然色 + 2px 暖深色描邊，優先確保輪廓辨識
//   - accent 用於狀態與元素識別；base 用於暗面，不以大量 glow 補足對比
//   - 夜色、星空與雷雨只作特殊關卡，不再作全遊戲視覺基準

/** 背景與 UI 面板色（取代純黑，讓 glow 有落點） */
export const CANVAS_BG = '#A9C978';        // 標準日間戰場草地底色
export const PANEL_BG = '#F2DFA7';         // 明亮資訊面板
export const OUTLINE_COLOR = '#3A251B';    // 暖深棕描邊，避免純黑割裂畫面

/** 五行 + 陰陽 的主題色定義 */
export interface ElementTheme {
  /** 高飽和螢光 accent — 用於 halo、glow、描邊、UI 強調 */
  accent: string;
  /** 暗部 base — 用於 sprite 暗面、面板底色 */
  base: string;
  /** 外環色（比 accent 暗一階，製造「光源在內部」錯覺） */
  ring?: string;
}

/** 五行 + 陰陽主題色表（明亮、自然、非霓虹） */
export const ELEMENT_THEME: Record<string, ElementTheme> = {
  fire:  { accent: '#EE6638', base: '#873A2A', ring: '#F2C14E' },
  water: { accent: '#4CA7D8', base: '#285E78', ring: '#8DD5E7' },
  wood:  { accent: '#69B84A', base: '#356B35', ring: '#A8D66D' },
  earth: { accent: '#B77A45', base: '#765033', ring: '#D9AE68' },
  metal: { accent: '#F2C14E', base: '#8C6D32', ring: '#FFF0A6' },
  yin:   { accent: '#6656A8', base: '#40366B', ring: '#9A8BC7' },
  yang:  { accent: '#F5D85A', base: '#9A712B', ring: '#FFF3B0' },
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
