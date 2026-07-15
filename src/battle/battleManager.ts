// src/battle/battleManager.ts — 戰鬥生命週期與波次控制

import { gameState } from '../state';
import { getDomRefs } from '../domRefs';
import { getBaseHP, getStartGold, calcTalentPointsEarned, addTalentPoints, saveTalentData, markTraitSeen, getTalentDifficultyMod } from '../talent';
import { ENEMY_DEFS, getEnemyCollisionRadius, getWaveConfig, EnemyTypeId } from '../enemies';
import { astarFind, recalculatePathTiles, updateAllEnemyPaths } from './pathfinding';
import { ThemeId, WeatherId, MAX_WAVES } from '../types';
import { applyAscensionModifiers } from './difficulty';
import { BASE_TOWERS, LV2_TOWERS, RECIPE_TOWERS, TowerDef } from '../towers';
import { grantStartBonus, calcMysteryBoxPrice, showCardPicker, tickWaveBuffs } from '../system/roguelikeSystem';

// 引入渲染與 UI 更新
import { showFloat, initBgStars } from '../renderer/gameRenderer';
import { updateUI } from '../ui/uiManager';

export function startBattle() {
  // 關卡可宣告自己的展示尺寸；未宣告者沿用標準大地圖。
  const dimensions = gameState.currentMap.dimensions;
  gameState.COLS = dimensions?.cols ?? 80;
  gameState.ROWS = dimensions?.rows ?? 40;
  gameState.TILE_SIZE = dimensions?.tileSize ?? 16;

  // 重新分配 gameState.grid 大小
  gameState.grid = Array.from({ length: gameState.COLS }, () => Array(gameState.ROWS).fill(0));

  // 讀取地圖配置
  gameState.SPAWN_POINT = gameState.currentMap.spawnPoint;
  gameState.BASE_POINT = gameState.currentMap.basePoint;
  gameState.WAYPOINTS = gameState.currentMap.waypoints;

  // 讀取天賦效果
  gameState.hp = getBaseHP(gameState.talentData);
  gameState.gold = gameState.currentMap.id === 'test_level' ? 999999 : getStartGold(gameState.talentData);
  gameState.wave = 0;
  gameState.killCount = 0;
  gameState.isWaveActive = false;
  gameState.totalDamageDealt = 0;
  gameState.currentKillStreak = 0;
  gameState.maxKillStreak = 0;
  gameState.enemies = [];
  gameState.towers = [];
  gameState.bullets = [];
  gameState.floatingTexts = [];
  gameState.tempWalls = [];
  gameState.nextEnemyId = 1;
  gameState.nextTowerId = 1;
  gameState.mergeMode = false;
  gameState.mergeFirstTower = null;
  gameState.spawnTimers.forEach(t => clearInterval(t));
  gameState.spawnTimers = [];
  gameState.waveTotal = 0;
  gameState.waveSpawned = 0;

  // 重置 Roguelike 狀態
  gameState.roguelikeState = {
    elementDmgBonus: {},
    nextMergeCostPct: 1.0,
    rangeBonusGlobal: 0,
    attackSpeedBonus: 0,
    attackSpeedWavesLeft: 0,
    freeNextBuild: false,
    mysteryBoxPrice: calcMysteryBoxPrice(),
  };

  // 清空網格並放置預設障礙物
  for (let x = 0; x < gameState.COLS; x++) for (let y = 0; y < gameState.ROWS; y++) gameState.grid[x][y] = 0;
  for (const obs of gameState.currentMap.obstacles) {
    if (obs.x >= 0 && obs.x < gameState.COLS && obs.y >= 0 && obs.y < gameState.ROWS) {
      gameState.grid[obs.x][obs.y] = 2; // 2 代表天然地形障礙物
    }
  }

  // 初始化星空背景與天氣粒子
  initBgStars();
  gameState.weatherParticles = [];
  gameState.lightningActive = 0;
  gameState.currentTheme = (getDomRefs().selectTheme.value as ThemeId) || 'chinese';
  gameState.currentWeather = (getDomRefs().selectWeather.value as WeatherId) || 'none';

  // 動態生成砲台按鈕
  if (gameState.buildTowerButtons) {
    gameState.buildTowerButtons();
  }
  gameState.selectedTool = 'earth';
  if (gameState.refreshToolSelection) {
    gameState.refreshToolSelection();
  }
  updateUI();

  // 啟動遊戲迴圈
  if (gameState.animFrameId) cancelAnimationFrame(gameState.animFrameId);
  recalculatePathTiles(gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.cachedPathTiles, gameState.cachedFullPath);
  
  // 註冊關閉遊戲暫停
  grantStartBonus();

  // 套用 Ascension 難度修正
  applyAscensionModifiers(gameState.ascensionLevel);

  // 呼叫註冊的 gameLoop
  if ((gameState as any).gameLoop) {
    (gameState as any).gameLoop();
  }
}

