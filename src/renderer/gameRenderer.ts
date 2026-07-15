// src/renderer/gameRenderer.ts — 遊戲核心 Canvas 渲染

import { gameState } from '../state';
import { getDomRefs } from '../domRefs';
import { drawTowerSprite, drawEnemySprite, preloadImage, spriteCache } from '../sprites';
import { drawRoutePreview } from './drawRoutePreview';
import { getTileCacheCanvas } from './tileCache';
import { BASE_TOWERS, getTowerDef, getSameMergeResult, getCrossRecipeResult, ELEMENT_COUNTER, RECIPE_TOWERS, LV2_TOWERS, TowerTypeId } from '../towers';
import { hexToRgba, getElementAccent } from '../theme';
import { getEnemyVisualScale } from '../enemies';

function getBulletSprite(element: string, type: 'core' | 'trail', r: number, scale: number): HTMLCanvasElement {
  const key = `bullet_${type}_${element}_${r.toFixed(2)}_${scale.toFixed(2)}`;
  let cached = spriteCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const blurLimit = type === 'core' ? 15 * scale : 6 * scale;
  const padding = blurLimit + 2;
  const size = Math.ceil((r * scale + padding) * 2);
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = size / 2;
  const cy = size / 2;

  const bulletThemes: Record<string, { core: string; mid: string; glow: string; trail: string; r: number }> = {
    fire: { core: '#fef08a', mid: '#f97316', glow: '#ef4444', trail: '#7f1c1d', r: 5 },
    water: { core: '#ffffff', mid: '#60a5fa', glow: '#2563eb', trail: '#1e3a8a', r: 4 },
    wood: { core: '#a7f3d0', mid: '#22c55e', glow: '#166534', trail: '#052e16', r: 4 },
    metal: { core: '#ffffff', mid: '#cbd5e1', glow: '#94a3b8', trail: '#475569', r: 5 },
    yin: { core: '#ffffff', mid: '#d8b4fe', glow: '#a855f7', trail: '#3b0764', r: 4 },
    yang: { core: '#ffffff', mid: '#fef08a', glow: '#fbbf24', trail: '#854d0e', r: 5 },
    earth: { core: '#fef08a', mid: '#f59e0b', glow: '#d97706', trail: '#78350f', r: 5 }
  };
  const theme = bulletThemes[element] || bulletThemes.fire;

  ctx.save();
  if (type === 'core') {
    ctx.shadowBlur = 15 * scale;
    ctx.shadowColor = theme.glow;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * scale);
    g.addColorStop(0, theme.core);
    g.addColorStop(0.5, theme.mid);
    g.addColorStop(1, theme.glow);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.shadowBlur = 6 * scale;
    ctx.shadowColor = theme.glow;
    ctx.fillStyle = theme.trail;
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  spriteCache.set(key, canvas);
  return canvas;
}

function getParticleSprite(color: string, size: number, scale: number): HTMLCanvasElement {
  const key = `particle_${color}_${size.toFixed(2)}_${scale.toFixed(2)}`;
  let cached = spriteCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const r = size;
  const padding = 4 * scale + 2;
  const canvasSize = Math.ceil((r + padding) * 2);
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  ctx.save();
  ctx.shadowBlur = 4 * scale;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  spriteCache.set(key, canvas);
  return canvas;
}

