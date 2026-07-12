// src/ui/uiManager.ts — HUD 與介面更新

import { gameState } from '../state';
import { getDomRefs } from '../domRefs';
import { MAX_WAVES } from '../types';
import { isTowerUnlocked, getWallCost } from '../talent';
import { BASE_TOWERS, TowerTypeId } from '../towers';
import { updateCompassHighlight } from './wuxingCompass';
import { drawTowerSprite } from '../sprites';
import { getWaveConfig, ENEMY_DEFS } from '../enemies';
import { getElementAccent } from '../theme';
import { rollMysteryBox } from '../system/roguelikeSystem';

export function updateUI() {
  getDomRefs().hpVal.textContent = gameState.currentMap.id === 'test_level' ? '∞' : Math.floor(gameState.hp).toString();
  getDomRefs().goldVal.textContent = gameState.currentMap.id === 'test_level' ? '∞' : gameState.gold.toString();
  getDomRefs().waveVal.textContent = gameState.wave.toString();
  getDomRefs().killVal.textContent = gameState.killCount.toString();
  const maxWaves = gameState.currentMap.id === 'tutorial' ? 5 : MAX_WAVES;
  getDomRefs().btnStartWave.disabled = gameState.isWaveActive || (gameState.currentMap.id !== 'test_level' && gameState.wave >= maxWaves);
  updateWaveProgress();
  updateLevelTutorial();
  updateRoguelikeHUD();

  const testControls = document.getElementById('testControls');
  if (testControls) {
    testControls.style.display = gameState.currentMap.id === 'test_level' ? 'flex' : 'none';
  }

  // 1.4 Details Panel toggle binding and rendering
  const btnToggleDetails = document.getElementById('btnToggleDetails');
  const detailsContent = document.getElementById('detailsContent');
  if (btnToggleDetails && detailsContent && !btnToggleDetails.onclick) {
    btnToggleDetails.onclick = () => {
      const isHidden = detailsContent.style.display === 'none';
      detailsContent.style.display = isHidden ? 'flex' : 'none';
      btnToggleDetails.textContent = isHidden ? '📊 收合詳細數據' : '📊 展開詳細數據 (怪物預覽 & 防禦塔DPS統計)';
      updateUI();
      if (gameState.resizeGameContainer) {
        gameState.resizeGameContainer();
      }
    };
  }

  if (detailsContent && detailsContent.style.display === 'flex') {
    // Render monster preview
    const waveToPreview = gameState.isWaveActive ? gameState.wave : gameState.wave + 1;
    const configs = getWaveConfig(waveToPreview);
    const listEl = document.getElementById('monsterPreviewList');
    if (listEl) {
      if (configs.length === 0) {
        listEl.innerHTML = '<span style="font-style: italic; color: #475569;">無怪物預覽資料</span>';
      } else {
        const enemyNames: Record<string, string> = {
          snake: '🐍 木蛇', fly: '🦟 金蠅', salamander: '🦎 火蜥蜴',
          water_spirit: '💧 水靈', golem: '🗿 土傀儡', beetle: '🪲 陰甲蟲', boss_dragon: '🐲 陽龍'
        };
        const elementLabels: Record<string, { label: string, color: string }> = {
          wood: { label: '[木]', color: '#4ade80' },
          fire: { label: '[火]', color: '#ef4444' },
          earth: { label: '[土]', color: '#fbbf24' },
          water: { label: '[水]', color: '#38bdf8' },
          metal: { label: '[金]', color: '#cbd5e1' },
          yin: { label: '[陰]', color: '#c084fc' },
          yang: { label: '[陽]', color: '#fef08a' }
        };
        listEl.innerHTML = configs.map(c => {
          const def = ENEMY_DEFS[c.enemyType];
          const hp = Math.floor(def.baseHp * c.hpMultiplier);
          let details = [];
          if (c.armor) details.push('裝甲');
          if (c.regen) details.push('再生');
          if (c.split) details.push('分裂');
          const detailStr = details.length > 0 ? ` [${details.join('、')}]` : '';
          
          const elInfo = elementLabels[def.element] ?? { label: `[${def.element}]`, color: '#cbd5e1' };
          const elSpan = `<span style="color: ${elInfo.color}; margin-left: 4px; font-weight: bold;">${elInfo.label}</span>`;
          
          return `<div style="display:flex; justify-content:space-between; width:100%; border-bottom:1px solid rgba(255,255,255,0.05); padding:2px 0;">
            <span>${enemyNames[c.enemyType] || c.enemyType}${elSpan} × ${c.count}</span>
            <span style="color:#f43f5e;">HP: ${hp}${detailStr}</span>
          </div>`;
        }).join('');
      }
    }

    // Render tower DPS
    const dpsStatsList = document.getElementById('dpsStatsList');
    if (dpsStatsList) {
      if (gameState.towers.length === 0) {
        dpsStatsList.innerHTML = '<span style="font-style: italic; color: #475569;">尚未建造防禦塔</span>';
      } else {
        const durationSec = Math.max(1, gameState.waveTicks / 60);
        const sortedTowers = [...gameState.towers].sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0));
        dpsStatsList.innerHTML = sortedTowers.map(t => {
          const dps = Math.round((t.damageDealt || 0) / durationSec);
          return `<div style="display:flex; justify-content:space-between; width:100%; border-bottom:1px solid rgba(255,255,255,0.05); padding:2px 0;">
            <span>${t.def.name} (${t.x}, ${t.y})</span>
            <span style="color:#22c55e; font-weight:bold;">輸出: ${t.damageDealt || 0} (DPS: ${dps})</span>
          </div>`;
        }).join('');
      }
    }
  }
}

