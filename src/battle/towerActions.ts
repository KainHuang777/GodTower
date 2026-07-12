// src/battle/towerActions.ts — 建塔、售塔與合成控制

import { gameState } from '../state';
import { getTowerDef, getSameMergeResult, getCrossRecipeResult, getSellPrice, getSameMergeCost, getCrossMergeCost, TowerTypeId } from '../towers';
import { getWallCost } from '../talent';
import { validatePlacement, updateAllEnemyPaths } from './pathfinding';
import { playSFX } from '../audio/audioSystem';
import { createMergeParticles } from '../renderer/particles';
import { Tower } from '../types';

// 引入 UI 與渲染更新
import { updateUI } from '../ui/uiManager';
import { showFloat } from '../renderer/gameRenderer';

export function handleBuild(x: number, y: number) {
  if (gameState.grid[x][y] !== 0) { 
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '已有建物', '#ef4444', 15); 
    return; 
  }
  const def = getTowerDef(gameState.selectedTool as TowerTypeId);
  if (!def) return;

  const isFree = gameState.roguelikeState.freeNextBuild;
  const cost = gameState.selectedTool === 'earth' ? getWallCost(gameState.talentData) : def.cost;
  if (gameState.gold < cost && !isFree) { 
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '金幣不足', '#ef4444', 15); 
    return; 
  }

  if (def.isWall && !validatePlacement(x, y, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.enemies)) {
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '不能堵死怪物！', '#ef4444', 15);
    return;
  }

  gameState.grid[x][y] = def.isWall ? 1 : 0;
  
  // 免費建塔旗標檢查
  if (isFree) {
    const rl = gameState.roguelikeState as any;
    if (rl.freeBuildCharges && rl.freeBuildCharges > 0) {
      rl.freeBuildCharges--;
      if (rl.freeBuildCharges > 0) {
        rl.freeNextBuild = true;
      } else {
        rl.freeNextBuild = false;
      }
    } else {
      rl.freeNextBuild = false;
    }
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '免費建塔！', '#fde047', 15);
    
    // 處理開局隨機補給 (Start Bonus) 的連續免費贈予
    if (rl.startBonusTowers && Array.isArray(rl.startBonusTowers)) {
      const idx = rl.startBonusIndex ?? 0;
      if (idx < rl.startBonusTowers.length - 1) {
        const nextIdx = idx + 1;
        rl.startBonusIndex = nextIdx;
        const nextId = rl.startBonusTowers[nextIdx];
        const nextDef = getTowerDef(nextId);
        if (nextDef) {
          gameState.selectedTool = nextId;
          gameState.roguelikeState.freeNextBuild = true;
          if (gameState.refreshToolSelection) gameState.refreshToolSelection();
          
          setTimeout(() => {
            showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE - 20, `🎁 下一補給：${nextDef.name} (免費)`, '#a78bfa', 15);
          }, 300);
        }
      } else {
        rl.startBonusTowers = null;
        rl.startBonusIndex = 0;
      }
    }
  }
  
  gameState.towers.push({ id: gameState.nextTowerId++, x, y, typeId: def.id, def: { ...def, cost }, cooldown: 0, recoilY: 0, damageDealt: 0 });
  if (gameState.currentMap.id !== 'test_level' && !isFree) gameState.gold -= cost;
  updateUI();
  
  // 新手教學關卡引導狀態機
  if (gameState.currentMap.id === 'tutorial' && gameState.levelTutorialStep !== 'idle' && gameState.levelTutorialStep !== 'completed') {
    if (gameState.levelTutorialStep === 'build_wall' && def.isWall) {
      gameState.levelTutorialStep = 'build_tower';
      gameState.selectedTool = 'fire';
      if (gameState.refreshToolSelection) {
        gameState.refreshToolSelection();
      }
      updateUI();
    } else if (gameState.levelTutorialStep === 'build_tower' && def.id === 'fire') {
      gameState.levelTutorialStep = 'start_wave';
      if (gameState.refreshToolSelection) {
        gameState.refreshToolSelection();
      }
      updateUI();
    }
  }

  if (def.isWall) {
    updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.cachedPathTiles, gameState.cachedFullPath);
  }
  checkMergeTutorial();
}

export function handleSell(x: number, y: number) {
  if (gameState.grid[x][y] === 2) {
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '天然障礙物無法拆除', '#ef4444', 15);
    return;
  }
  const idx = gameState.towers.findIndex(t => t.x === x && t.y === y);
  if (idx === -1) return;
  const tower = gameState.towers[idx];
  const refund = (gameState.currentMap.id !== 'test_level' && gameState.wave <= 4) ? tower.def.cost : getSellPrice(tower.def);
  gameState.gold += refund;
  gameState.towers.splice(idx, 1);
  gameState.grid[x][y] = 0;
  if (gameState.mergeFirstTower && gameState.mergeFirstTower.id === tower.id) gameState.mergeFirstTower = null;
  if (gameState.selectedTower && gameState.selectedTower.id === tower.id) gameState.selectedTower = null;
  
  // 清理以死亡/無效敵人為目標的子彈，避免懸空參照
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const t = gameState.bullets[i].targetEnemy;
    if (!t || t.hp <= 0 || !gameState.enemies.some(e => e.id === t.id)) gameState.bullets.splice(i, 1);
  }
  updateUI();
  updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.cachedPathTiles, gameState.cachedFullPath);
  showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, `+${refund}g`, '#f59e0b');
}

