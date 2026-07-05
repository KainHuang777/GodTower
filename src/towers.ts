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

export const BASE_TOWERS: Record<string, TowerDef> = {
  fire: {
    id: 'fire', name: '烈焰塔', emoji: '🔥', element: 'fire',
    cost: 12, damage: 20, range: 4, fireRate: 50, isWall: true, level: 1,
    aoeRadius: 1, aoeDamagePct: 0.3,
    colorBase: '#991b1b', colorAccent: '#f97316'
  },
  water: {
    id: 'water', name: '冰凍塔', emoji: '💧', element: 'water',
    cost: 10, damage: 8, range: 5, fireRate: 60, isWall: true, level: 1,
    slowPct: 0.5, slowDuration: 90,
    colorBase: '#1e3a5f', colorAccent: '#38bdf8'
  },
  wood: {
    id: 'wood', name: '纏繞塔', emoji: '🌿', element: 'wood',
    cost: 10, damage: 5, range: 4, fireRate: 70, isWall: true, level: 1,
    dotDamage: 3, dotDuration: 60,
    colorBase: '#14532d', colorAccent: '#4ade80'
  },
  earth: {
    id: 'earth', name: '岩壁塔', emoji: '⛰️', element: 'earth',
    cost: 2, damage: 0, range: 0, fireRate: 0, isWall: true, level: 1,
    colorBase: '#78350f', colorAccent: '#d97706'
  },
  metal: {
    id: 'metal', name: '鏡刃塔', emoji: '⚔️', element: 'metal',
    cost: 15, damage: 25, range: 3, fireRate: 40, isWall: true, level: 1,
    critChance: 0.2, critMultiplier: 2.0,
    colorBase: '#374151', colorAccent: '#e5e7eb'
  },
  yin: {
    id: 'yin', name: '暗影塔', emoji: '🌑', element: 'yin',
    cost: 18, damage: 12, range: 6, fireRate: 55, isWall: true, level: 1,
    hpPctDamage: 0.05,
    colorBase: '#2e1065', colorAccent: '#a855f7'
  },
  yang: {
    id: 'yang', name: '聖光塔', emoji: '☀️', element: 'yang',
    cost: 18, damage: 15, range: 5, fireRate: 50, isWall: true, level: 1,
    flyingBonus: 0.5, healBase: 0.1,
    colorBase: '#713f12', colorAccent: '#fbbf24'
  }
};

// --- 同系 Lv2 合成塔定義 ---

export const LV2_TOWERS: Record<string, TowerDef> = {
  fire_2: {
    id: 'fire_2', name: '烈焰塔 Lv2', emoji: '🔥', element: 'fire',
    cost: 0, damage: 32, range: 4, fireRate: 45, isWall: true, level: 2,
    aoeRadius: 2, aoeDamagePct: 0.35,
    colorBase: '#7f1d1d', colorAccent: '#fb923c'
  },
  water_2: {
    id: 'water_2', name: '冰凍塔 Lv2', emoji: '💧', element: 'water',
    cost: 0, damage: 13, range: 5, fireRate: 55, isWall: true, level: 2,
    slowPct: 0.7, slowDuration: 135,
    colorBase: '#1e3a5f', colorAccent: '#22d3ee'
  },
  wood_2: {
    id: 'wood_2', name: '纏繞塔 Lv2', emoji: '🌿', element: 'wood',
    cost: 0, damage: 8, range: 4, fireRate: 65, isWall: true, level: 2,
    dotDamage: 6, dotDuration: 90,
    colorBase: '#14532d', colorAccent: '#22c55e'
  },
  earth_2: {
    id: 'earth_2', name: '岩壁塔 Lv2', emoji: '⛰️', element: 'earth',
    cost: 0, damage: 5, range: 1, fireRate: 60, isWall: true, level: 2,
    colorBase: '#78350f', colorAccent: '#f59e0b'
  },
  metal_2: {
    id: 'metal_2', name: '鏡刃塔 Lv2', emoji: '⚔️', element: 'metal',
    cost: 0, damage: 30, range: 3, fireRate: 38, isWall: true, level: 2,
    critChance: 0.30, critMultiplier: 2.0,
    colorBase: '#1f2937', colorAccent: '#f9fafb'
  },
  yin_2: {
    id: 'yin_2', name: '暗影塔 Lv2', emoji: '🌑', element: 'yin',
    cost: 0, damage: 18, range: 7, fireRate: 50, isWall: true, level: 2,
    hpPctDamage: 0.08,
    colorBase: '#2e1065', colorAccent: '#c084fc'
  },
  yang_2: {
    id: 'yang_2', name: '聖光塔 Lv2', emoji: '☀️', element: 'yang',
    cost: 0, damage: 22, range: 5, fireRate: 45, isWall: true, level: 2,
    flyingBonus: 1.0, healBase: 0.3,
    colorBase: '#713f12', colorAccent: '#fde047'
  }
};