export function updateWaveProgress() {
  const isBossWave = [5, 10, 15, 20].includes(gameState.wave);
  const fill = getDomRefs().waveProgressFill;
  if (fill) {
    fill.classList.toggle('boss-wave', isBossWave);
  }

  if (!gameState.isWaveActive) {
    getDomRefs().waveProgressLabel.textContent = '待機中';
    getDomRefs().waveEnemyCount.textContent = '';
    getDomRefs().waveProgressFill.style.width = '0%';
    getDomRefs().waveProgressFill.classList.add('idle');
    
    // Reset Wave Circle
    const waveRingFill = document.getElementById('waveRingFill');
    if (waveRingFill) {
      waveRingFill.style.strokeDashoffset = '100';
    }
    return;
  }
  getDomRefs().waveProgressFill.classList.remove('idle');
  const alive = gameState.enemies.length;
  const remaining = alive + Math.max(0, gameState.waveTotal - gameState.waveSpawned);
  const pct = gameState.waveTotal > 0 ? (1 - remaining / gameState.waveTotal) * 100 : 100;
  getDomRefs().waveProgressFill.style.width = `${Math.min(100, pct)}%`;
  getDomRefs().waveProgressLabel.textContent = `波次 ${gameState.wave} 進行中`;
  getDomRefs().waveEnemyCount.textContent = remaining > 0 ? `剩餘 ${remaining} 隻` : '即將結束...';

  // Update Wave Circle progress ring
  const waveRingFill = document.getElementById('waveRingFill');
  if (waveRingFill) {
    const dashOffset = 100 - Math.min(100, pct);
    waveRingFill.style.strokeDashoffset = dashOffset.toString();
  }
}