export function handleMergeClick(x: number, y: number) {
  const clickedTower = gameState.towers.find(t => t.x === x && t.y === y);
  if (!clickedTower) {
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '沒有砲台', '#ef4444', 15);
    return;
  }

  if (!gameState.mergeFirstTower) {
    // 選擇第一座塔
    gameState.mergeFirstTower = clickedTower;
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '已選取，請點擊另一座塔合成', '#c084fc', 15);
    return;
  }

  // 選擇第二座塔 — 檢查是否為同一座塔（取消選取）
  if (clickedTower.id === gameState.mergeFirstTower.id) {
    showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '已取消選取', '#94a3b8', 15);
    gameState.mergeFirstTower = null;
    return;
  }

  // 同系合成
  if (clickedTower.def.element === gameState.mergeFirstTower.def.element &&
      clickedTower.def.level === 1 && gameState.mergeFirstTower.def.level === 1) {
    const resultId = getSameMergeResult(clickedTower.def.element);
    if (resultId) {
      performMerge(gameState.mergeFirstTower, clickedTower, resultId);
      gameState.mergeFirstTower = null;
      return;
    }
  }

  // 異系配方合成
  const el1 = gameState.mergeFirstTower.def.element;
  const el2 = clickedTower.def.element;
  const recipeResult = getCrossRecipeResult(el1, el2);
  if (recipeResult) {
    // 陰陽合成需天賦（測試關卡除外）
    if ((el1 === 'yin' || el1 === 'yang') && (el2 === 'yin' || el2 === 'yang')) {
      if (gameState.currentMap.id !== 'test_level' && (gameState.talentData.talentLevels['taiji_dao'] || 0) < 1) {
        showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '需解鎖「太極之道」天賦', '#ef4444', 15);
        gameState.mergeFirstTower = null;
        return;
      }
    }
    performMerge(gameState.mergeFirstTower, clickedTower, recipeResult);
    gameState.mergeFirstTower = null;
    return;
  }

  showFloat(x * gameState.TILE_SIZE + 8, y * gameState.TILE_SIZE, '無法合成此組合', '#ef4444', 15);
  gameState.mergeFirstTower = null;
}

export function performMerge(tower1: Tower, tower2: Tower, resultId: TowerTypeId) {
  const resultDef = getTowerDef(resultId);
  if (!resultDef) return;

  // 扣取合成費用
  const cost1 = tower1.def.cost;
  const cost2 = tower2.def.cost;
  let mergeCost: number;
  if (tower1.def.level === tower2.def.level && tower1.def.element === tower2.def.element) {
    mergeCost = getSameMergeCost(cost1);
  } else {
    mergeCost = getCrossMergeCost(cost1, cost2);
  }
  // 五行共鳴折扣
  const discount = gameState.roguelikeState.nextMergeCostPct;
  mergeCost = Math.floor(mergeCost * discount);

  // 新手教學與測試關卡免合成費
  if (gameState.currentMap.id === 'tutorial' || gameState.currentMap.id === 'test_level') {
    mergeCost = 0;
  }

  if (mergeCost > 0 && gameState.gold < mergeCost) {
    showFloat(tower2.x * gameState.TILE_SIZE + 8, tower2.y * gameState.TILE_SIZE, `金幣不足 (需 ${mergeCost}g)`, '#ef4444', 15);
    return;
  }
  gameState.gold -= mergeCost;

  // 設置合成動畫狀態 ( duration: 45 幀，約 0.75 秒 )
  gameState.mergeAnimation = {
    active: true,
    timer: 0,
    duration: 45,
    t1: { x: tower1.x, y: tower1.y, typeId: tower1.typeId },
    t2: { x: tower2.x, y: tower2.y, typeId: tower2.typeId },
    resultX: tower1.x,
    resultY: tower1.y,
    resultTypeId: resultId
  };

  // 先把這兩座防禦塔從 gameState.towers 中移除，以免動畫期間牠們繼續攻擊或重複被選中
  const idx1 = gameState.towers.findIndex(t => t.id === tower1.id);
  if (idx1 !== -1) gameState.towers.splice(idx1, 1);
  const idx2 = gameState.towers.findIndex(t => t.id === tower2.id);
  if (idx2 !== -1) gameState.towers.splice(idx2, 1);

  // 清除地圖佔位：tower2 格子清空，tower1 的格子先保留 1 (防止怪物在此期間穿牆)
  gameState.grid[tower1.x][tower1.y] = 1;
  gameState.grid[tower2.x][tower2.y] = 0;

  if (gameState.mergeFirstTower && (gameState.mergeFirstTower.id === tower1.id || gameState.mergeFirstTower.id === tower2.id)) {
    gameState.mergeFirstTower = null;
  }
  if (gameState.selectedTower && (gameState.selectedTower.id === tower1.id || gameState.selectedTower.id === tower2.id)) {
    gameState.selectedTower = null;
  }

  // P2 Tutorial check
  if (gameState.mergeTutorialState === 'active') {
    if (gameState.mergeTutorialTowers.includes(tower1.id) || gameState.mergeTutorialTowers.includes(tower2.id)) {
      gameState.mergeTutorialState = 'completed';
      gameState.mergeTutorialTowers = [];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('td_shown_merge_tutorial', 'true');
      }
      updateUI();
    }
  }

  // 清理子彈
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const t = gameState.bullets[i].targetEnemy;
    if (!t || t.hp <= 0 || !gameState.enemies.some(e => e.id === t.id)) gameState.bullets.splice(i, 1);
  }

  updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.cachedPathTiles, gameState.cachedFullPath);
  playSFX('merge_success');
}

