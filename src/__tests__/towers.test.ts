// ============================================================
// src/__tests__/towers.test.ts — Tower system unit tests
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  BASE_TOWERS,
  LV2_TOWERS,
  RECIPE_TOWERS,
  getTowerDef,
  getSameMergeResult,
  getCrossRecipeResult,
  getElementBonus,
  getSellPrice,
  type TowerDef,
  type TowerTypeId,
  type Element,
} from '../towers.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const allTowerIds = (): TowerTypeId[] => {
  const ids: TowerTypeId[] = [];
  for (const key of Object.keys(BASE_TOWERS)) ids.push(key as TowerTypeId);
  for (const key of Object.keys(LV2_TOWERS)) ids.push(key as TowerTypeId);
  for (const key of Object.keys(RECIPE_TOWERS)) ids.push(key as TowerTypeId);
  return ids;
};

const validString = (v: unknown): boolean =>
  typeof v === 'string' && v.length > 0;

const validNumber = (v: unknown): boolean =>
  typeof v === 'number' && Number.isFinite(v);

const requiredFields = [
  'name', 'emoji', 'element', 'colorBase', 'colorAccent',
] as const;

const requiredNumeric = ['cost', 'damage', 'fireRate', 'range'] as const;

const baseElements = ['fire', 'water', 'wood', 'earth', 'metal', 'yin', 'yang'] as const;

// ===================================================================
// 1. Smoke — Tower Registry Integrity
// ===================================================================

describe('Tower Registry Integrity', () => {
  it('getTowerDef resolves all 7 base towers (non-null, matching .id)', () => {
    for (const el of baseElements) {
      const def = getTowerDef(el);
      expect(def, `missing base tower: ${el}`).not.toBeNull();
      expect(def!.id).toBe(el);
    }
  });

  it('getTowerDef resolves all 7 Lv2 towers (non-null, .level === 2)', () => {
    for (const el of baseElements) {
      const id = `${el}_2` as TowerTypeId;
      const def = getTowerDef(id);
      expect(def, `missing lv2 tower: ${id}`).not.toBeNull();
      expect(def!.level).toBe(2);
    }
  });

  it('getTowerDef resolves all 6 recipe towers (non-null, .level === 3)', () => {
    const recipeIds: TowerTypeId[] = [
      'wood_fire', 'fire_earth', 'earth_metal',
      'metal_water', 'water_wood', 'yin_yang',
    ];
    for (const id of recipeIds) {
      const def = getTowerDef(id);
      expect(def, `missing recipe tower: ${id}`).not.toBeNull();
      expect(def!.level).toBe(3);
    }
  });

  it('getTowerDef returns null for unknown ID', () => {
    expect(getTowerDef('no_such_tower' as TowerTypeId)).toBeNull();
  });

  it('all 20 tower IDs are unique', () => {
    const ids = allTowerIds();
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
  });

  it('every TowerDef has required fields populated', () => {
    for (const id of allTowerIds()) {
      const def = getTowerDef(id)!;
      for (const field of requiredFields) {
        expect(
          validString(def[field]),
          `${id}.${field} should be a non-empty string, got "${def[field]}"`,
        ).toBe(true);
      }
      for (const field of requiredNumeric) {
        expect(
          validNumber(def[field]),
          `${id}.${field} should be a finite number, got ${def[field]}`,
        ).toBe(true);
        expect(
          def[field] >= 0,
          `${id}.${field} should be >= 0, got ${def[field]}`,
        ).toBe(true);
      }
    }
  });
});

// ===================================================================
// 2. P0 — Metal_2 Stat Fix Validation (CRITICAL REGRESSION)
// ===================================================================

describe('Metal_2 Stat Fix (P0 regression)', () => {
  const metal2 = getTowerDef('metal_2')!;

  it('Metal_2.damage === 30 (nerfed from 40)', () => {
    expect(metal2.damage).toBe(30);
  });

  it('Metal_2.fireRate === 38 (changed from 35)', () => {
    expect(metal2.fireRate).toBe(38);
  });

  it('Metal_2.critChance === 0.30 (nerfed from 0.4)', () => {
    expect(metal2.critChance).toBe(0.30);
  });

  it('Metal_2.critMultiplier === 2.0 (nerfed from 2.5)', () => {
    expect(metal2.critMultiplier).toBe(2.0);
  });
});