export function showTooltip(e: MouseEvent | { clientX: number, clientY: number }, _tid: string, def: any, cost: number, isBuilt: boolean = false, towerInstance?: any) {
  const tooltip = document.getElementById('towerTooltip');
  if (!tooltip) return;

  const elementNames: Record<string, string> = {
    wood: '木 (克土)', fire: '火 (克金)', earth: '土 (克水)', metal: '金 (克木)', water: '水 (克火)', yin: '陰', yang: '陽'
  };
  
  let html = `
    <div style="font-weight: bold; font-size: 0.9rem; color: var(--gold); margin-bottom: 4px; display: flex; justify-content: space-between;">
      <span>${def.name}</span>
      <span style="color: #cbd5e1; font-size: 0.75rem;">Lv.${def.level || 1}</span>
    </div>
    <div style="margin-bottom: 6px; font-size: 0.72rem; color: var(--text-muted);">
      屬性: <span style="color: ${def.element === 'fire' ? '#ef4444' : def.element === 'water' ? '#38bdf8' : def.element === 'wood' ? '#22c55e' : def.element === 'earth' ? '#fbbf24' : def.element === 'metal' ? '#cbd5e1' : def.element === 'yin' ? '#c084fc' : '#facc15'}">${elementNames[def.element] || def.element}</span>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; border-bottom: 1px dashed #334155; padding-bottom: 6px; margin-bottom: 6px; font-size: 0.72rem;">
      <div>傷害: <span style="color: #ef4444; font-weight: bold;">${def.damage || 0}</span></div>
      <div>射程: <span style="color: #38bdf8; font-weight: bold;">${def.range || 0}</span></div>
      <div>冷卻: <span style="color: #a5b4fc; font-weight: bold;">${def.fireRate || 0}f</span></div>
      <div>造價: <span style="color: #fbbf24; font-weight: bold;">${cost}g</span></div>
    </div>
  `;

  let effects = '';
  if (def.aoeRadius) effects += `<div>💥 <b>範圍濺射</b>: 半徑 ${def.aoeRadius} 格 (傷害 ${Math.round(def.aoeDamagePct * 100)}%)</div>`;
  if (def.slowPct) effects += `<div>❄️ <b>冰凍減速</b>: 降低速度 ${Math.round(def.slowPct * 100)}%</div>`;
  if (def.dotDamage) effects += `<div>🌿 <b>毒性灼燒</b>: 每秒 ${Math.round(def.dotDamage * 60)} 點傷害</div>`;
  if (def.critChance) effects += `<div>🎯 <b>鏡刃暴擊</b>: ${Math.round(def.critChance * 100)}% 機率造成 ${def.critMultiplier}x 傷害</div>`;
  if (def.hpPctDamage) effects += `<div>🌑 <b>百分比真傷</b>: 額外 ${Math.round(def.hpPctDamage * 100)}% 最大血量傷害</div>`;
  if (def.flyingBonus) effects += `<div>🦅 <b>對空優勢</b>: 對飛行怪傷害 +${Math.round(def.flyingBonus * 100)}%</div>`;
  if (def.healBase) effects += `<div>💚 <b>太極回春</b>: 命中時回復基地 ${def.healBase} HP</div>`;
  if (def.buffAllyDmg) effects += `<div>⚒️ <b>鐵匠增益</b>: 提升周圍砲台 ${Math.round(def.buffAllyDmg * 100)}% 傷害 (射程 ${def.buffAllyRange}格)</div>`;
  if (def.spawnWall) effects += `<div>🌿 <b>纏縛地形</b>: 生成臨時牆壁阻擋怪物</div>`;
  if (def.trueDamage) effects += `<div>☯️ <b>太極真傷</b>: 無視防禦屬性</div>`;

  if (effects) {
    html += `
      <div style="font-size: 0.72rem; line-height: 1.4; color: #a78bfa; margin-bottom: 6px;">
        ${effects}
      </div>
    `;
  }

  if (isBuilt && towerInstance) {
    const durationSec = Math.max(1, gameState.waveTicks / 60);
    const dps = Math.round((towerInstance.damageDealt || 0) / durationSec);
    html += `
      <div style="border-top: 1px dashed #334155; padding-top: 6px; font-size: 0.72rem; color: #22c55e; font-weight: bold;">
        📊 累積輸出: ${towerInstance.damageDealt || 0} (DPS: ${dps})
      </div>
    `;
  }

  tooltip.style.display = 'block';
  tooltip.innerHTML = html;
  tooltip.style.left = `${e.clientX + 12}px`;
  tooltip.style.top = `${e.clientY + 12}px`;
}