export function spawnWave(waveNum: number) {
  gameState.waveTicks = 0; // P2 reset wave tick timer
  const configs = getWaveConfig(waveNum);

  // P2: 機制學習 — 首次遭遇詞條時記錄
  if (gameState.currentMap.id !== 'test_level') {
    for (const cfg of configs) {
      if (cfg.armor && markTraitSeen(gameState.talentData, 'armor')) {
        showFloat(640, 200, '🛡️ 首次遭遇【裝甲】怪！卡牌池解鎖對抗卡', '#94a3b8', 14);
      }
      if (cfg.regen && markTraitSeen(gameState.talentData, 'regen')) {
        showFloat(640, 220, '🩹 首次遭遇【再生】怪！卡牌池解鎖對抗卡', '#94a3b8', 14);
      }
      if (cfg.split && markTraitSeen(gameState.talentData, 'split')) {
        showFloat(640, 240, '🌀 首次遭遇【分裂】怪！卡牌池解鎖對抗卡', '#94a3b8', 14);
      }
    }
  }
  gameState.waveTotal = 0;
  gameState.waveSpawned = 0;

  for (const cfg of configs) gameState.waveTotal += cfg.count;

  for (const cfg of configs) {
    let spawned = 0;
    const timer = setInterval(() => {
      if (spawned >= cfg.count) { clearInterval(timer); return; }
      const def = ENEMY_DEFS[cfg.enemyType];
      const startPos = { ...gameState.SPAWN_POINT };
      const path = astarFind(startPos, gameState.WAYPOINTS[0], gameState.grid, gameState.COLS, gameState.ROWS, def.isFlying);
      const isStuck = !path;
      const ahp = gameState.ascensionHpMult;
      const aspd = gameState.ascensionSpeedMult;
      // P1 耦合調整：天賦感知 HP 修正因子（花費天賦點越多，怪物 HP 越高，最多 +50%）
      const talentMod = 1.0 + getTalentDifficultyMod(gameState.talentData);
      gameState.enemies.push({
        id: gameState.nextEnemyId++,
        type: cfg.enemyType,
        element: def.element,
        x: startPos.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2,
        y: startPos.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2,
        currentGridX: startPos.x, currentGridY: startPos.y,
        hp: Math.floor(def.baseHp * cfg.hpMultiplier * ahp * talentMod),
        maxHp: Math.floor(def.baseHp * cfg.hpMultiplier * ahp * talentMod),
        speed: def.speed * aspd,
        baseSpeed: def.speed * aspd,
        goldAward: def.goldAward,
        isFlying: def.isFlying,
        waypointIndex: 0,
        path: path ?? [], pathIndex: 0,
        slowDuration: 0,
        dotDamage: 0, dotDuration: 0,
        hitFlashFrame: 0,
        vx: 0,
        vy: 0,
        squashX: 1,
        squashY: 1,
        hitRadius: getEnemyCollisionRadius(cfg.enemyType, gameState.TILE_SIZE),
        isStuck,
        pathBlockedHintShown: isStuck,
        armor: cfg.armor,
        regen: cfg.regen,
        split: cfg.split,
        hasSplit: false
      });
      if (isStuck) {
        showFloat(startPos.x * gameState.TILE_SIZE + 8, startPos.y * gameState.TILE_SIZE, '道路被封死！', '#ef4444', 15);
      }
      spawned++;
      gameState.waveSpawned++;
    }, cfg.spawnIntervalMs);
    gameState.spawnTimers.push(timer);
  }
}