// ===================================================================
// 3. Same-Element Merge Logic
// ===================================================================

describe('Same-Element Merge (getSameMergeResult)', () => {
  const expected: Record<string, string> = {
    fire: 'fire_2',
    water: 'water_2',
    wood: 'wood_2',
    earth: 'earth_2',
    metal: 'metal_2',
    yin: 'yin_2',
    yang: 'yang_2',
  };

  for (const [input, output] of Object.entries(expected)) {
    it(`${input} → ${output}`, () => {
      expect(getSameMergeResult(input as Element)).toBe(output);
    });
  }
});

// ===================================================================
// 4. Cross-Element Recipe Logic
// ===================================================================

describe('Cross-Element Recipes (getCrossRecipeResult)', () => {
  const validRecipes: Array<[Element, Element, TowerTypeId]> = [
    ['wood', 'fire', 'wood_fire'],
    ['fire', 'earth', 'fire_earth'],
    ['earth', 'metal', 'earth_metal'],
    ['yin', 'yang', 'yin_yang'],
  ];

  for (const [a, b, expected] of validRecipes) {
    it(`${a} + ${b} → ${expected}`, () => {
      expect(getCrossRecipeResult(a, b)).toBe(expected);
    });
  }

  it('recipes are order-independent', () => {
    // Verify that reversing each valid recipe still returns the same output
    const reversed: Array<[Element, Element, TowerTypeId]> = [
      ['fire', 'wood', 'wood_fire'],
      ['earth', 'fire', 'fire_earth'],
      ['metal', 'earth', 'earth_metal'],
      ['yang', 'yin', 'yin_yang'],
    ];
    for (const [a, b, expected] of reversed) {
      expect(getCrossRecipeResult(a, b)).toBe(expected);
    }
  });

  it('returns null for invalid combos', () => {
    expect(getCrossRecipeResult('fire', 'water')).toBeNull();
    expect(getCrossRecipeResult('metal', 'wood')).toBeNull();
    expect(getCrossRecipeResult('yin', 'fire')).toBeNull();
    expect(getCrossRecipeResult('fire', 'fire')).toBeNull();
  });

  it('returns null for frozen combos', () => {
    expect(getCrossRecipeResult('metal', 'water')).toBeNull();
    expect(getCrossRecipeResult('water', 'wood')).toBeNull();
  });
});

// ===================================================================
// 5. Element Counter Bonus
// ===================================================================

describe('Element Counter Bonus (getElementBonus)', () => {
  it('counter pairs return 1.3 at wave 0', () => {
    // ELEMENT_COUNTER: metal→wood, wood→earth, earth→water, water→fire, fire→metal
    expect(getElementBonus('metal', 'wood', 0)).toBe(1.3);
    expect(getElementBonus('wood', 'earth', 0)).toBe(1.3);
    expect(getElementBonus('earth', 'water', 0)).toBe(1.3);
    expect(getElementBonus('water', 'fire', 0)).toBe(1.3);
    expect(getElementBonus('fire', 'metal', 0)).toBe(1.3);
  });

  it('non-counter returns 1.0', () => {
    expect(getElementBonus('fire', 'water')).toBe(1.0);
    expect(getElementBonus('water', 'earth')).toBe(1.0);
    expect(getElementBonus('metal', 'fire')).toBe(1.0);
  });

  it('same-element returns 1.0 (no self-counter)', () => {
    expect(getElementBonus('fire', 'fire')).toBe(1.0);
    expect(getElementBonus('water', 'water')).toBe(1.0);
    expect(getElementBonus('yin', 'yin')).toBe(1.0);
  });

  it('reverse direction returns 1.0', () => {
    // wood is countered by metal, but wood vs metal should not give bonus
    expect(getElementBonus('wood', 'metal')).toBe(1.0);
    expect(getElementBonus('earth', 'wood')).toBe(1.0);
    expect(getElementBonus('water', 'earth')).toBe(1.0);
    expect(getElementBonus('fire', 'water')).toBe(1.0);
    expect(getElementBonus('metal', 'fire')).toBe(1.0);
  });

  it('yin/yang have no elemental counters', () => {
    for (const el of baseElements) {
      expect(getElementBonus('yin', el)).toBe(1.0);
      expect(getElementBonus('yang', el)).toBe(1.0);
      expect(getElementBonus(el, 'yin')).toBe(1.0);
      expect(getElementBonus(el, 'yang')).toBe(1.0);
    }
  });
});

