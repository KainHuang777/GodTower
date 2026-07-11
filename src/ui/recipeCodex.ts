// src/ui/recipeCodex.ts — 五行配方指南 (Codex)
import { getDomRefs } from '../domRefs';
import { BASE_TOWERS, LV2_TOWERS, RECIPE_TOWERS, CROSS_RECIPES } from '../towers';

export function initRecipeCodex() {
  const refs = getDomRefs();
  
  // 顯示配方書
  refs.btnCodex.addEventListener('click', () => {
    refs.recipeCodexModal.style.display = 'flex';
    renderCodex();
  });

  // 關閉配方書
  refs.btnCloseCodex.addEventListener('click', () => {
    refs.recipeCodexModal.style.display = 'none';
  });

  // 點擊背景關閉
  refs.recipeCodexModal.addEventListener('click', (e) => {
    if (e.target === refs.recipeCodexModal) {
      refs.recipeCodexModal.style.display = 'none';
    }
  });
}

function renderCodex() {
  const container = getDomRefs().codexBody;
  container.innerHTML = '';

  // 1. 同系二星升級 (7 條)
  const sec1 = document.createElement('div');
  sec1.innerHTML = `<div class="codex-section-title">⭐ 同系升級 (同系 Lv1 × 2 ➜ Lv2 塔)</div>`;
  const grid1 = document.createElement('div');
  grid1.className = 'codex-grid';

  const baseKeys = ['fire', 'water', 'wood', 'earth', 'metal', 'yin', 'yang'];
  for (const k of baseKeys) {
    const b = BASE_TOWERS[k];
    const l2 = LV2_TOWERS[`${k}_2` as any];
    if (!b || !l2) continue;

    const card = document.createElement('div');
    card.className = 'codex-card';
    card.innerHTML = `
      <div class="codex-formula">
        <span>${b.emoji}</span> <span>${b.name}</span>
        <span class="codex-arrow">＋</span>
        <span>${b.emoji}</span>
        <span class="codex-arrow">➜</span>
        <span class="codex-result">${l2.name}</span>
      </div>
      <div class="codex-desc">${getTowerDesc(l2.id)}</div>
    `;
    grid1.appendChild(card);
  }
  sec1.appendChild(grid1);
  container.appendChild(sec1);

  // 2. 五行相生異系合成 (5 條)
  const sec2 = document.createElement('div');
  sec2.innerHTML = `<div class="codex-section-title">🌿 五行相生 (異系 L1 + 鄰近 L1 ➜ 元素相生塔)</div>`;
  const grid2 = document.createElement('div');
  grid2.className = 'codex-grid';

  const elementNames: Record<string, string> = {
    wood: '木', fire: '火', earth: '土', metal: '金', water: '水', yin: '陰', yang: '陽'
  };

  for (const r of CROSS_RECIPES) {
    if (r.input1 === 'yin' || r.input2 === 'yin') continue; // 陰陽另外分類
    if (['metal_water', 'water_wood'].includes(r.output)) continue; // 隱藏已凍結配方
    const b1 = BASE_TOWERS[r.input1];
    const b2 = BASE_TOWERS[r.input2];
    const out = RECIPE_TOWERS[r.output];
    if (!b1 || !b2 || !out) continue;

    const card = document.createElement('div');
    card.className = 'codex-card';
    card.innerHTML = `
      <div class="codex-formula">
        <span>${b1.emoji}</span>
        <span class="codex-arrow">＋</span>
        <span>${b2.emoji}</span>
        <span class="codex-arrow">➜</span>
        <span class="codex-result" style="color: #a78bfa;">${out.name}</span>
      </div>
      <div style="font-size: 0.65rem; color: #a5b4fc; font-weight: 600;">(${elementNames[b1.element]} ＋ ${elementNames[b2.element]})</div>
      <div class="codex-desc">${getTowerDesc(out.id)}</div>
    `;
    grid2.appendChild(card);
  }
  sec2.appendChild(grid2);
  container.appendChild(sec2);

  // 3. 陰陽太極合成 (1 條)
  const sec3 = document.createElement('div');
  sec3.innerHTML = `<div class="codex-section-title">☯️ 陰陽融合 (暗影 L1 + 聖光 L1 ➜ 太極真傷塔)</div>`;
  const grid3 = document.createElement('div');
  grid3.className = 'codex-grid';

  const rYinYang = CROSS_RECIPES.find(r => r.input1 === 'yin' && r.input2 === 'yang');
  if (rYinYang) {
    const b1 = BASE_TOWERS['yin'];
    const b2 = BASE_TOWERS['yang'];
    const out = RECIPE_TOWERS[rYinYang.output];
    if (b1 && b2 && out) {
      const card = document.createElement('div');
      card.className = 'codex-card';
      card.innerHTML = `
        <div class="codex-formula">
          <span>${b1.emoji}</span> <span>${b1.name}</span>
          <span class="codex-arrow">＋</span>
          <span>${b2.emoji}</span> <span>${b2.name}</span>
          <span class="codex-arrow">➜</span>
          <span class="codex-result" style="color: #fafafa; text-shadow: 0 0 4px rgba(255,255,255,0.4);">${out.name}</span>
        </div>
        <div class="codex-desc">${getTowerDesc(out.id)}</div>
      `;
      grid3.appendChild(card);
    }
  }
  sec3.appendChild(grid3);
  container.appendChild(sec3);
}

// 根據塔的特點回傳簡短描述
function getTowerDesc(id: string): string {
  const descMap: Record<string, string> = {
    // base
    fire: '大範圍群傷，附帶點燃效果',
    water: '單體減速，提供主要控場',
    wood: '附帶毒性 DOT 傷害',
    earth: '純防禦岩壁，不可攻擊但極便宜',
    metal: '單體高攻，極高機率產生雙倍暴擊',
    yin: '附帶生命值比例傷害',
    yang: '對飛行怪雙倍傷害，射擊能微量治療基地',
    
    // lv2
    fire_2: '強化群攻，大半徑濺射傷害',
    water_2: '極高比例減速，大幅拖慢敵人',
    wood_2: '強效毒性持傷，毒傷可高額疊加',
    earth_2: '二星岩壁，提供微量輔助地刺攻擊',
    metal_2: '高機率 2.0 倍暴擊傷害，鏡刃分裂',
    yin_2: '高額生命值比例傷害（8%）',
    yang_2: '大幅強化對空，射擊治療基地（0.3 HP）',

    // recipes
    wood_fire: '焚林塔：產生大範圍爆裂濺射 + 劇毒燃燒 DOT',
    fire_earth: '熔岩塔：地面灼燒區域持傷，持續熔解經過的敵人',
    earth_metal: '鍛造塔：不主動射擊，大幅提升周圍防禦塔的攻擊與射程',
    metal_water: '寒鐵塔：高傷害穿透子彈，並造成極強的冰凍深度減速',
    water_wood: '靈木塔：高頻水箭，並有機會在敵人腳下生成臨時障礙物阻擋',
    yin_yang: '太極塔：射出陰陽太極球造成真實傷害，並高額治療基地HP'
  };
  return descMap[id] ?? '五行奧秘，攻防一體';
}