export function updateTooltipPos(e: MouseEvent | { clientX: number, clientY: number }) {
  const tooltip = document.getElementById('towerTooltip');
  if (!tooltip || tooltip.style.display === 'none') return;
  tooltip.style.left = `${e.clientX + 12}px`;
  tooltip.style.top = `${e.clientY + 12}px`;
}

export function hideTooltip() {
  const tooltip = document.getElementById('towerTooltip');
  if (tooltip) tooltip.style.display = 'none';
}

/** Roguelike HUD 更新：顯示当前生效的 Buff 標籤與神秘召喚定價 */
export function updateRoguelikeHUD() {
  const rl = gameState.roguelikeState;
  const buffBar = document.getElementById('rogueBuffBar');
  const buffList = document.getElementById('rogueBuffList');
  const mysteryPriceEl = document.getElementById('mysteryPrice');
  const btnMystery = document.getElementById('btnMystery');

  // 更新神秘召喚按鈕定價
  if (mysteryPriceEl) {
    const price = gameState.currentMap.id === 'test_level' ? 0 : rl.mysteryBoxPrice;
    mysteryPriceEl.textContent = price > 0 ? `(${price}g)` : '(免費)';
  }
  if (btnMystery) {
    const isTutorialActive = gameState.currentMap.id === 'tutorial' && gameState.levelTutorialStep !== 'completed';
    btnMystery.style.display = (gameState.currentScene === 'BATTLE' && !isTutorialActive) ? '' : 'none';
  }

  if (!buffBar || !buffList) return;

  // 建立 Buff 標籤列表
  const tags: string[] = [];

  const elementColors: Record<string, string> = {
    fire: '#ef4444', water: '#38bdf8', wood: '#22c55e',
    earth: '#fbbf24', metal: '#cbd5e1', yin: '#c084fc', yang: '#fde047'
  };
  const elementEmoji: Record<string, string> = {
    fire: '🔥', water: '💧', wood: '🌿', earth: '🗻', metal: '⚙️', yin: '🌑', yang: '☀️'
  };

  for (const [el, bonus] of Object.entries(rl.elementDmgBonus)) {
    if ((bonus ?? 0) > 0) {
      const color = elementColors[el] || '#fff';
      const emoji = elementEmoji[el] || '✨';
      const pct = Math.round((bonus ?? 0) * 100);
      tags.push(`<span class="rogue-buff-tag" style="color:${color}; border-color:${color}55;">${emoji}+${pct}%</span>`);
    }
  }

  if (rl.rangeBonusGlobal > 0) {
    tags.push(`<span class="rogue-buff-tag" style="color:#67e8f9; border-color:#67e8f955;">🌐射程+${rl.rangeBonusGlobal}</span>`);
  }

  if (rl.attackSpeedBonus > 0 && rl.attackSpeedWavesLeft > 0) {
    tags.push(`<span class="rogue-buff-tag" style="color:#facc15; border-color:#facc1555;">⚡攻速+15%(${rl.attackSpeedWavesLeft}波)</span>`);
  }

  if (rl.freeNextBuild) {
    tags.push(`<span class="rogue-buff-tag free-build">🔨免費建塔</span>`);
  }

  if (rl.nextMergeCostPct < 1.0) {
    const discount = Math.round((1 - rl.nextMergeCostPct) * 100);
    tags.push(`<span class="rogue-buff-tag" style="color:#a78bfa; border-color:#a78bfa55;">&#9841;合成-${discount}%</span>`);
  }

  if (tags.length > 0) {
    buffBar.style.display = 'flex';
    buffList.innerHTML = tags.join('');
  } else {
    buffBar.style.display = 'none';
    buffList.innerHTML = '';
  }
}