export function updateMergeAnimation() {
  if (!gameState.mergeAnimation || !gameState.mergeAnimation.active) return;

  const anim = gameState.mergeAnimation;
  anim.timer++;

  if (anim.timer >= anim.duration) {
    const resultDef = getTowerDef(anim.resultTypeId as any);
    if (resultDef) {
      const newTower: Tower = {
        id: gameState.nextTowerId++,
        x: anim.resultX,
        y: anim.resultY,
        typeId: anim.resultTypeId as TowerTypeId,
        def: { ...resultDef },
        cooldown: 0,
        damageDealt: 0,
        recoilY: 0
      };
      gameState.towers.push(newTower);
      gameState.grid[anim.resultX][anim.resultY] = 1;

      // === 實作五行共鳴合成退款 ===
      if (gameState.roguelikeState.nextMergeCostPct < 1.0) {
        const def1 = getTowerDef(anim.t1.typeId as TowerTypeId);
        const def2 = getTowerDef(anim.t2.typeId as TowerTypeId);
        if (def1 && def2) {
          const totalCost = def1.cost + def2.cost;
          const refund = Math.floor(totalCost * (1.0 - gameState.roguelikeState.nextMergeCostPct));
          if (refund > 0) {
            gameState.gold += refund;
            setTimeout(() => {
              showFloat(anim.resultX * gameState.TILE_SIZE + 8, anim.resultY * gameState.TILE_SIZE - 20, `☯️ 共鳴返還 +${refund}g`, '#818cf8', 16);
            }, 300);
          }
        }
        // 重置 Buff 狀態
        gameState.roguelikeState.nextMergeCostPct = 1.0;
        updateUI();
      }

      // 動畫結束時爆發粒子
      const tx = anim.resultX * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const ty = anim.resultY * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      createMergeParticles(gameState.particles, gameState.TILE_SIZE, tx, ty);
      
      // 顯示浮空字 (支援打字機特效)
      showFloat(anim.resultX * gameState.TILE_SIZE + 8, anim.resultY * gameState.TILE_SIZE, `✨ ${resultDef.name}`, '#c084fc', 16, true);
      
      // 更新路徑
      updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.cachedPathTiles, gameState.cachedFullPath);
    }
    
    // 動畫結束，清空狀態
    gameState.mergeAnimation = null;

    if (gameState.currentMap.id === 'tutorial' && gameState.levelTutorialStep === 'merge_guide') {
      gameState.levelTutorialStep = 'speed_guide';
      updateUI();
    }
  }
}

export function checkMergeTutorial() {
  if (gameState.mergeTutorialState !== 'idle') return;

  for (let i = 0; i < gameState.towers.length; i++) {
    const t1 = gameState.towers[i];
    if (t1.def.isWall) continue;

    for (let j = i + 1; j < gameState.towers.length; j++) {
      const t2 = gameState.towers[j];
      if (t2.def.isWall) continue;

      const dist = Math.abs(t1.x - t2.x) + Math.abs(t1.y - t2.y);
      if (dist === 1) {
        const el1 = t1.def.element;
        const el2 = t2.def.element;
        const isSame = el1 === el2;
        let canMerge = false;
        
        if (isSame) {
          const level1 = t1.def.level || 1;
          const level2 = t2.def.level || 1;
          if (level1 === 1 && level2 === 1) {
            canMerge = true;
          }
        } else {
          const crossResult = getCrossRecipeResult(el1, el2);
          if (crossResult) {
            canMerge = true;
          }
        }

        if (canMerge) {
          gameState.mergeTutorialTowers = [t1.id, t2.id];
          gameState.mergeTutorialState = 'active';
          updateUI();
          return;
        }
      }
    }
  }
}