export function spawnTestEnemy(enemyType: EnemyTypeId) {
  const def = ENEMY_DEFS[enemyType];
  if (!def) return;
  const startPos = { ...gameState.SPAWN_POINT };
  const path = astarFind(startPos, gameState.WAYPOINTS[0], gameState.grid, gameState.COLS, gameState.ROWS, def.isFlying);
  if (!path) {
    showFloat(startPos.x * gameState.TILE_SIZE + 8, startPos.y * gameState.TILE_SIZE, '起點路徑被堵死！', '#ef4444', 15);
    return;
  }

  // 強度計算：基於當前波次（如果波次為 0 則預設為 1）
  const curWave = gameState.wave || 1;
  const configs = getWaveConfig(curWave);
  const hpMult = configs[0] ? configs[0].hpMultiplier : 1.0;

  gameState.enemies.push({
    id: gameState.nextEnemyId++,
    type: enemyType,
    element: def.element,
    x: startPos.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2,
    y: startPos.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2,
    currentGridX: startPos.x, currentGridY: startPos.y,
    hp: Math.floor(def.baseHp * hpMult),
    maxHp: Math.floor(def.baseHp * hpMult),
    speed: def.speed,
    baseSpeed: def.speed,
    goldAward: def.goldAward,
    isFlying: def.isFlying,
    waypointIndex: 0,
    path, pathIndex: 0,
    slowDuration: 0,
    dotDamage: 0, dotDuration: 0,
    hitFlashFrame: 0,
    vx: 0,
    vy: 0,
    squashX: 1,
    squashY: 1,
    hitRadius: getEnemyCollisionRadius(enemyType, gameState.TILE_SIZE)
  });

  updateUI();
  showFloat(startPos.x * gameState.TILE_SIZE + 8, startPos.y * gameState.TILE_SIZE, `Spawned ${def.name}!`, '#8b5cf6', 14);
}

export function endBattle(isVictory: boolean) {
  if (gameState.animFrameId) { cancelAnimationFrame(gameState.animFrameId); gameState.animFrameId = null; }
  gameState.spawnTimers.forEach(t => clearInterval(t));
  gameState.spawnTimers = [];

  let earned = gameState.currentMap.id === 'test_level' ? 0 : calcTalentPointsEarned(gameState.wave);
  if (gameState.currentMap.id !== 'test_level') {
    if (!gameState.talentData.hasPlayedBefore) {
      // 確保首次遊玩獲得的天賦點數至少為 2 點，以解鎖第一個天賦「初始資金 I」(cost 2)
      earned = Math.max(2, earned);
      // 提前標記為已遊玩過，避免玩家透過结算頁直接再玩一次死循環觸發天賦引導
      gameState.talentData.hasPlayedBefore = true;
      saveTalentData(gameState.talentData); // 確保 hasPlayedBefore 持久化
      // talentTutorialActive 保持 true 引導玩家到天賦頁
      gameState.talentTutorialActive = true;
    }
    addTalentPoints(gameState.talentData, earned); // 內含 saveTalentData
  }

  const titleEl = document.getElementById('gameoverTitle')!;
  titleEl.textContent = isVictory ? '🎉 防禦成功！' : '💀 防禦失敗';
  titleEl.className = `gameover-title ${isVictory ? 'victory' : 'defeat'}`;

  document.getElementById('goWaveVal')!.textContent = gameState.wave.toString();
  document.getElementById('goKillVal')!.textContent = gameState.killCount.toString();
  document.getElementById('goTalentVal')!.textContent = `+${earned}`;
  document.getElementById('goDamageVal')!.textContent = gameState.totalDamageDealt.toLocaleString();
  document.getElementById('goStreakVal')!.textContent = gameState.maxKillStreak.toString();

  const goDpsStats = document.getElementById('goDpsStats');
  if (goDpsStats) {
    if (gameState.towers.length === 0) {
      goDpsStats.innerHTML = '<div style="color: var(--text-muted); font-style: italic; text-align: center; font-size: 0.78rem;">本局未建造任何防禦塔</div>';
    } else {
      const durationSec = Math.max(1, gameState.waveTicks / 60);
      const sortedTowers = [...gameState.towers]
        .filter(t => !t.def.isWall) // 排除長牆
        .sort((a, b) => (b.damageDealt || 0) - (a.damageDealt || 0));
        
      const top3 = sortedTowers.slice(0, 3);
      let html = '<div style="font-weight: bold; color: var(--gold); margin-bottom: 6px; text-align: center; font-size: 0.8rem;">⚔️ MVP 防禦塔輸出統計 (Top 3)</div>';
      
      html += top3.map((t, idx) => {
        const dps = Math.round((t.damageDealt || 0) / durationSec);
        const icon = idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉';
        return `<div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #334155; padding: 4px 0; font-size: 0.72rem;">
          <span>${icon} ${t.def.name} (${t.x}, ${t.y})</span>
          <span style="color: var(--accent); font-weight: bold;">${t.damageDealt || 0} dmg (DPS: ${dps})</span>
        </div>`;
      }).join('');
      
      goDpsStats.innerHTML = html;
    }
  }

  if (gameState.switchScene) {
    gameState.switchScene('GAME_OVER');
  }
}