// --- 異系配方合成塔 ---

export const RECIPE_TOWERS: Record<string, TowerDef> = {
  wood_fire: {
    id: 'wood_fire', name: '焚林塔', emoji: '🌋', element: 'fire',
    cost: 0, damage: 18, range: 4, fireRate: 55, isWall: true, level: 3,
    aoeRadius: 2, aoeDamagePct: 0.5, dotDamage: 4, dotDuration: 90,
    colorBase: '#7c2d12', colorAccent: '#fb923c'
  },
  fire_earth: {
    id: 'fire_earth', name: '熔岩塔', emoji: '🏔️', element: 'earth',
    cost: 0, damage: 10, range: 3, fireRate: 70, isWall: true, level: 3,
    aoeRadius: 1.5, dotDamage: 6, dotDuration: 120,
    colorBase: '#451a03', colorAccent: '#ef4444'
  },
  earth_metal: {
    id: 'earth_metal', name: '鍛造塔', emoji: '⚒️', element: 'metal',
    cost: 0, damage: 0, range: 0, fireRate: 0, isWall: true, level: 3,
    buffAllyDmg: 0.25, buffAllyRange: 2,
    colorBase: '#44403c', colorAccent: '#fbbf24'
  },
  metal_water: {
    id: 'metal_water', name: '寒鐵塔', emoji: '🌊', element: 'water',
    cost: 0, damage: 30, range: 4, fireRate: 45, isWall: true, level: 3,
    slowPct: 0.6, slowDuration: 60,
    colorBase: '#164e63', colorAccent: '#94a3b8'
  },
  water_wood: {
    id: 'water_wood', name: '靈木塔', emoji: '🌸', element: 'wood',
    cost: 0, damage: 10, range: 5, fireRate: 80, isWall: true, level: 3,
    spawnWall: true,
    colorBase: '#064e3b', colorAccent: '#f0abfc'
  },
  yin_yang: {
    id: 'yin_yang', name: '太極塔', emoji: '☯️', element: 'yin',
    cost: 0, damage: 35, range: 5, fireRate: 50, isWall: true, level: 3,
    trueDamage: true, healBase: 0.2,
    colorBase: '#18181b', colorAccent: '#fafafa'
  },
};

// --- 合成配方表 ---

export interface MergeRecipe {
  input1: Element;
  input2: Element;
  output: TowerTypeId;
}

/** 同系合成查表：相同屬性 + 相同屬性 = Lv2 */
export function getSameMergeResult(element: Element): TowerTypeId | null {
  const map: Record<Element, TowerTypeId> = {
    fire: 'fire_2', water: 'water_2', wood: 'wood_2',
    earth: 'earth_2', metal: 'metal_2', yin: 'yin_2', yang: 'yang_2'
  };
  return map[element] ?? null;
}

/** 異系配方合成查表 */
export const CROSS_RECIPES: MergeRecipe[] = [
  { input1: 'wood',  input2: 'fire',  output: 'wood_fire' },   // 木生火
  { input1: 'fire',  input2: 'earth', output: 'fire_earth' },  // 火生土
  { input1: 'earth', input2: 'metal', output: 'earth_metal' }, // 土生金
  { input1: 'metal', input2: 'water', output: 'metal_water' }, // 金生水
  { input1: 'water', input2: 'wood',  output: 'water_wood' },  // 水生木
  { input1: 'yin',   input2: 'yang',  output: 'yin_yang' },    // 陰 + 陽 = 太極
];

/** 查詢異系合成結果（不分順序） */
export function getCrossRecipeResult(el1: Element, el2: Element): TowerTypeId | null {
  for (const recipe of CROSS_RECIPES) {
    if ((recipe.input1 === el1 && recipe.input2 === el2) ||
        (recipe.input1 === el2 && recipe.input2 === el1)) {
      return recipe.output;
    }
  }
  return null;
}

/** 五行相剋表：key 剋 value */
export const ELEMENT_COUNTER: Record<string, Element> = {
  metal: 'wood',
  wood: 'earth',
  earth: 'water',
  water: 'fire',
  fire: 'metal'
};

/** 計算相剋加成倍率 */
export function getElementBonus(towerElement: Element, enemyElement: Element): number {
  if (ELEMENT_COUNTER[towerElement] === enemyElement) {
    return 1.3; // +30% 傷害
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