export function buildTowerButtons() {
  getDomRefs().towerButtonsContainer.innerHTML = '';
  const towerIds: TowerTypeId[] = ['earth', 'fire', 'water', 'wood', 'metal', 'yin', 'yang'];

  for (const tid of towerIds) {
    const def = BASE_TOWERS[tid];
    if (!def) continue;
    const unlocked = gameState.currentMap.id === 'test_level' ? true : isTowerUnlocked(gameState.talentData, tid);
    const btn = document.createElement('button');
    btn.className = 'btn tower-btn';
    btn.setAttribute('data-tool', tid);
    btn.disabled = !unlocked;
    const cost = tid === 'earth' ? getWallCost(gameState.talentData) : def.cost;
    const accentColor = getElementAccent(tid);

    btn.innerHTML = `
      <div class="tower-btn-color-bar" style="background-color: ${accentColor}"></div>
      <div class="tower-btn-icon-container" style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; margin-bottom: 2px;">
        <canvas class="tower-btn-canvas" width="16" height="24" style="width: 24px; height: 36px; image-rendering: pixelated;"></canvas>
      </div>
      <div class="tower-btn-name">${def.name}</div>
      <div class="tower-btn-cost">${cost}g</div>
    `;

    const canvas = btn.querySelector('.tower-btn-canvas') as HTMLCanvasElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawTowerSprite(ctx, tid, 0, 8, 1.0, 'pixel');
      }
    }

    if (!unlocked && gameState.currentMap.id !== 'test_level') {
      btn.title = '需先在天賦頁解鎖';
    } else {
      btn.addEventListener('mouseenter', (e) => showTooltip(e, tid, def, cost));
      btn.addEventListener('mousemove', (e) => updateTooltipPos(e));
      btn.addEventListener('mouseleave', () => hideTooltip());
    }

    btn.addEventListener('click', () => {
      if (!unlocked) return;
      gameState.mergeMode = false;
      gameState.mergeFirstTower = null;
      gameState.selectedTool = tid;
      refreshToolSelection();
    });
    getDomRefs().towerButtonsContainer.appendChild(btn);
  }
}