export function checkWaveEnd() {
  if (gameState.enemies.length === 0 && gameState.isWaveActive) {
    gameState.isWaveActive = false;
    gameState.currentKillStreak = 0; // 波次間重置連殺計數
    showFloat(640, 320, '波次防禦成功！', '#10b981');
    
    // P3 低血量補償：HP < 50% 額外獲得 5g (測試關除外)
    const maxHP = getBaseHP(gameState.talentData);
    if (gameState.currentMap.id !== 'test_level' && gameState.hp < maxHP * 0.5) {
      gameState.gold += 5;
      showFloat(640, 280, '低血量補償 +5g！', '#fbbf24');
    }
    
    // P2 耦合調整：波次獎勵金動態衰減——抵消後期金幣過剩
    // 公式：15 + wave*3 - floor(wave/3)*4，確保 Wave 20 從 75g 降至 51g
    const waveBonus = Math.max(10, 15 + gameState.wave * 3 - Math.floor(gameState.wave / 3) * 4);
    gameState.gold += waveBonus;
    updateUI();
    // 達到最大波次則勝利 (測試關坅除外)
    const maxWaves = gameState.currentMap.id === 'tutorial' ? 5 : MAX_WAVES;
    if (gameState.currentMap.id !== 'test_level' && gameState.wave >= maxWaves) {
      setTimeout(() => endBattle(true), 1500);
    } else {
        // 教學關在合成後（第 2 波）只展示一次隨機技能，讓首局重心
        // 從繞路轉向「合成 + 波間選擇」；其餘教學波不額外打斷節奏。
        const isTutorialSkillMoment = gameState.currentMap.id === 'tutorial'
          && gameState.wave === 2
          && gameState.levelTutorialStep === 'idle';
        const isNormalBattle = gameState.currentMap.id !== 'test_level' && gameState.currentMap.id !== 'tutorial';
        if ((isNormalBattle || isTutorialSkillMoment) && gameState.wave > 0) {
          // 波次 Buff 衰減處理
          tickWaveBuffs();
          // 延遲 800ms 再彈出卡牌（讓玩家先看到結束浮字）
          if (isTutorialSkillMoment) {
            showFloat(640, 280, '✨ 第二波防禦成功！選一張隨機術法，強化下一輪。', '#a78bfa', 16);
          }
          setTimeout(() => showCardPicker(), 800);
        }
      // 教學關第一波防禦成功觸發合成引導並免費生成第二座烈焰塔
      if (gameState.currentMap.id === 'tutorial' && gameState.wave === 1 && gameState.levelTutorialStep === 'wave_1_active') {
        const firstTower = gameState.towers.find(t => t.typeId === 'fire');
        if (firstTower) {
          // 尋找相鄰空地放第二座烈焰塔
          const dx = [1, -1, 0, 0];
          const dy = [0, 0, 1, -1];
          let nx = firstTower.x + 1;
          let ny = firstTower.y;
          for (let i = 0; i < 4; i++) {
            const tx = firstTower.x + dx[i];
            const ty = firstTower.y + dy[i];
            if (tx >= 0 && tx < gameState.COLS && ty >= 0 && ty < gameState.ROWS) {
              const hasTower = gameState.towers.some(t => t.x === tx && t.y === ty);
              const isObstacle = gameState.grid[tx]?.[ty] === 2;
              if (!hasTower && !isObstacle) {
                nx = tx;
                ny = ty;
                break;
              }
            }
          }
          const def = BASE_TOWERS['fire'];
          gameState.towers.push({
            id: gameState.nextTowerId++,
            x: nx,
            y: ny,
            typeId: 'fire',
            def: { ...def },
            cooldown: 0,
            recoilY: 0,
            damageDealt: 0
          });
          gameState.grid[nx][ny] = 1;
          
          // 更新路徑
          updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.cachedPathTiles, gameState.cachedFullPath);
        }
        gameState.levelTutorialStep = 'merge_guide';
        updateUI();
        setTimeout(() => showFloat(640, 280, '🎉 第一波防禦成功！現在為您放置第二座烈焰塔，準備合成！', '#10b981', 16), 300);
      }

      // 第三波後先明確預告空中敵人，第四波後再銜接 Boss。
      if (gameState.currentMap.id === 'tutorial' && gameState.wave === 3) {
        gameState.levelTutorialStep = 'wave_4_guide';
        updateUI();
      } else if (gameState.currentMap.id === 'tutorial' && gameState.wave === 4) {
        gameState.levelTutorialStep = 'wave_5_guide';
        updateUI();
      }

      // 禁止超過最大波次 (測試關坅除外，可以無限挑戰)
      getDomRefs().btnStartWave.disabled = gameState.currentMap.id !== 'test_level' && gameState.wave >= maxWaves;
    }
  }
}