// ===================================================================
// 6. Sell Price Formula
// ===================================================================

describe('Sell Price (getSellPrice)', () => {
  it('base towers: floor(cost × 0.7)', () => {
    for (const el of baseElements) {
      const def = getTowerDef(el)!;
      const expected = Math.floor(def.cost * 0.7);
      expect(
        getSellPrice(def),
        `${el} sell price`,
      ).toBe(expected);
    }
  });

  it('Lv2 towers: floor(baseCost × 2 × 0.5)', () => {
    for (const el of baseElements) {
      const lv2Id = `${el}_2` as TowerTypeId;
      const def = getTowerDef(lv2Id)!;
      const baseCost = BASE_TOWERS[el].cost;
      const expected = Math.floor(baseCost * 2 * 0.5);
      expect(
        getSellPrice(def),
        `${lv2Id} sell price`,
      ).toBe(expected);
    }
  });

  it('recipe towers: floor(matching base element cost × 2 × 0.5)', () => {
    // wood_fire.element === 'fire', matches BASE_TOWERS.fire.cost = 12
    const woodFire = getTowerDef('wood_fire')!;
    // floor(12 * 2 * 0.5) = 12
    expect(getSellPrice(woodFire)).toBe(12);

    // fire_earth.element === 'earth', matches BASE_TOWERS.earth.cost = 2
    const fireEarth = getTowerDef('fire_earth')!;
    expect(getSellPrice(fireEarth)).toBe(2);

    // earth_metal.element === 'metal', matches BASE_TOWERS.metal.cost = 15
    const earthMetal = getTowerDef('earth_metal')!;
    expect(getSellPrice(earthMetal)).toBe(15);

    // metal_water.element === 'water', matches BASE_TOWERS.water.cost = 10
    const metalWater = getTowerDef('metal_water')!;
    expect(getSellPrice(metalWater)).toBe(10);

    // water_wood.element === 'wood', matches BASE_TOWERS.wood.cost = 10
    const waterWood = getTowerDef('water_wood')!;
    expect(getSellPrice(waterWood)).toBe(10);

    // yin_yang.element === 'yin', matches BASE_TOWERS.yin.cost = 18
    const yinYang = getTowerDef('yin_yang')!;
    expect(getSellPrice(yinYang)).toBe(18);
  });

  it('wood_fire uses fire base cost (12) not fallback (5)', () => {
    const woodFire = getTowerDef('wood_fire')!;
    expect(woodFire.element).toBe('fire');
    expect(getSellPrice(woodFire)).toBe(12);
    // This confirms the sell price matches the element's base tower cost
    // (12 = floor(12 * 2 * 0.5)) rather than the fallback value of 5.
  });
});

// ===================================================================
// 7. DPS/Cost Ratio Bounds
// ===================================================================

const dpsOf = (def: TowerDef): number => {
  if (def.fireRate === 0) return 0;
  return def.damage / (def.fireRate / 60);
};

const dpsPerCost = (def: TowerDef): number => {
  if (def.cost === 0) return Infinity;
  return dpsOf(def) / def.cost;
};