export function refreshToolSelection() {
  const allBtns = getDomRefs().towerButtonsContainer.querySelectorAll('.btn');
  allBtns.forEach(b => {
    b.classList.remove('active');
    b.classList.remove('btn-guide-pulse'); // 清除閃爍高亮
  });

  const btnStartWave = getDomRefs().btnStartWave;
  if (btnStartWave) {
    btnStartWave.classList.remove('btn-guide-pulse');
  }

  // 新手教學引導下的按鈕點滅高亮
  if (gameState.currentMap.id === 'tutorial' && gameState.levelTutorialStep !== 'idle' && gameState.levelTutorialStep !== 'completed') {
    getDomRefs().towerButtonsContainer.querySelectorAll('.btn-guide-pulse').forEach(btn => btn.classList.remove('btn-guide-pulse'));
    getDomRefs().btnStartWave.classList.remove('btn-guide-pulse');
    getDomRefs().btnMerge.classList.remove('btn-guide-pulse');
    getDomRefs().btnSpeed.classList.remove('btn-guide-pulse');

    if (gameState.levelTutorialStep === 'build_wall') {
      const wallBtn = getDomRefs().towerButtonsContainer.querySelector('[data-tool="earth"]');
      if (wallBtn) wallBtn.classList.add('btn-guide-pulse');
    } else if (gameState.levelTutorialStep === 'build_tower') {
      const fireBtn = getDomRefs().towerButtonsContainer.querySelector('[data-tool="fire"]');
      if (fireBtn) fireBtn.classList.add('btn-guide-pulse');
    } else if (gameState.levelTutorialStep === 'start_wave' || gameState.levelTutorialStep === 'wave_5_guide') {
      getDomRefs().btnStartWave.classList.add('btn-guide-pulse');
    } else if (gameState.levelTutorialStep === 'merge_guide') {
      getDomRefs().btnMerge.classList.add('btn-guide-pulse');
    } else if (gameState.levelTutorialStep === 'speed_guide') {
      getDomRefs().btnSpeed.classList.add('btn-guide-pulse');
    }
  }

  const activeBtn = getDomRefs().towerButtonsContainer.querySelector(`[data-tool="${gameState.selectedTool}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  getDomRefs().btnInspect.classList.toggle('active', gameState.selectedTool === '' && !gameState.mergeMode);
  getDomRefs().btnMerge.classList.toggle('active', gameState.mergeMode);
  getDomRefs().btnSell.classList.toggle('active', gameState.selectedTool === 'sell');

  if (gameState.mergeTutorialState === 'active') {
    getDomRefs().instructionText.innerHTML = '💡 <span class="merge-tutorial-highlight">偵測到場上有兩座防禦塔可以進行合成！</span> 點擊下方的【🔮 合成】按鈕，再依序點擊這兩座金色光圈高亮的塔，即可將其升級！';
  } else if (gameState.mergeMode) {
    getDomRefs().instructionText.innerHTML = '<span class="merge-hint">🔮 合成模式：點擊一座塔選為材料，再點擊相鄰的塔進行合成</span>';
  } else if (gameState.selectedTool === 'sell') {
    getDomRefs().instructionText.textContent = '💰 拆除模式：點擊砲台將其拆除並退回部分金幣';
  } else {
    if (gameState.currentMap && gameState.currentMap.id === 'tutorial') {
      getDomRefs().instructionText.innerHTML = '🎓 <span style="color:#fbbf24; font-weight:bold;">教學引導：</span>因橫向長牆阻擋，怪物必須先向右繞過 3 號點入口才進入 1 號點。推薦在右側瓶頸 <span style="color:#38bdf8; font-weight:bold;">(58, 17)</span> 建造攻擊塔，讓怪物在三個尋路階段反覆受擊！';
    } else {
      getDomRefs().instructionText.innerHTML = '選擇砲台後點擊地圖擺放。怪物依序碰觸 <span style="color:#f59e0b">❶❷❸❹❺</span> 檢查點再抵達基地。用砲台築迷宮！';
    }
  }

  // 更新羅盤高亮
  updateCompassHighlight();
}

export function updateLevelTutorial() {
  const panel = document.getElementById('levelTutorialPanel');
  const textEl = document.getElementById('levelTutorialText');
  const nextBtn = document.getElementById('btnLevelTutorialNext');

  if (!panel || !textEl || !nextBtn) return;

  if (gameState.currentMap.id !== 'tutorial' || gameState.levelTutorialStep === 'idle' || gameState.levelTutorialStep === 'completed') {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  switch (gameState.levelTutorialStep) {
    case 'intro':
      textEl.innerHTML = `💡 <b>歡迎來到五行迷宮塔防！</b><br>
      怪物從<span style="color:#4ade80;"> 左中起點 </span>出發，必須依序通過三個 <span style="color:#f59e0b;">❶❷❸</span> 標記點，最後到達<span style="color:#f87171;"> 右中終點 </span>。<br>
      地圖已有天然障礙物將怪物路線拉成曲折的 W 形！<br>
      <span style="color:#f59e0b;"><b>你的任務：</b>在通道旁建造防禦塔，讓怪物在巡迴中大量受擊！</span>`;
      nextBtn.textContent = '我知道了 (下一步)';
      nextBtn.style.display = 'block';
      break;

    case 'build_wall':
      textEl.innerHTML = `🧱 <b>教學步驟 1/3：建造岩壁塔延長怪物路徑</b><br>
      請選擇下方的【⛰️ 岩壁塔】，在地圖中的通道口建造牆壁。<br>
      <span style="color:#38bdf8;"><b>建議位置：</b>地圖右側 ❸ 號點附近（右上方通道口），可強迫怪物額外繞行！</span><br>
      <span style="color:#94a3b8; font-size:0.85em;">💡 岩壁塔不會攻擊，只用於構建迷宮路線。</span>`;
      nextBtn.style.display = 'none';
      break;

    case 'build_tower':
      textEl.innerHTML = `🔥 <b>教學步驟 2/3：建造攻擊塔</b><br>
      太棒了！怪物的路線被你成功拉長了！<br>
      現在請選擇【🔥 烈焰塔】，在剛才岩壁塔的<span style="color:#f97316; font-weight:bold;"> 旁邊 </span>建造一座攻擊塔！<br>
      <span style="color:#94a3b8; font-size:0.85em;">💡 技巧：將攻擊塔置於怪物往返的瓶頸口，可對反覆路過的怪物造成多次傷害！</span>`;
      nextBtn.style.display = 'none';
      break;

    case 'start_wave':
      textEl.innerHTML = `⚔️ <b>教學步驟 3/6：迎擊第一波！</b><br>
      防線已就緒，準備迎戰！<br>
      請點擊下方控制列的【⚔️ 下一波】按鈕，開始第一波怪物的進攻！`;
      nextBtn.style.display = 'none';
      break;

    case 'merge_guide':
      textEl.innerHTML = `🔮 <b>教學步驟 4/6：合併升級防禦塔</b><br>
      第一波防禦成功！現在系統在相鄰位置免費贈送了第二座【🔥 烈焰塔】。<br>
      請點擊下方的【🔮 合成】按鈕，然後<b>依序點擊這兩座烈焰塔</b>來進行合成！<br>
      <span style="color:#a78bfa; font-weight:bold;">💡 效果：兩座 Lv1 烈焰塔會融合成一座強大的 Lv2 烈焰塔，傷害與範圍全面提升！</span>`;
      nextBtn.style.display = 'none';
      break;

    case 'speed_guide':
      textEl.innerHTML = `⚡ <b>教學步驟 5/6：利用加速按鈕</b><br>
      合成成功！你現在擁有了威力更強的【🔥 烈焰塔 Lv2】。<br>
      戰鬥過程可能有些漫長，請點擊下方的【⚡ 1x】按鈕，將遊戲速度提升為 <span style="color:#fb923c; font-weight:bold;">2x</span> 或 <span style="color:#facc15; font-weight:bold;">3x</span>！`;
      nextBtn.style.display = 'none';
      break;

    case 'wave_5_guide':
      textEl.innerHTML = `🐲 <b>教學步驟 6/6：最終 Boss 考驗！</b><br>
      準備迎接最終防線！第 5 波將會出現強大的 <span style="color:#f43f5e; font-weight:bold;">陽龍 Boss 🐲</span>！<br>
      Boss 的血量高且有特殊技能，請做好準備，點擊【⚔️ 下一波】迎戰 Boss！<br>
      <span style="color:#38bdf8;">（通關第 5 波後，即可解鎖完整天賦樹並獲得天賦點！）</span>`;
      nextBtn.style.display = 'none';
      break;
  }
}

// 註冊 callback 到 gameState
gameState.updateUI = updateUI;
gameState.updateWaveProgress = updateWaveProgress;
gameState.buildTowerButtons = buildTowerButtons;
gameState.refreshToolSelection = refreshToolSelection;

// 神秘召喚按鈕事件（延遲等待 DOM 準備）
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnMystery');
    if (btn) {
      btn.addEventListener('click', () => rollMysteryBox());
    }
  });
  // 若 DOM 已準備直接綁定
  if (document.readyState !== 'loading') {
    const btn = document.getElementById('btnMystery');
    if (btn && !btn.onclick) {
      btn.addEventListener('click', () => rollMysteryBox());
    }
  }
}