let benchmarkBackup: {
  towers: any[];
  enemies: any[];
  bullets: any[];
  grid: number[][];
  gold: number;
  hp: number;
  wave: number;
  isWaveActive: boolean;
  currentWeather: any;
} | null = null;

export function startPerformanceBenchmark() {
  if (gameState.currentScene !== 'BATTLE') {
    alert('請先進入戰鬥場景再執行效能測試！');
    return;
  }
  if (gameState.isBenchmarking) return;

  // 1. 備份資料 (深拷貝以防參照修改)
  benchmarkBackup = {
    towers: JSON.parse(JSON.stringify(gameState.towers)),
    enemies: JSON.parse(JSON.stringify(gameState.enemies)),
    bullets: JSON.parse(JSON.stringify(gameState.bullets)),
    grid: gameState.grid.map(row => [...row]),
    gold: gameState.gold,
    hp: gameState.hp,
    wave: gameState.wave,
    isWaveActive: gameState.isWaveActive,
    currentWeather: gameState.currentWeather
  };

  // 2. 清空現狀
  gameState.enemies = [];
  gameState.bullets = [];
  gameState.towers = [];
  gameState.particles = [];
  gameState.floatingTexts = [];
  
  // 清空地圖防禦塔，只保留天然障礙物 2
  for (let x = 0; x < gameState.COLS; x++) {
    for (let y = 0; y < gameState.ROWS; y++) {
      if (gameState.grid[x][y] === 1) {
        gameState.grid[x][y] = 0;
      }
    }
  }

  // 3. 隨機建塔（挑選 30 個合法格子）
  const validSpots: {x: number, y: number}[] = [];
  for (let x = 0; x < gameState.COLS; x++) {
    for (let y = 0; y < gameState.ROWS; y++) {
      const isStartEndOrWp = (x === gameState.SPAWN_POINT.x && y === gameState.SPAWN_POINT.y) ||
                             (x === gameState.BASE_POINT.x && y === gameState.BASE_POINT.y) ||
                             gameState.WAYPOINTS.some(wp => wp.x === x && wp.y === y);
      // 不能是起點、終點、途經點、天然障礙物 (2) 或者是玩家路徑格
      if (gameState.grid[x][y] === 0 && !gameState.cachedPathTiles.has(`${x},${y}`) && !isStartEndOrWp) {
        validSpots.push({ x, y });
      }
    }
  }

  // 隨機洗牌
  for (let i = validSpots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [validSpots[i], validSpots[j]] = [validSpots[j], validSpots[i]];
  }

  // 取前 30 個空格放塔，且這些塔必須包含有攻擊能力的塔，以便產生大量子彈
  const candidateTowers: TowerDef[] = [
    ...Object.values(BASE_TOWERS).filter(t => t.damage > 0),
    ...Object.values(LV2_TOWERS).filter(t => t.damage > 0),
    ...Object.values(RECIPE_TOWERS).filter(t => t.damage > 0)
  ];

  const towersToPlace = Math.min(30, validSpots.length);
  for (let i = 0; i < towersToPlace; i++) {
    const spot = validSpots[i];
    const randDef = candidateTowers[Math.floor(Math.random() * candidateTowers.length)];
    gameState.grid[spot.x][spot.y] = randDef.isWall ? 1 : 0;
    gameState.towers.push({
      id: gameState.nextTowerId++,
      x: spot.x,
      y: spot.y,
      typeId: randDef.id,
      def: { ...randDef },
      cooldown: 0,
      recoilY: 0,
      damageDealt: 0
    });
  }

  // 4. 強制天氣暴雷
  gameState.currentWeather = 'thunder';
  
  // 5. 初始化測試統計狀態
  gameState.benchFrames = [];
  gameState.benchDrawCalls = [];
  gameState.benchStartTime = performance.now();
  gameState.isBenchmarking = true;
  gameState.isWaveActive = true; // 保持 wave 處於活躍以觸發某些更新

  showFloat(gameState.COLS * gameState.TILE_SIZE / 2, gameState.ROWS * gameState.TILE_SIZE / 2, '🔥 效能壓測開始 (10秒)...', '#f59e0b', 18);
  updateUI();
}

