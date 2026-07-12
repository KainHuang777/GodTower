// ============================================================
// src/towers.ts — 五行陰陽砲台定義與合成邏輯
// ============================================================

/** 五行屬性 */
export type Element = 'fire' | 'water' | 'wood' | 'earth' | 'metal' | 'yin' | 'yang';

/** 砲台類型 ID（基礎塔 + 合成塔） */
export type TowerTypeId =
  // 基礎 7 種
  | 'fire' | 'water' | 'wood' | 'earth' | 'metal' | 'yin' | 'yang'
  // 同系 Lv2
  | 'fire_2' | 'water_2' | 'wood_2' | 'earth_2' | 'metal_2' | 'yin_2' | 'yang_2'
  // 五行相生合成 (5 種)
  | 'wood_fire' | 'fire_earth' | 'earth_metal' | 'metal_water' | 'water_wood'
  // 陰陽合成 (3 種)
  | 'yin_yang' | 'yin_element' | 'yang_element';

/** 砲台定義資料 */
export interface TowerDef {
  id: TowerTypeId;
  name: string;
  emoji: string;
  element: Element;
  cost: number;
  damage: number;
  range: number;       // 射程 (網格)
  fireRate: number;    // 冷卻幀數 (60fps)
  isWall: boolean;     // 是否阻擋尋路
  level: number;
  // 特殊效果旗標
  aoeRadius?: number;       // AOE 半徑 (格)
  aoeDamagePct?: number;    // AOE 傷害百分比 (0~1)
  slowPct?: number;         // 減速百分比 (0~1)
  slowDuration?: number;    // 減速持續幀數
  dotDamage?: number;       // 持續傷害 (每幀)
  dotDuration?: number;     // 持續傷害持續幀數
  critChance?: number;      // 暴擊機率 (0~1)
  critMultiplier?: number;  // 暴擊倍率
  hpPctDamage?: number;     // % 最大血量傷害 (0~1)
  flyingBonus?: number;     // 對飛行怪額外傷害倍率
  healBase?: number;        // 命中時治療基地量
  buffAllyDmg?: number;     // 強化周圍友方塔傷害 %
  buffAllyRange?: number;   // 強化作用範圍 (格)
  spawnWall?: boolean;      // 生成臨時障礙
  trueDamage?: boolean;     // 真實傷害（無視抗性）
  // 砲台顏色（用於簡易渲染的 fallback）
  colorBase: string;
  colorAccent: string;
}

// --- 基礎砲台定義 ---

import towersConfig from './config/towers.json';

// --- 基礎砲台定義 ---
export const BASE_TOWERS: Record<string, TowerDef> = towersConfig.baseTowers as Record<string, TowerDef>;

// --- 同系 Lv2 合成塔定義 ---
export const LV2_TOWERS: Record<string, TowerDef> = towersConfig.lv2Towers as Record<string, TowerDef>;

// --- 異系配方合成塔 ---
export const RECIPE_TOWERS: Record<string, TowerDef> = towersConfig.recipeTowers as Record<string, TowerDef>;

export interface MergeRecipe {
  input1: Element;
  input2: Element;
  output: TowerTypeId;
}

// --- 合成配方表 ---
export const CROSS_RECIPES: MergeRecipe[] = towersConfig.crossRecipes as MergeRecipe[];

// --- 五行相剋表：key 剋 value ---
export const ELEMENT_COUNTER: Record<string, Element> = towersConfig.elementCounter as Record<string, Element>;

/** 同系合成查表：相同屬性 + 相同屬性 = Lv2 */
export function getSameMergeResult(element: Element): TowerTypeId | null {
  const map: Record<Element, TowerTypeId> = {
    fire: 'fire_2', water: 'water_2', wood: 'wood_2',
    earth: 'earth_2', metal: 'metal_2', yin: 'yin_2', yang: 'yang_2'
  };
  return map[element] ?? null;
}

/** 查詢異系合成結果（不分順序，已凍結寒鐵塔與靈木塔） */
export function getCrossRecipeResult(el1: Element, el2: Element): TowerTypeId | null {
  const frozen = ['metal_water', 'water_wood'];
  for (const recipe of CROSS_RECIPES) {
    if (frozen.includes(recipe.output)) continue;
    if ((recipe.input1 === el1 && recipe.input2 === el2) ||
        (recipe.input1 === el2 && recipe.input2 === el1)) {
      return recipe.output;
    }
  }
  return null;
}

/** 計算同系合成費用 */
export function getSameMergeCost(cost: number): number {
  return Math.floor(cost * 0.5);
}

/** 計算異系合成費用 */
export function getCrossMergeCost(costA: number, costB: number): number {
  return Math.floor((costA + costB) * 0.3);
}

/** 計算相剋加成倍率 */
export function getElementBonus(towerElement: Element, enemyElement: Element, waveNum: number = 1): number {
  if (ELEMENT_COUNTER[towerElement] === enemyElement) {
    // 0.30 至 0.50 隨波次成長
    const bonus = 0.30 + Math.min(0.20, waveNum * 0.01);
    return 1.0 + bonus;
  }
  return 1.0;
}

/** 取得砲台定義（合併所有類型查表） */
export function getTowerDef(id: TowerTypeId): TowerDef | null {
  return BASE_TOWERS[id] ?? LV2_TOWERS[id] ?? RECIPE_TOWERS[id] ?? null;
}

/** 砲台拆除退費計算 (基礎塔退 70%，合成塔退 50% 的材料成本) */
export function getSellPrice(def: TowerDef): number {
  if (def.level === 1) {
    return Math.floor(def.cost * 0.7);
  }
  // Lv2 同系合成退費：兩座基礎塔 cost 的 50%
  const baseDef = BASE_TOWERS[def.element];
  if (baseDef) {
    return Math.floor(baseDef.cost * 2 * 0.5);
  }
  return 5; // fallback
}