export function renderGame() {
  const ctx = getDomRefs().ctx;
  const renderStart = performance.now();
  gameState.drawCallCount = 0;
  let bgFillStyle = '#A9C978';
  
  if (gameState.currentTheme === 'chinese') {
    bgFillStyle = '#A9C978';
  } else if (gameState.currentTheme === 'ink') {
    bgFillStyle = '#f8fafc';
  } else if (gameState.currentTheme === 'starry') {
    bgFillStyle = '#0E1117';
  }
  
  ctx.fillStyle = bgFillStyle;
  ctx.fillRect(0, 0, getDomRefs().canvas.width, getDomRefs().canvas.height);

  ctx.save();
  let shakeX = 0;
  let shakeY = 0;
  if (gameState.shakeIntensity > 0) {
    shakeX = (Math.random() - 0.5) * gameState.shakeIntensity;
    shakeY = (Math.random() - 0.5) * gameState.shakeIntensity;
    gameState.shakeIntensity -= gameState.shakeDecay;
    if (gameState.shakeIntensity < 0) gameState.shakeIntensity = 0;
  }
  ctx.translate(gameState.mapOffsetX + shakeX, gameState.mapOffsetY + shakeY);
  ctx.scale(gameState.mapScale, gameState.mapScale);

  // 1 & 3. 繪製預渲染地圖瓦片與靜態網格線
  const tileCache = getTileCacheCanvas();
  ctx.drawImage(tileCache, 0, 0);
  gameState.drawCallCount++;

  // 2. 繪製璀璨星空的背景星星 (疊加在星空地板上，微微閃爍)
  if (gameState.currentTheme === 'starry') {
    for (const star of gameState.bgStars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
      gameState.drawCallCount++;
    }
  }

  // 4. 繪製常駐的半透明怪物行進路線與方向辨識
  if (gameState.currentScene === 'BATTLE' && gameState.cachedFullPath.length > 0) {
    const routeScale = gameState.TILE_SIZE / 16;
    ctx.save();
    ctx.lineWidth = 1.5 * routeScale;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)'; // 非常低調的 25% 透明金黃色
    ctx.shadowBlur = 3 * routeScale;
    ctx.shadowColor = '#f59e0b';

    ctx.beginPath();
    const startX = gameState.cachedFullPath[0].x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
    const startY = gameState.cachedFullPath[0].y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
    ctx.moveTo(startX, startY);

    for (let i = 1; i < gameState.cachedFullPath.length; i++) {
      const tx = gameState.cachedFullPath[i].x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const ty = gameState.cachedFullPath[i].y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      ctx.lineTo(tx, ty);
    }
    ctx.stroke();

    // 繪製微型流動虛線
    ctx.lineWidth = 1.0 * routeScale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; // 半透明白色
    ctx.setLineDash([4 * routeScale, 10 * routeScale]);
    ctx.lineDashOffset = -(Date.now() / 25) * routeScale; // 移動速度慢一點，比較低調
    ctx.stroke();

    // 繪製常駐的方向箭頭
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = 2 * routeScale;
    ctx.shadowColor = '#fbbf24';

    const arrowSpacing = 64 * routeScale; // 間距大一點，更加清爽
    const arrowSize = 2.5 * routeScale; // 箭頭小一點，不遮擋防禦塔
    const animOffset = (Date.now() / 25) % arrowSpacing;

    for (let i = 0; i < gameState.cachedFullPath.length - 1; i++) {
      const x1 = gameState.cachedFullPath[i].x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const y1 = gameState.cachedFullPath[i].y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const x2 = gameState.cachedFullPath[i+1].x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const y2 = gameState.cachedFullPath[i+1].y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      const ux = dx / len;
      const uy = dy / len;

      let dist = animOffset;
      while (dist < len) {
        const ax = x1 + ux * dist;
        const ay = y1 + uy * dist;

        ctx.beginPath();
        ctx.moveTo(ax + ux * arrowSize * 1.5, ay + uy * arrowSize * 1.5);
        ctx.lineTo(ax - ux * arrowSize + uy * arrowSize * 0.8, ay - uy * arrowSize - ux * arrowSize * 0.8);
        ctx.lineTo(ax - ux * arrowSize - uy * arrowSize * 0.8, ay - uy * arrowSize + ux * arrowSize * 0.8);
        ctx.closePath();
        ctx.fill();

        dist += arrowSpacing;
      }
    }
    ctx.restore();
  }

  // 地圖預設障礙物已與地磚一起預渲染至 tile cache，避免逐幀掃描整張網格。

  // 在教學關卡繪製推薦建造位置的高亮提示
  if (gameState.currentMap && gameState.currentMap.id === 'tutorial') {
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    const rx = 48 * gameState.TILE_SIZE;
    const ry = 22 * gameState.TILE_SIZE;
    ctx.strokeRect(rx, ry, gameState.TILE_SIZE, gameState.TILE_SIZE);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('💡 推薦建造點', rx - 18, ry - 4);
    ctx.restore();
  }

  // 起點 / 終點
  let spawnColor = '#22c55e';
  let baseColor = '#ef4444';
  if (gameState.currentTheme === 'chinese') {
    spawnColor = '#fbbf24'; // 帝王金起點
    baseColor = '#dc2626'; // 宮殿紅終點
  } else if (gameState.currentTheme === 'ink') {
    spawnColor = '#475569'; // 墨灰起點
    baseColor = '#0f172a'; // 濃墨終點
  } else if (gameState.currentTheme === 'starry') {
    spawnColor = '#06b6d4'; // 青色星雲
    baseColor = '#ec4899'; // 粉色超新星
  }

  ctx.fillStyle = spawnColor;
  ctx.fillRect(gameState.SPAWN_POINT.x * gameState.TILE_SIZE, gameState.SPAWN_POINT.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);
  ctx.fillStyle = baseColor;
  ctx.fillRect(gameState.BASE_POINT.x * gameState.TILE_SIZE, gameState.BASE_POINT.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);

  // 檢查點
  gameState.WAYPOINTS.forEach((wp, idx) => {
    const wpScale = gameState.TILE_SIZE / 16;
    const cx = wp.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
    const cy = wp.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
    const pulse = 0.86 + Math.sin(Date.now() / 400 + idx) * 0.10;
    ctx.save();
    // 地面法陣：外光圈、石製分段環與中央編號印記，避免暫代向量圓點感。
    ctx.beginPath();
    ctx.arc(cx, cy, 14 * wpScale * pulse, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 204, 91, 0.18)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 10 * wpScale, 0, Math.PI * 2);
    ctx.fillStyle = '#4A3425';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 8 * wpScale, 0, Math.PI * 2);
    ctx.fillStyle = '#D69D42';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 5.5 * wpScale, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF0B0';
    ctx.fill();
    ctx.fillStyle = '#8B5A2B';
    for (let mark = 0; mark < 4; mark++) {
      const angle = mark * Math.PI / 2 + Math.PI / 4;
      ctx.fillRect(cx + Math.cos(angle) * 9 * wpScale - wpScale, cy + Math.sin(angle) * 9 * wpScale - wpScale, 2 * wpScale, 2 * wpScale);
    }
    ctx.fillStyle = '#3A251B';
    ctx.font = `900 ${Math.round(10 * wpScale)}px ${'"Noto Sans TC", "Microsoft JhengHei", sans-serif'}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((idx + 1).toString(), cx, cy + 0.5 * wpScale);
    ctx.restore();
  });

  // 砲台依底部座標排序。較上方的塔先畫、較下方的塔後畫，形成穩定前後景。
  const renderTowers = [...gameState.towers].sort((a, b) => a.y - b.y || a.x - b.x || a.id - b.id);
  for (const t of renderTowers) {
    // P2: 合成引導金色脈衝光圈
    if (gameState.mergeTutorialState === 'active' && gameState.mergeTutorialTowers.includes(t.id)) {
      ctx.save();
      const time = Date.now() / 200;
      const radius = gameState.TILE_SIZE * 0.8 + Math.sin(time) * 4;
      const centerX = t.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const centerY = t.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5 * (gameState.TILE_SIZE / 16);
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const isEarthWall = t.typeId === 'earth';
    const nearbyTower = !isEarthWall && gameState.towers.some(other =>
      other.id !== t.id && other.typeId !== 'earth' &&
      Math.abs(other.x - t.x) <= 1 && Math.abs(other.y - t.y) <= 1
    );
    // 相鄰塔縮至約 40px 視覺寬度，保留合成功能並留出可辨識的前後景。
    const towerScale = (gameState.TILE_SIZE / 16) * (isEarthWall ? 1 : nearbyTower ? 1.48 : 1.75);
    const towerOverflow = (16 * towerScale - gameState.TILE_SIZE) / 2;
    const wallMask = isEarthWall
      ? (gameState.towers.some(other => other.typeId === 'earth' && other.x === t.x && other.y === t.y - 1) ? 1 : 0)
        | (gameState.towers.some(other => other.typeId === 'earth' && other.x === t.x + 1 && other.y === t.y) ? 2 : 0)
        | (gameState.towers.some(other => other.typeId === 'earth' && other.x === t.x && other.y === t.y + 1) ? 4 : 0)
        | (gameState.towers.some(other => other.typeId === 'earth' && other.x === t.x - 1 && other.y === t.y) ? 8 : 0)
      : 0;
    drawTowerSprite(
      ctx,
      t.typeId,
      t.x * gameState.TILE_SIZE - (isEarthWall ? 0 : towerOverflow),
      t.y * gameState.TILE_SIZE - (isEarthWall ? 0 : towerOverflow * 2),
      towerScale,
      gameState.currentStyle,
      t.cooldown,
      t.def.fireRate,
      t.recoilY,
      wallMask
    );
    gameState.drawCallCount++;

    // 合成模式高亮與幽靈預覽
    if (gameState.mergeMode && gameState.mergeFirstTower) {
      if (gameState.mergeFirstTower.id === t.id) {
        ctx.strokeStyle = '#c084fc'; ctx.lineWidth = 2 * (gameState.TILE_SIZE / 16);
        ctx.strokeRect(t.x * gameState.TILE_SIZE, t.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);
      } else {
        // 判斷是否為相鄰的防禦塔 (曼哈頓距離為 1)
        const dx = Math.abs(t.x - gameState.mergeFirstTower.x);
        const dy = Math.abs(t.y - gameState.mergeFirstTower.y);
        if (dx + dy === 1) {
          const firstType = gameState.mergeFirstTower.typeId;
          const secondType = t.typeId;
          const firstDef = BASE_TOWERS[firstType];
          const secondDef = BASE_TOWERS[secondType];
          
          let resultId: TowerTypeId | null = null;
          if (firstDef && secondDef) {
            if (firstType === secondType) {
              // 同系升級
              resultId = getSameMergeResult(firstDef.element) as TowerTypeId;
            } else {
              // 異系配方
              resultId = getCrossRecipeResult(firstDef.element, secondDef.element) as TowerTypeId;
            }
          }

          if (resultId) {
            // 1. 繪製半透明合成結果塔的幽靈預覽
            ctx.save();
            ctx.globalAlpha = 0.5;
            drawTowerSprite(ctx, resultId, t.x * gameState.TILE_SIZE, t.y * gameState.TILE_SIZE, gameState.TILE_SIZE / 16, gameState.currentStyle, 0, 1, 0);
            ctx.restore();

            // 2. 繪製半透明文字浮標
            ctx.save();
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.strokeStyle = 'rgba(167, 139, 250, 0.85)';
            ctx.lineWidth = 1;
            
            const resultDef = (BASE_TOWERS as any)[resultId] || (LV2_TOWERS as any)[resultId] || (RECIPE_TOWERS as any)[resultId];
            const resultName = resultDef ? resultDef.name : resultId;
            ctx.font = 'bold 9px sans-serif';
            const textWidth = ctx.measureText(resultName).width;
            
            const bx = t.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
            const by = t.y * gameState.TILE_SIZE - 6;
            
            ctx.beginPath();
            ctx.roundRect(bx - textWidth / 2 - 4, by - 9, textWidth + 8, 12, 3);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = '#c084fc';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(resultName, bx, by - 3);
            ctx.restore();
          } else {
            // 3. 無法合成，繪製紅色 X
            ctx.save();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2 * (gameState.TILE_SIZE / 16);
            ctx.beginPath();
            const tx = t.x * gameState.TILE_SIZE;
            const ty = t.y * gameState.TILE_SIZE;
            const sz = gameState.TILE_SIZE;
            ctx.moveTo(tx + 4, ty + 4); ctx.lineTo(tx + sz - 4, ty + sz - 4);
            ctx.moveTo(tx + sz - 4, ty + 4); ctx.lineTo(tx + 4, ty + sz - 4);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }
  }

  // 繪製合成動畫
  drawMergeAnimation(ctx);

  // 教學關卡：build_wall 步驟高亮推薦建塔區域
  if (gameState.currentMap.id === 'tutorial' && gameState.levelTutorialStep === 'build_wall') {
    // 全圖教室只示範一次小幅改道，避免教學被拖曳與長距離繞路打斷。
    const HINT_TILES = [
      { x: 9, y: 3 }, { x: 10, y: 3 }, { x: 11, y: 3 },
    ];
    const ts = gameState.TILE_SIZE;
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 400)); // 脈衝透明度
    ctx.save();
    ctx.setLineDash([3 * (ts / 16), 4 * (ts / 16)]);
    ctx.lineDashOffset = -(Date.now() / 80) % (7 * (ts / 16));
    for (const tile of HINT_TILES) {
      // 過濾已有塔的格子
      const hasTower = gameState.towers.some(t => t.x === tile.x && t.y === tile.y);
      if (hasTower) continue;
      const hasTerrain = gameState.grid[tile.x]?.[tile.y] === 2;
      if (hasTerrain) continue;
      ctx.globalAlpha = pulse * 0.6;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(tile.x * ts, tile.y * ts, ts, ts);
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 1.5 * (ts / 16);
      ctx.strokeRect(tile.x * ts + 1, tile.y * ts + 1, ts - 2, ts - 2);
    }
    ctx.restore();
  }

  // 教學關卡：build_tower 步驟高亮推薦建塔區域
  if (gameState.currentMap.id === 'tutorial' && gameState.levelTutorialStep === 'build_tower') {
    // 先把攻擊塔放在上半段道路旁，讓玩家立即看懂射程與行進線的關係。
    const HINT_TILES = [
      { x: 7, y: 4 }, { x: 8, y: 4 }, { x: 9, y: 4 },
      { x: 10, y: 4 }, { x: 11, y: 4 }
    ];
    const ts = gameState.TILE_SIZE;
    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(Date.now() / 400)); // 脈衝透明度
    ctx.save();
    ctx.setLineDash([3 * (ts / 16), 4 * (ts / 16)]);
    ctx.lineDashOffset = -(Date.now() / 80) % (7 * (ts / 16));
    for (const tile of HINT_TILES) {
      // 過濾已建造防禦塔的格子
      const hasTower = gameState.towers.some(t => t.x === tile.x && t.y === tile.y);
      if (hasTower) continue;
      const hasTerrain = gameState.grid[tile.x]?.[tile.y] === 2;
      if (hasTerrain) continue;
      ctx.globalAlpha = pulse * 0.6;
      ctx.fillStyle = '#ef4444'; // 烈焰塔使用橘紅色高亮
      ctx.fillRect(tile.x * ts, tile.y * ts, ts, ts);
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1.5 * (ts / 16);
      ctx.strokeRect(tile.x * ts + 1, tile.y * ts + 1, ts - 2, ts - 2);
    }
    ctx.restore();
  }

  // 臨時障礙（靈木塔效果）
  for (const tw of gameState.tempWalls) {
    ctx.save();
    const alpha = Math.min(1, tw.lifetime / 60); // 最後 1 秒漸隱
    ctx.globalAlpha = 0.55 * alpha;
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(tw.x * gameState.TILE_SIZE, tw.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1 * (gameState.TILE_SIZE / 16);
    ctx.strokeRect(tw.x * gameState.TILE_SIZE, tw.y * gameState.TILE_SIZE, gameState.TILE_SIZE, gameState.TILE_SIZE);
    gameState.drawCallCount++;
    ctx.restore();
  }

  // 當前起點與終點的克制提示
  const activeElement = gameState.hoveredTowerBtn || (gameState.selectedTower ? gameState.selectedTower.def.element : null) || (gameState.selectedTool !== 'sell' && gameState.selectedTool !== 'earth' && gameState.selectedTool !== 'merge' ? gameState.selectedTool : null);
  const counteredElement = activeElement ? ELEMENT_COUNTER[activeElement] : null;

  // 怪物精靈與克制高亮繪製
  for (const e of gameState.enemies) {
    // 如果被克制，繪製紅色發光脈衝圈
    if (counteredElement && e.element === counteredElement) {
      ctx.save();
      const radius = Math.max(e.hitRadius ?? gameState.TILE_SIZE * 0.35, 10 * (gameState.TILE_SIZE / 16)) + Math.sin(Date.now() / 100) * 3;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
      ctx.lineWidth = 2 * (gameState.TILE_SIZE / 16);
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawEnemySprite(ctx, e.type, e.x, e.y, e.hitFlashFrame, gameState.TILE_SIZE / 16, gameState.currentStyle, e.vx, e.vy, e.squashX, e.squashY);
    gameState.drawCallCount++;
  }

  // 批次繪製所有怪物的血條與狀態 (Batch Rendering)
  if (gameState.enemies.length > 0) {
    const hpScale = gameState.TILE_SIZE / 16;

    // 1. 批次繪製背景條 (#1e293b)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    for (const e of gameState.enemies) {
      const visualScale = getEnemyVisualScale(e.type);
      ctx.rect(e.x - 8 * hpScale * visualScale, e.y - 12 * hpScale * visualScale, 16 * hpScale * visualScale, 3 * hpScale);
    }
    ctx.fill();
    gameState.drawCallCount++;

    // 2. 批次繪製普通未減速血量條 (#10b981)
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    for (const e of gameState.enemies) {
      if (e.slowDuration <= 0) {
        const hpPct = Math.max(0, e.hp / e.maxHp);
        const visualScale = getEnemyVisualScale(e.type);
        ctx.rect(e.x - 8 * hpScale * visualScale, e.y - 12 * hpScale * visualScale, 16 * hpScale * visualScale * hpPct, 3 * hpScale);
      }
    }
    ctx.fill();
    gameState.drawCallCount++;

    // 3. 批次繪製減速血量條 (#06b6d4)
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    for (const e of gameState.enemies) {
      if (e.slowDuration > 0) {
        const hpPct = Math.max(0, e.hp / e.maxHp);
        const visualScale = getEnemyVisualScale(e.type);
        ctx.rect(e.x - 8 * hpScale * visualScale, e.y - 12 * hpScale * visualScale, 16 * hpScale * visualScale * hpPct, 3 * hpScale);
      }
    }
    ctx.fill();
    gameState.drawCallCount++;

    // 4. 批次繪製 DOT 狀態指示條 (#4ade80)
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    for (const e of gameState.enemies) {
      if (e.dotDuration > 0) {
        ctx.rect(e.x - 8 * hpScale, e.y - 9 * hpScale, 16 * hpScale * (e.dotDuration / 60), 1 * hpScale);
      }
    }
    ctx.fill();
    gameState.drawCallCount++;
  }

  // 子彈
  for (const b of gameState.bullets) {
    const bScale = gameState.TILE_SIZE / 16;
    const r = b.element === 'water' || b.element === 'wood' || b.element === 'yin' ? 4 : 5;
    
    // 計算面向目標的追蹤方向以生成拖影
    let ux = 1;
    let uy = 0;
    if (b.targetEnemy) {
      const dx = b.targetEnemy.x - b.x;
      const dy = b.targetEnemy.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        ux = dx / dist;
        uy = dy / dist;
      }
    }
    
    // 1. 繪製多段追蹤拖影
    for (let i = 1; i < 5; i++) {
      const tx = b.x - i * 5 * bScale * ux;
      const ty = b.y - i * 5 * bScale * uy;
      const alpha = (1.0 - i / 5) * 0.65;
      const radius = r * (1.0 - i / 5) + 1.0;
      
      const trailSprite = getBulletSprite(b.element, 'trail', radius, bScale);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.drawImage(trailSprite, tx - trailSprite.width / 2, ty - trailSprite.height / 2);
      ctx.restore();
      gameState.drawCallCount++;
    }
    
    // 2. 繪製發光核心
    const coreSprite = getBulletSprite(b.element, 'core', r, bScale);
    ctx.drawImage(coreSprite, b.x - coreSprite.width / 2, b.y - coreSprite.height / 2);
    gameState.drawCallCount++;
  }

  // 飄字
  for (const ft of gameState.floatingTexts) {
    ctx.save();
    ctx.globalAlpha = ft.alpha;
    const fSize = (ft.fontSize || 11) * (gameState.TILE_SIZE / 16);
    ctx.font = `bold ${fSize}px Outfit, sans-serif`;
    ctx.fillStyle = ft.color;
    ctx.textAlign = 'center';

    let textToDraw = ft.text;
    if (ft.isTypewriter && ft.fullText) {
      const totalLife = 60;
      const elapsed = totalLife - ft.life;
      const charCount = Math.min(ft.fullText.length, Math.floor(elapsed / 2.5));
      textToDraw = ft.fullText.slice(0, charCount);
    }

    ctx.fillText(textToDraw, ft.x, ft.y);
    gameState.drawCallCount++;
    ctx.restore();
  }

  // 粒子特效
  for (const p of gameState.particles) {
    if (p.isRing) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2 * (gameState.TILE_SIZE / 16);
      ctx.shadowBlur = 12 * (gameState.TILE_SIZE / 16);
      ctx.shadowColor = p.color;
      ctx.stroke();
      ctx.restore();
      gameState.drawCallCount++;
    } else if (p.isPixel) {
      // 懷舊硬派像素粒子：繪製正方形，不加發光陰影
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.restore();
      gameState.drawCallCount++;
    } else {
      const pSprite = getParticleSprite(p.color, p.size, gameState.TILE_SIZE / 16);
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(pSprite, p.x - pSprite.width / 2, p.y - pSprite.height / 2);
      ctx.restore();
      gameState.drawCallCount++;
    }
  }

  // === 繪製防禦塔射程與預覽 (Phase 4.7 Tier 1) ===
  if (gameState.currentScene === 'BATTLE') {
    // 1. 建造模式下的預覽射程
    if (gameState.selectedTool && gameState.selectedTool !== 'sell' && gameState.hoverGridX !== null && gameState.hoverGridY !== null) {
      const hx = gameState.hoverGridX;
      const hy = gameState.hoverGridY;
      if (hx >= 0 && hx < gameState.COLS && hy >= 0 && hy < gameState.ROWS) {
        const hasObstacle = gameState.grid[hx][hy] !== 0;
        const hasTower = gameState.towers.some(t => t.x === hx && t.y === hy);
        if (!hasObstacle && !hasTower) {
          const def = getTowerDef(gameState.selectedTool as TowerTypeId);
          if (def) {
            const tx = hx * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
            const ty = hy * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
            const rangePx = def.range * gameState.TILE_SIZE;
            
            const fillColor = hexToRgba(getElementAccent(def.element), 0.12);
            const borderColor = hexToRgba(getElementAccent(def.element), 0.45);

            ctx.save();
            ctx.beginPath();
            ctx.arc(tx, ty, rangePx, 0, Math.PI * 2);
            ctx.fillStyle = fillColor;
            ctx.fill();
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 1.2 * (gameState.TILE_SIZE / 16);
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    // 2. 合成模式下的高亮與雙向射程
    if (gameState.mergeMode && gameState.mergeFirstTower) {
      const tower1 = gameState.mergeFirstTower;
      const t1x = tower1.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const t1y = tower1.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const r1Px = tower1.def.range * gameState.TILE_SIZE;

      // 繪製第一座選取塔的射程圓
      ctx.save();
      ctx.beginPath();
      ctx.arc(t1x, t1y, r1Px, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.6)';
      ctx.lineWidth = 2 * (gameState.TILE_SIZE / 16);
      ctx.stroke();
      ctx.restore();

      // 若滑鼠懸停在另一座可合成的防禦塔上，繪製其射程圓並連線
      if (gameState.hoverGridX !== null && gameState.hoverGridY !== null) {
        const hoverTower = gameState.towers.find(t => t.x === gameState.hoverGridX && t.y === gameState.hoverGridY);
        if (hoverTower && hoverTower.id !== tower1.id) {
          let canMerge = false;
          if (hoverTower.def.element === tower1.def.element && hoverTower.def.level === 1 && tower1.def.level === 1) {
            if (getSameMergeResult(hoverTower.def.element)) canMerge = true;
          } else {
            if (getCrossRecipeResult(tower1.def.element, hoverTower.def.element)) canMerge = true;
          }

          if (canMerge) {
            const t2x = hoverTower.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
            const t2y = hoverTower.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
            const r2Px = hoverTower.def.range * gameState.TILE_SIZE;

            ctx.save();
            // 繪製懸停塔的射程圓
            ctx.beginPath();
            ctx.arc(t2x, t2y, r2Px, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
            ctx.lineWidth = 1.5 * (gameState.TILE_SIZE / 16);
            ctx.setLineDash([4, 4]);
            ctx.stroke();

            // 繪製兩塔連線
            ctx.beginPath();
            ctx.moveTo(t1x, t1y);
            ctx.lineTo(t2x, t2y);
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2 * (gameState.TILE_SIZE / 16);
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#a855f7';
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    }
    // 3. 常規選取或懸停防禦塔射程圓 (非合成模式與非建塔工具時)
    else {
      let towerToShowRange: any = null;
      if (gameState.selectedTower) {
        towerToShowRange = gameState.selectedTower;
      } else if (gameState.hoverGridX !== null && gameState.hoverGridY !== null) {
        const hoverTower = gameState.towers.find(t => t.x === gameState.hoverGridX && t.y === gameState.hoverGridY);
        if (hoverTower) {
          towerToShowRange = hoverTower;
        }
      }

      if (towerToShowRange) {
        const tx = towerToShowRange.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
        const ty = towerToShowRange.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
        const rangePx = towerToShowRange.def.range * gameState.TILE_SIZE;

        ctx.save();
        ctx.beginPath();
        ctx.arc(tx, ty, rangePx, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
        ctx.lineWidth = 1.5 * (gameState.TILE_SIZE / 16);
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  if (gameState.routePreviewTimer > 0) {
    drawRoutePreview(ctx, gameState.cachedPreviewRoute, gameState.TILE_SIZE, gameState.routePreviewTimer);
  }

  ctx.restore(); // 結束地圖相關縮放與平移

  // === 繪製天氣特效 Overlay ===
  if (gameState.currentWeather === 'rain' || gameState.currentWeather === 'thunder') {
    ctx.save();
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)';
    for (const p of gameState.weatherParticles) {
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 1.5, p.y + p.vy * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  } else if (gameState.currentWeather === 'fog') {
    ctx.save();
    for (const p of gameState.weatherParticles) {
      const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      radGrad.addColorStop(0, `rgba(226, 232, 240, ${p.alpha})`);
      radGrad.addColorStop(0.5, `rgba(226, 232, 240, ${p.alpha * 0.5})`);
      radGrad.addColorStop(1, 'rgba(226, 232, 240, 0)');
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 繪製雷電效果
  if (gameState.currentWeather === 'thunder' && gameState.lightningActive > 0) {
    ctx.save();
    if (Math.random() < 0.7) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + Math.random() * 0.25})`;
      ctx.fillRect(0, 0, getDomRefs().canvas.width, getDomRefs().canvas.height);
    }

    ctx.strokeStyle = 'rgba(224, 242, 254, 0.9)';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#e0f2fe';
    ctx.lineWidth = 2.5 + Math.random() * 2;
    
    for (const path of gameState.lightningPaths) {
      if (path.length > 0) {
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
          ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 繪製阻塞警告文字
  if (gameState.routePreviewTimer > 0 && gameState.cachedPreviewRoute.length === 0) {
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ 路線被完全阻塞！無法通往基地', getDomRefs().canvas.width / 2, getDomRefs().canvas.height / 2);
    ctx.restore();
  }

  // 性能監控指標更新
  const latency = performance.now() - renderStart;
  if (gameState.isBenchmarking) {
    gameState.benchFrames.push(latency);
    gameState.benchDrawCalls.push(gameState.drawCallCount);
  }
  gameState.frameCount++;
  const now = performance.now();
  if (now - gameState.lastFpsUpdateTime > 1000) {
    gameState.currentFps = Math.round((gameState.frameCount * 1000) / (now - gameState.lastFpsUpdateTime));
    gameState.frameCount = 0;
    gameState.lastFpsUpdateTime = now;
  }

  if (gameState.isDiagnosticOpen) {
    getDomRefs().diagFps.textContent = gameState.currentFps.toString();
    getDomRefs().diagLatency.textContent = latency.toFixed(1) + ' ms';
    getDomRefs().diagDrawCalls.textContent = gameState.drawCallCount.toString();
    getDomRefs().diagCacheSize.textContent = spriteCache.size.toString();
    getDomRefs().diagMonsters.textContent = gameState.enemies.length.toString();
    getDomRefs().diagTowers.textContent = gameState.towers.length.toString();
    getDomRefs().diagFilterWarning.textContent = '0';
  }
}

export function showFloat(x: number, y: number, text: string, color: string, fontSize?: number, isTypewriter?: boolean) {
  gameState.floatingTexts.push({
    x, y,
    text: isTypewriter ? '' : text,
    color,
    alpha: 1.0,
    life: isTypewriter ? 60 : 45,
    fontSize,
    isTypewriter,
    fullText: text
  });
}

export function initBgStars() {
  gameState.bgStars = [];
  const starCount = 80;
  for (let i = 0; i < starCount; i++) {
    gameState.bgStars.push({
      x: Math.random() * (gameState.COLS * gameState.TILE_SIZE),
      y: Math.random() * (gameState.ROWS * gameState.TILE_SIZE),
      size: 0.5 + Math.random() * 1.5,
      alpha: Math.random(),
      alphaSpeed: 0.005 + Math.random() * 0.015
    });
  }
}

export function loadAllHighResSprites(): void {
  const SPRITE_BASE = 'assets/sprites';
  const imagePreloads: Array<[string, string]> = [
    // --- 怪物 ---
    ['enemy_snake',        `${SPRITE_BASE}/enemies/snake.png`],
    ['enemy_fly',          `${SPRITE_BASE}/enemies/fly.png`],
    ['enemy_salamander',   `${SPRITE_BASE}/enemies/salamander.png`],
    ['enemy_water_spirit', `${SPRITE_BASE}/enemies/water_spirit.png`],
    ['enemy_golem',        `${SPRITE_BASE}/enemies/golem.png`],
    ['enemy_beetle',       `${SPRITE_BASE}/enemies/beetle.png`],
    ['enemy_boss_dragon',  `${SPRITE_BASE}/enemies/boss_dragon.png`],
    // --- 基礎塔 ---
    ['tower_fire',         `${SPRITE_BASE}/towers/fire.png`],
    ['tower_water',        `${SPRITE_BASE}/towers/water.png`],
    ['tower_wood',         `${SPRITE_BASE}/towers/wood.png`],
    ['tower_earth',        `${SPRITE_BASE}/towers/earth.png`],
    ['tower_metal',        `${SPRITE_BASE}/towers/metal.png`],
    ['tower_yin',          `${SPRITE_BASE}/towers/yin.png`],
    ['tower_yang',         `${SPRITE_BASE}/towers/yang.png`],
    // --- 第二輪正式原生像素塔（72×96 來源，透明背景）---
    ['tower_pixel_fire',  `${SPRITE_BASE}/towers-v2/fire-v2.png`],
    ['tower_pixel_water', `${SPRITE_BASE}/towers-v2/water-v2.png`],
    ['tower_pixel_wood',  `${SPRITE_BASE}/towers-v2/wood-v2.png`],
    ['tower_pixel_earth', `${SPRITE_BASE}/towers-v2/earth-v2.png`],
    ['tower_pixel_metal', `${SPRITE_BASE}/towers-v2/metal-v2.png`],
    ['tower_pixel_yin',   `${SPRITE_BASE}/towers-v2/yin-v2.png`],
    ['tower_pixel_yang',  `${SPRITE_BASE}/towers-v2/yang-v2.png`],
    // --- Lv2 塔 ---
    ['tower_fire_2',       `${SPRITE_BASE}/towers_lv2/fire_2.png`],
    ['tower_water_2',      `${SPRITE_BASE}/towers_lv2/water_2.png`],
    ['tower_wood_2',       `${SPRITE_BASE}/towers_lv2/wood_2.png`],
    ['tower_earth_2',      `${SPRITE_BASE}/towers_lv2/earth_2.png`],
    ['tower_metal_2',      `${SPRITE_BASE}/towers_lv2/metal_2.png`],
    ['tower_yin_2',        `${SPRITE_BASE}/towers_lv2/yin_2.png`],
    ['tower_yang_2',       `${SPRITE_BASE}/towers_lv2/yang_2.png`],
    // --- 配方塔 ---
    ['tower_wood_fire',    `${SPRITE_BASE}/towers_recipe/wood_fire.png`],
    ['tower_fire_earth',   `${SPRITE_BASE}/towers_recipe/fire_earth.png`],
    ['tower_earth_metal',  `${SPRITE_BASE}/towers_recipe/earth_metal.png`],
    ['tower_metal_water',  `${SPRITE_BASE}/towers_recipe/metal_water.png`],
    ['tower_water_wood',   `${SPRITE_BASE}/towers_recipe/water_wood.png`],
    ['tower_yin_yang',     `${SPRITE_BASE}/towers_recipe/yin_yang.png`],
  ];
  imagePreloads.forEach(([key, src]) => {
    preloadImage(key, src);
  });
}

export function drawMergeAnimation(ctx: CanvasRenderingContext2D) {
  if (!gameState.mergeAnimation || !gameState.mergeAnimation.active) return;

  const anim = gameState.mergeAnimation;
  const T = gameState.TILE_SIZE;
  const pScale = T / 16;
  const tx = anim.resultX * T + T / 2;
  const ty = anim.resultY * T + T / 2;

  ctx.save();

  if (anim.timer <= 15) {
    // 第一階段：選材預覽與互轉碰撞
    const progress = anim.timer / 15;

    const x1 = anim.t1.x * T + T / 2;
    const y1 = anim.t1.y * T + T / 2;
    const x2 = anim.t2.x * T + T / 2;
    const y2 = anim.t2.y * T + T / 2;

    const curX1 = x1 + (tx - x1) * progress;
    const curY1 = y1 + (ty - y1) * progress;
    const curX2 = x2 + (tx - x2) * progress;
    const curY2 = y2 + (ty - y2) * progress;

    ctx.globalAlpha = 0.7;
    drawTowerSprite(ctx, anim.t1.typeId as any, curX1 - T / 2, curY1 - T / 2, pScale, gameState.currentStyle, 0, 1, 0);
    drawTowerSprite(ctx, anim.t2.typeId as any, curX2 - T / 2, curY2 - T / 2, pScale, gameState.currentStyle, 0, 1, 0);

  } else if (anim.timer <= 30) {
    // 第二階段：碰撞點閃白
    const progress = (anim.timer - 15) / 15;
    const pulse = Math.sin(progress * Math.PI);
    const radius = T * 1.5 * pulse;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(tx, ty, radius, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // 第三階段：新生塔由下往上彈性升起與打字機名稱
    const progress = (anim.timer - 30) / 15;
    const bounce = Math.sin(progress * Math.PI * 1.5) * (1 - progress) * 0.25 + 1;
    const offsetY = (1 - progress) * T * 0.5;

    ctx.save();
    ctx.globalAlpha = progress;
    ctx.translate(tx, ty);
    ctx.scale(bounce, bounce);
    drawTowerSprite(ctx, anim.resultTypeId as any, -T / 2, -T / 2 - offsetY, pScale, gameState.currentStyle, 0, 1, 0);
    ctx.restore();

    const resultDef = getTowerDef(anim.resultTypeId as any);
    if (resultDef) {
      const name = resultDef.name;
      const charCount = Math.floor(name.length * progress * 1.5);
      const dispName = name.slice(0, Math.min(name.length, charCount));

      ctx.font = `bold ${Math.round(11 * pScale)}px 'DotGothic16', sans-serif`;
      ctx.fillStyle = '#c084fc';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 4;
      
      ctx.strokeText(`✨ ${dispName} ✨`, tx, ty - T * 0.8);
      ctx.fillText(`✨ ${dispName} ✨`, tx, ty - T * 0.8);
    }
  }

  ctx.restore();
}