export function endPerformanceBenchmark() {
  if (!gameState.isBenchmarking) return;
  gameState.isBenchmarking = false;

  // 1. 計算數據
  const frames = gameState.benchFrames;
  const drawCalls = gameState.benchDrawCalls;
  const frameCount = frames.length;

  let avgFps = 0;
  let avgLatency = 0;
  let maxLatency = 0;
  let avgDrawCalls = 0;

  if (frameCount > 0) {
    const totalLatency = frames.reduce((a, b) => a + b, 0);
    avgLatency = totalLatency / frameCount;
    maxLatency = Math.max(...frames);

    const totalDrawCalls = drawCalls.reduce((a, b) => a + b, 0);
    avgDrawCalls = totalDrawCalls / frameCount;

    const totalTimeMs = performance.now() - gameState.benchStartTime;
    avgFps = frameCount / (totalTimeMs / 1000);
  }

  // 印出精美的 Console 報告
  console.group('%c📊 Wuxing Maze TD — Performance Benchmark Report', 'color: #ea580c; font-weight: bold; font-size: 1.25rem;');
  console.table({
    '測試時長 (s)': 10,
    '總渲染幀數': frameCount,
    '平均 FPS': avgFps.toFixed(1),
    '平均單幀渲染耗時 (ms)': avgLatency.toFixed(2),
    '最大單幀渲染耗時 (ms)': maxLatency.toFixed(2),
    '平均每幀繪製次數': Math.round(avgDrawCalls)
  });
  console.log('%c完整每幀延遲數據 (ms):', 'color: #38bdf8;', frames);
  console.groupEnd();

  // 彈出報告
  alert(
    `📊 效能基準測試報告\n` +
    `---------------------------------------\n` +
    `平均 FPS: ${avgFps.toFixed(1)}\n` +
    `總渲染幀數: ${frameCount}\n` +
    `平均渲染耗時: ${avgLatency.toFixed(2)} ms\n` +
    `最大渲染耗時: ${maxLatency.toFixed(2)} ms\n` +
    `平均每幀繪製次數: ${Math.round(avgDrawCalls)}\n\n` +
    `詳細數據已輸出至瀏覽器 Console 控制台。`
  );

  // 2. 還原現場
  if (benchmarkBackup) {
    gameState.towers = benchmarkBackup.towers;
    gameState.enemies = benchmarkBackup.enemies;
    gameState.bullets = benchmarkBackup.bullets;
    gameState.grid = benchmarkBackup.grid;
    gameState.gold = benchmarkBackup.gold;
    gameState.hp = benchmarkBackup.hp;
    gameState.wave = benchmarkBackup.wave;
    gameState.isWaveActive = benchmarkBackup.isWaveActive;
    gameState.currentWeather = benchmarkBackup.currentWeather;
    benchmarkBackup = null;
  }

  // 重置天氣粒子與特效
  gameState.weatherParticles = [];
  gameState.particles = [];
  gameState.floatingTexts = [];
  
  updateUI();
  showFloat(gameState.COLS * gameState.TILE_SIZE / 2, gameState.ROWS * gameState.TILE_SIZE / 2, '⚡ 壓測結束，已還原原遊戲現場', '#10b981', 16);
}

// 註冊 callback 到 gameState
gameState.startBattle = startBattle;
gameState.spawnWave = spawnWave;
gameState.spawnTestEnemy = spawnTestEnemy;
gameState.startPerformanceBenchmark = startPerformanceBenchmark;
gameState.endPerformanceBenchmark = endPerformanceBenchmark;
gameState.endBattle = endBattle;