describe('DPS/Cost Ratio Bounds — Lv1 towers', () => {
  // DPS towers (fire, metal) — high raw damage output
  it('fire Lv1 dps/cost in [1.5, 4.0]', () => {
    const ratio = dpsPerCost(BASE_TOWERS.fire);
    expect(ratio).toBeGreaterThanOrEqual(1.5);
    expect(ratio).toBeLessThanOrEqual(4.0);
  });

  it('metal Lv1 dps/cost in [1.5, 4.0]', () => {
    const ratio = dpsPerCost(BASE_TOWERS.metal);
    expect(ratio).toBeGreaterThanOrEqual(1.5);
    expect(ratio).toBeLessThanOrEqual(4.0);
  });

  // Utility towers (water, wood) — support/DoT, lower raw dps
  it('water Lv1 dps/cost in [0.3, 3.0]', () => {
    const ratio = dpsPerCost(BASE_TOWERS.water);
    expect(ratio).toBeGreaterThanOrEqual(0.3);
    expect(ratio).toBeLessThanOrEqual(3.0);
  });

  it('wood Lv1 dps/cost in [0.3, 3.0]', () => {
    const ratio = dpsPerCost(BASE_TOWERS.wood);
    expect(ratio).toBeGreaterThanOrEqual(0.3);
    expect(ratio).toBeLessThanOrEqual(3.0);
  });

  // Yin/Yang — hybrid utility/DPS, use utility bounds
  it('yin Lv1 dps/cost in [0.3, 3.0]', () => {
    const ratio = dpsPerCost(BASE_TOWERS.yin);
    expect(ratio).toBeGreaterThanOrEqual(0.3);
    expect(ratio).toBeLessThanOrEqual(3.0);
  });

  it('yang Lv1 dps/cost in [0.3, 3.0]', () => {
    const ratio = dpsPerCost(BASE_TOWERS.yang);
    expect(ratio).toBeGreaterThanOrEqual(0.3);
    expect(ratio).toBeLessThanOrEqual(3.0);
  });

  // Earth is a pure wall
  it('earth Lv1 has 0 damage and 0 fireRate (wall)', () => {
    expect(BASE_TOWERS.earth.damage).toBe(0);
    expect(BASE_TOWERS.earth.fireRate).toBe(0);
  });
});

describe('DPS/Cost Ratio — Metal_2 post-nerf', () => {
  it('Metal_2 effective DPS/cost (with crit) in [1.5, 2.5]', () => {
    const m2 = LV2_TOWERS.metal_2;
    const baseDps = m2.damage / (m2.fireRate / 60);
    // effective DPS including crit expected value
    const critMult = 1 + m2.critChance! * ((m2.critMultiplier ?? 1) - 1);
    const effDps = baseDps * critMult;
    // LV2 towers have cost=0 (merged from materials), use effective investment: 2 × base cost
    const effectiveCost = 2 * BASE_TOWERS.metal.cost; // 2 × 15 = 30
    const ratio = effDps / effectiveCost;
    expect(ratio).toBeGreaterThanOrEqual(1.5);
    expect(ratio).toBeLessThanOrEqual(2.5);
  });
});

// ===================================================================
// 8. Merge DPS Ratio
// ===================================================================

describe('Merge DPS Ratio (Lv2 vs 2×Lv1)', () => {
  const lv1Dps: Record<string, number> = {};
  for (const el of baseElements) {
    const def = BASE_TOWERS[el];
    lv1Dps[el] = def.fireRate > 0 ? def.damage / (def.fireRate / 60) : 0;
  }

  for (const el of baseElements) {
    const lv2Id = `${el}_2` as TowerTypeId;
    const lv2Def = getTowerDef(lv2Id)!;

    if (el === 'earth') {
      it('earth_2 has damage > 0 (earth Lv1 has 0 DPS)', () => {
        expect(lv2Def.damage).toBeGreaterThan(0);
      });
      continue;
    }

    it(`${el}_2 merge ratio in [0.6, 1.4]`, () => {
      const lv2Dps = lv2Def.fireRate > 0
        ? lv2Def.damage / (lv2Def.fireRate / 60)
        : 0;
      const twoLv1Dps = 2 * lv1Dps[el];
      const ratio = lv2Dps / twoLv1Dps;
      expect(ratio).toBeGreaterThanOrEqual(0.6);
      expect(ratio).toBeLessThanOrEqual(1.4);
    });
  }
});
