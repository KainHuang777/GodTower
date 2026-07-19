// src/battle/physics.ts — 戰鬥物理演算與天氣更新

import { gameState } from '../state';
import { getDomRefs } from '../domRefs';
import { getDamageMultiplier, getFireRateMultiplier, getTowerElementDamageMultiplier, getBaseHP } from '../talent';
import { getElementBonus } from '../towers';
import { astarFind, validatePlacement, updateAllEnemyPaths } from './pathfinding';
import { createSplatterParticles, createDeathParticles, updateParticles, createElementalHitParticles } from '../renderer/particles';
import { playSFX } from '../audio/audioSystem';
import { checkWaveEnd, endBattle } from './battleManager';
import { recordKill } from '../collection/state';
import { ENEMY_DEFS, EnemyTypeId, getEnemyCollisionRadius, getWaveConfig } from '../enemies';
import { Point, Enemy } from '../types';

// 引入 UI 與渲染更新
import { updateUI } from '../ui/uiManager';
import { showFloat } from '../renderer/gameRenderer';
import { triggerCounterGlow } from '../ui/wuxingCompass';
import { applyElementResistance } from './p3GateA';

export function updatePhysics() {
  if (gameState.isWaveActive) {
    gameState.waveTicks++;
  }

  if (gameState.isBenchmarking) {
    if (gameState.enemies.length < 50) {
      const enemyTypes: EnemyTypeId[] = ['snake', 'fly', 'salamander', 'water_spirit', 'golem', 'beetle'];
      const startPos = { ...gameState.SPAWN_POINT };
      const path = astarFind(startPos, gameState.WAYPOINTS[0], gameState.grid, gameState.COLS, gameState.ROWS, false);
      if (path) {
        const randType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        const def = ENEMY_DEFS[randType];
        gameState.enemies.push({
          id: gameState.nextEnemyId++,
          type: randType,
          element: def.element,
          x: startPos.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2,
          y: startPos.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2,
          currentGridX: startPos.x,
          currentGridY: startPos.y,
          hp: 999999,
          maxHp: 999999,
          speed: def.speed,
          baseSpeed: def.speed,
          goldAward: 0,
          isFlying: def.isFlying,
          waypointIndex: 0,
          path,
          pathIndex: 0,
          slowDuration: 0,
          dotDamage: 0,
          dotDuration: 0,
          hitFlashFrame: 0,
          vx: 0,
          vy: 0,
          squashX: 1,
          squashY: 1,
          hitRadius: getEnemyCollisionRadius(randType, gameState.TILE_SIZE)
        });
      }
    }

    const duration = performance.now() - gameState.benchStartTime;
    if (duration >= 10000) {
      if (gameState.endPerformanceBenchmark) {
        gameState.endPerformanceBenchmark();
      }
      return;
    }
  }

  const dmgMult = getDamageMultiplier(gameState.talentData);
  const frMult = getFireRateMultiplier(gameState.talentData);

  if (gameState.routePreviewTimer > 0) {
    gameState.routePreviewTimer--;
  }

  // 1. 怪物移動
  for (let i = gameState.enemies.length - 1; i >= 0; i--) {
    const e = gameState.enemies[i];

    // 怪物每秒恢復 1% 生命 (Regen) — Work B Roguelike 卡牌效果
    if (e.hp > 0 && e.regen && e.hp < e.maxHp) {
      if (gameState.roguelikeState.regenLockActive) {
        // 封印再生：永久停止回血
      } else if (gameState.roguelikeState.regenReverseActive) {
        e.hp = Math.max(1, e.hp - e.maxHp * 0.02 / 60);
        if (Math.random() < 0.01) showFloat(e.x, e.y - 10, '毒纏!', '#a855f7');
      } else if ((gameState.roguelikeState.regenBlockDuration ?? 0) > 0) {
        // 灼燒標記：3 秒內仍不觸發
        gameState.roguelikeState.regenBlockDuration =
          (gameState.roguelikeState.regenBlockDuration ?? 0) - 1;
      } else {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.01 / 60);
      }
    }

    // DOT 傷害
    if (e.dotDuration > 0) {
      let dotDmg = e.dotDamage;
      if (gameState.wave >= 6 && e.dotElement) {
        const elBonus = getElementBonus(e.dotElement, e.element, gameState.wave);
        let isCounter = elBonus > 1.0;
        if (e.dotElement === 'yin' && e.element === 'yang') isCounter = true;
        if (e.dotElement === 'yang' && e.element === 'yin') isCounter = true;
        
        dotDmg = applyElementResistance(dotDmg, gameState.wave, isCounter);
      }
      e.hp -= dotDmg;
      gameState.totalDamageDealt += dotDmg;
      if (e.dotSourceTowerId !== undefined) {
        const sourceTower = gameState.towers.find(t => t.id === e.dotSourceTowerId);
        if (sourceTower) {
          sourceTower.damageDealt = (sourceTower.damageDealt || 0) + dotDmg;
        }
      }
      e.dotDuration--;
      if (e.hp <= 0) {
        const goldMult = Math.max(0.4, 1.0 - (gameState.wave - 1) * 0.03);
        const award = Math.max(1, Math.floor(e.goldAward * goldMult));
        gameState.gold += award;
        gameState.killCount++;
        recordKill(gameState.talentData, e.type, e.type === 'boss_dragon');
        gameState.currentKillStreak++;
        if (gameState.currentKillStreak > gameState.maxKillStreak) gameState.maxKillStreak = gameState.currentKillStreak;
        showFloat(e.x, e.y, `+${award}g`, '#f59e0b');
        gameState.enemies.splice(i, 1);
        updateUI();
        checkWaveEnd();
        continue;
      } else if (e.split && e.hp < e.maxHp * 0.3 && !e.hasSplit) {
        if (!gameState.roguelikeState.splitBlockActive) {
          triggerSplit(e);
          continue;
        } else {
          showFloat(e.x, e.y - 10, '🔒 分裂封', '#c084fc', 12);
        }
      }
    }

    // 舊測試資料／熱更新中的敵人可能尚無半徑，依定義自動補齊。
    if (e.hitRadius === undefined) {
      e.hitRadius = getEnemyCollisionRadius(e.type, gameState.TILE_SIZE);
    }

    // 遞減受擊高亮與形變恢復
    if (e.hitFlashFrame > 0) {
      e.hitFlashFrame--;
    }
    if (e.squashX === undefined) { e.squashX = 1; e.squashY = 1; }
    e.squashX += (1 - e.squashX) * 0.15;
    e.squashY += (1 - e.squashY) * 0.15;

    // 減速
    if (e.slowDuration > 0) { e.slowDuration--; e.speed = e.baseSpeed * 0.4; }
    else { e.speed = e.baseSpeed; }

    const prevX = e.x;
    const prevY = e.y;
    if (!e.isStuck && e.path && e.pathIndex < e.path.length) {
      const tg = e.path[e.pathIndex];
      const tx = tg.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const ty = tg.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
      const dx = tx - e.x, dy = ty - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= e.speed) {
        e.x = tx; e.y = ty;
        e.currentGridX = tg.x; e.currentGridY = tg.y;
        e.pathIndex++;

        const curTarget = e.waypointIndex >= gameState.WAYPOINTS.length ? gameState.BASE_POINT : gameState.WAYPOINTS[e.waypointIndex];
        if (e.currentGridX === curTarget.x && e.currentGridY === curTarget.y) {
          e.waypointIndex++;
          if (e.waypointIndex > gameState.WAYPOINTS.length) {
            if (gameState.currentMap.id !== 'test_level') {
              gameState.hp -= 1;
              gameState.shakeIntensity = 8.0;
              gameState.shakeDecay = 0.25;
            }
            gameState.enemies.splice(i, 1);
            updateUI();
            if (gameState.currentMap.id !== 'test_level' && gameState.hp <= 0) { endBattle(false); return; }
            checkWaveEnd();
            continue;
          }
          const next = e.waypointIndex >= gameState.WAYPOINTS.length ? gameState.BASE_POINT : gameState.WAYPOINTS[e.waypointIndex];
          const np = astarFind({ x: e.currentGridX, y: e.currentGridY }, next, gameState.grid, gameState.COLS, gameState.ROWS, e.isFlying);
          if (np) {
            e.path = np; e.pathIndex = 0; e.isStuck = false;
          } else {
            e.isStuck = true;
            if (!e.pathBlockedHintShown) {
              showFloat(e.x, e.y - 16, '道路被封死！', '#ef4444', 14);
              e.pathBlockedHintShown = true;
            }
          }
        }
      } else {
        e.x += (dx / dist) * e.speed;
        e.y += (dy / dist) * e.speed;
      }
    }
    e.vx = e.x - prevX;
    e.vy = e.y - prevY;
  }

  // 2. 砲台射擊
  for (const tower of gameState.towers) {
    if (tower.recoilY === undefined) tower.recoilY = 0;
    tower.recoilY *= 0.82;
    if (tower.recoilY < 0.05) tower.recoilY = 0;

    if (tower.def.damage === 0 && !tower.def.buffAllyDmg) continue;

    // 鍛造塔 buff 效果（被動，不射擊）
    if (tower.def.buffAllyDmg) continue; 

    if (tower.cooldown > 0) { tower.cooldown--; continue; }

    const tx = tower.x * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
    const ty = tower.y * gameState.TILE_SIZE + gameState.TILE_SIZE / 2;
    let best: Enemy | null = null;
    let minDist = Infinity;

    for (const e of gameState.enemies) {
      // Roguelike 全場射程加成
      const effectiveRange = tower.def.range + gameState.roguelikeState.rangeBonusGlobal;
      const d = Math.sqrt((e.x - tx) ** 2 + (e.y - ty) ** 2) / gameState.TILE_SIZE;
      if (d <= effectiveRange && d < minDist) { minDist = d; best = e; }
    }

    if (best) {
      // 計算傷害（含天賦倍率、五行屬性強化、鍛造塔 buff）
      let finalDmg = tower.def.damage * dmgMult * getTowerElementDamageMultiplier(gameState.talentData, tower.def.element);
      
      // Roguelike 元素傷害祝福加成
      const elemBonus = gameState.roguelikeState.elementDmgBonus[tower.def.element] ?? 0;
      if (elemBonus > 0) {
        finalDmg *= (1 + elemBonus);
      }
      
      // 鍛造塔附近 buff 檢查
      for (const bt of gameState.towers) {
        if (!bt.def.buffAllyDmg) continue;
        const bdist = Math.abs(bt.x - tower.x) + Math.abs(bt.y - tower.y);
        if (bdist <= (bt.def.buffAllyRange ?? 2)) {
          finalDmg *= (1 + bt.def.buffAllyDmg);
        }
      }

      gameState.bullets.push({
        x: tx, y: ty,
        targetEnemy: best,
        speed: 6,
        damage: Math.floor(finalDmg),
        element: tower.def.element,
        slowPct: tower.def.slowPct,
        slowDuration: tower.def.slowDuration,
        dotDamage: tower.def.dotDamage,
        dotDuration: tower.def.dotDuration,
        aoeRadius: tower.def.aoeRadius,
        aoeDamagePct: tower.def.aoeDamagePct,
        hpPctDamage: tower.def.hpPctDamage,
        critChance: tower.def.critChance,
        critMultiplier: tower.def.critMultiplier,
        flyingBonus: tower.def.flyingBonus,
        healBase: tower.def.healBase,
        spawnWall: tower.def.spawnWall,
        sourceTowerId: tower.id, // P2 damage credit
        trueDamage: tower.def.trueDamage, // P3 true damage bypass
      });

      playSFX('shoot');

      // 冷卻計算：天賦倍率 × Roguelike 攻速加成減少
      let fireCooldown = Math.floor(tower.def.fireRate * frMult);
      const permBonus = (gameState.roguelikeState as any).permanentAttackSpeedBonus ?? 0;
      if (permBonus > 0) {
        fireCooldown = Math.max(1, fireCooldown - permBonus);
      }
      if (gameState.roguelikeState.attackSpeedBonus > 0 && gameState.roguelikeState.attackSpeedWavesLeft > 0) {
        fireCooldown = Math.max(1, fireCooldown - gameState.roguelikeState.attackSpeedBonus);
      }
      tower.cooldown = fireCooldown;
      tower.recoilY = 4.0;
    }
  }

  // 3. 子彈移動與擊中
  for (let i = gameState.bullets.length - 1; i >= 0; i--) {
    const b = gameState.bullets[i];
    const target = b.targetEnemy;
    const alive = target && target.hp > 0 && gameState.enemies.some(e => e.id === target.id);

    if (!alive) { gameState.bullets.splice(i, 1); continue; }

    const targetX = target.x;
    const targetY = target.y;
    const dx = targetX - b.x, dy = targetY - b.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const targetHitRadius = target.hitRadius ?? getEnemyCollisionRadius(target.type, gameState.TILE_SIZE);
    if (dist <= b.speed + targetHitRadius) {
      // 擊中處理
      let dmg = b.damage;

      // 五行相剋加成
      const bonus = getElementBonus(b.element, b.targetEnemy.element, gameState.wave);
      dmg = Math.floor(dmg * bonus);

      if (bonus > 1.0) {
        const pct = Math.round((bonus - 1.0) * 100);
        showFloat(b.targetEnemy.x, b.targetEnemy.y - 20, `克制 +${pct}%`, '#fbbf24');
        triggerCounterGlow(b.element, b.targetEnemy.element);
      }

      // 暴擊 + Work B Roguelike 破甲卡牌效果
      let isCrit = false;

      // 破甲一擊：對裝甲怪首次命中必暴
      if (gameState.roguelikeState.armorBreakNext && b.targetEnemy.armor) {
        dmg = Math.floor(dmg * (b.critMultiplier ?? 2));
        showFloat(b.targetEnemy.x, b.targetEnemy.y - 14, '破甲暴擊!', '#fde047');
        isCrit = true;
        gameState.roguelikeState.armorBreakNext = false;
      }

      if (!isCrit && b.critChance && Math.random() < b.critChance) {
        dmg = Math.floor(dmg * (b.critMultiplier ?? 2));
        showFloat(b.targetEnemy.x, b.targetEnemy.y - 14, '暴擊!', '#fde047');
        isCrit = true;
      }

      // 五行破甲：對裝甲怪相剋加成
      if (b.targetEnemy.armor && gameState.roguelikeState.counterBonusVsArmor && bonus > 1.0) {
        const extra = Math.floor(dmg * gameState.roguelikeState.counterBonusVsArmor);
        dmg += extra;
        showFloat(b.targetEnemy.x, b.targetEnemy.y - 20, `五行破甲 +${Math.round(gameState.roguelikeState.counterBonusVsArmor * 100)}%`, '#a855f7');
      }

      // 裝甲效果 (Boss -25% 非暴擊傷害) + Work B 無視護甲
      if (b.targetEnemy.armor && !isCrit) {
        if (!gameState.roguelikeState.trueDamageVsArmor) {
          dmg = Math.floor(dmg * 0.75);
        } else {
          showFloat(b.targetEnemy.x, b.targetEnemy.y - 16, '無視護甲!', '#fbbf24');
        }
      }

      // 飛行加成
      if (b.flyingBonus && b.targetEnemy.isFlying) {
        dmg = Math.floor(dmg * (1 + b.flyingBonus));
      }
      
      // P3: 元素抗性衰減
      let isCounter = bonus > 1.0;
      if (b.element === 'yin' && b.targetEnemy.element === 'yang') isCounter = true;
      if (b.element === 'yang' && b.targetEnemy.element === 'yin') isCounter = true;
      
      dmg = applyElementResistance(dmg, gameState.wave, isCounter, Boolean(b.trueDamage));

      // Work B 速攻指令：分裂怪分裂前 +30% 傷害
      if (gameState.roguelikeState.splitBurstActive && b.targetEnemy.split && b.targetEnemy.hp < b.targetEnemy.maxHp * 0.35 && !b.targetEnemy.hasSplit) {
        dmg = Math.floor(dmg * 1.3);
        showFloat(b.targetEnemy.x, b.targetEnemy.y - 8, '速攻!', '#f97316');
      }

      // % 血量傷害
      if (b.hpPctDamage) {
        dmg += Math.floor(b.targetEnemy.maxHp * b.hpPctDamage);
      }

      b.targetEnemy.hp -= dmg;
      gameState.totalDamageDealt += dmg;
      if (b.sourceTowerId !== undefined) {
        const sourceTower = gameState.towers.find(t => t.id === b.sourceTowerId);
        if (sourceTower) {
          sourceTower.damageDealt = (sourceTower.damageDealt || 0) + dmg;
        }
      }
      showFloat(b.targetEnemy.x, b.targetEnemy.y - 10, `-${dmg}`, '#ef4444');

      if (isCrit) {
        gameState.hitStopFrames = 3;
        gameState.shakeIntensity = 3.0;
        gameState.shakeDecay = 0.15;
        playSFX('crit');
      } else {
        const elementSfx: Record<string, string> = {
          fire: 'hit_fire', water: 'hit_water', wood: 'hit_wood',
          metal: 'hit_metal', earth: 'hit_earth', yin: 'hit_yin', yang: 'hit_yang'
        };
        const sfx = (elementSfx[b.element] ?? 'hit') as any;
        playSFX(sfx);
      }
      
      b.targetEnemy.hitFlashFrame = 6;
      b.targetEnemy.squashX = 1.35;
      b.targetEnemy.squashY = 0.65;

      // 觸發分裂檢查
      if (b.targetEnemy.hp > 0 && b.targetEnemy.split && b.targetEnemy.hp < b.targetEnemy.maxHp * 0.3 && !b.targetEnemy.hasSplit) {
        if (!gameState.roguelikeState.splitBlockActive) {
          triggerSplit(b.targetEnemy);
        } else {
          showFloat(b.targetEnemy.x, b.targetEnemy.y - 12, '🔒 制止分裂!', '#c084fc', 12);
        }
      }

      // P3: 產生屬性特定的粒子特效
      const bulletColors: Record<string, string> = {
        fire: '#f97316', water: '#38bdf8', wood: '#4ade80',
        earth: '#d97706', metal: '#e5e7eb', yin: '#a855f7', yang: '#fde047'
      };
      const hitColor = bulletColors[b.element] ?? '#facc15';

      createElementalHitParticles(gameState.particles, gameState.TILE_SIZE, b.targetEnemy.x, b.targetEnemy.y, b.element);
      if (bonus > 1.0) {
        createElementalHitParticles(gameState.particles, gameState.TILE_SIZE, b.targetEnemy.x, b.targetEnemy.y, b.element);
      }

      // 減速效果
      if (b.slowPct && b.slowDuration) {
        b.targetEnemy.slowDuration = Math.max(b.targetEnemy.slowDuration, b.slowDuration);
      }

      // DOT 效果
      if (b.dotDamage && b.dotDuration) {
        b.targetEnemy.dotDamage = b.dotDamage;
        b.targetEnemy.dotDuration = Math.max(b.targetEnemy.dotDuration, b.dotDuration);
        b.targetEnemy.dotSourceTowerId = b.sourceTowerId; // P2 tracking for DOT source
        b.targetEnemy.dotElement = b.element; // P3 tracking for DOT element
      }

      // AOE 傷害
      if (b.aoeRadius && b.aoeDamagePct) {
        const aoeDmg = Math.floor(dmg * b.aoeDamagePct);
        const aoeRange = b.aoeRadius * gameState.TILE_SIZE;
        for (const e of gameState.enemies) {
          if (e.id === b.targetEnemy.id) continue;
          const adist = Math.sqrt((e.x - b.targetEnemy.x) ** 2 + (e.y - b.targetEnemy.y) ** 2);
          if (adist <= aoeRange) {
            e.hp -= aoeDmg;
            gameState.totalDamageDealt += aoeDmg;
            if (b.sourceTowerId !== undefined) {
              const sourceTower = gameState.towers.find(t => t.id === b.sourceTowerId);
              if (sourceTower) {
                sourceTower.damageDealt = (sourceTower.damageDealt || 0) + aoeDmg;
              }
            }
            showFloat(e.x, e.y - 10, `-${aoeDmg}`, '#f97316');
            
            e.hitFlashFrame = 6;
            e.squashX = 1.35;
            e.squashY = 0.65;
            createSplatterParticles(gameState.particles, gameState.TILE_SIZE, e.x, e.y, hitColor, 3);

            // AOE 分裂檢查
            if (e.hp > 0 && e.split && e.hp < e.maxHp * 0.3 && !e.hasSplit) {
              if (!gameState.roguelikeState.splitBlockActive) {
                triggerSplit(e);
              } else {
                showFloat(e.x, e.y - 12, '🔒 制止分裂!', '#c084fc', 12);
              }
            }
          }
        }
      }

      // 治療基地
      if (b.healBase) {
        gameState.hp = Math.min(getBaseHP(gameState.talentData), gameState.hp + b.healBase);
      }

      // 靈木塔：生成臨時障礙（在怪物當前格，持續 5 秒）
      if (b.spawnWall) {
        const wx = b.targetEnemy.currentGridX;
        const wy = b.targetEnemy.currentGridY;
        const isFreeCell = gameState.grid[wx][wy] === 0 && !gameState.tempWalls.some(w => w.x === wx && w.y === wy);
        if (isFreeCell && validatePlacement(wx, wy, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.enemies)) {
          gameState.grid[wx][wy] = 1;
          gameState.tempWalls.push({ x: wx, y: wy, lifetime: 300 }); // 5秒 (300幀)
          updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.cachedPathTiles, gameState.cachedFullPath);
          showFloat(b.targetEnemy.x, b.targetEnemy.y - 16, '🌿 纏縛！', '#4ade80', 13);
        }
      }

      // 檢查目標死亡
      if (b.targetEnemy.hp <= 0) {
        const eidx = gameState.enemies.findIndex(e => e.id === b.targetEnemy.id);
        if (eidx !== -1) {
          const goldMult = Math.max(0.4, 1.0 - (gameState.wave - 1) * 0.03);
          const award = Math.max(1, Math.floor(b.targetEnemy.goldAward * goldMult));
          gameState.gold += award;
          gameState.killCount++;
          recordKill(gameState.talentData, b.targetEnemy.type, b.targetEnemy.type === 'boss_dragon');
          gameState.currentKillStreak++;
          if (gameState.currentKillStreak > gameState.maxKillStreak) gameState.maxKillStreak = gameState.currentKillStreak;
          showFloat(b.targetEnemy.x, b.targetEnemy.y, `+${award}g`, '#f59e0b');
          
          createDeathParticles(gameState.particles, gameState.TILE_SIZE, b.targetEnemy.x, b.targetEnemy.y, hitColor);
          createSplatterParticles(gameState.particles, gameState.TILE_SIZE, b.targetEnemy.x, b.targetEnemy.y, hitColor, 8);

          gameState.enemies.splice(eidx, 1);
          playSFX('enemy_death');
          updateUI();
          checkWaveEnd();
        }
      }

      // 檢查 AOE 造成的死亡
      for (let j = gameState.enemies.length - 1; j >= 0; j--) {
        if (gameState.enemies[j].hp <= 0) {
          const goldMult = Math.max(0.4, 1.0 - (gameState.wave - 1) * 0.03);
          const award = Math.max(1, Math.floor(gameState.enemies[j].goldAward * goldMult));
          gameState.gold += award;
          gameState.killCount++;
          recordKill(gameState.talentData, gameState.enemies[j].type, gameState.enemies[j].type === 'boss_dragon');
          showFloat(gameState.enemies[j].x, gameState.enemies[j].y, `+${award}g`, '#f59e0b');
          const pColor = ENEMY_DEFS[gameState.enemies[j].type]?.colorPrimary ?? '#facc15';
          createDeathParticles(gameState.particles, gameState.TILE_SIZE, gameState.enemies[j].x, gameState.enemies[j].y, pColor);
          createSplatterParticles(gameState.particles, gameState.TILE_SIZE, gameState.enemies[j].x, gameState.enemies[j].y, pColor, 8);
          gameState.enemies.splice(j, 1);
          playSFX('enemy_death');
          updateUI();
        }
      }
      checkWaveEnd();

      gameState.bullets.splice(i, 1);
    } else {
      b.x += (dx / dist) * b.speed;
      b.y += (dy / dist) * b.speed;
    }
  }

  // 4. 飄字
  for (let i = gameState.floatingTexts.length - 1; i >= 0; i--) {
    const ft = gameState.floatingTexts[i];
    ft.y -= 0.5; ft.life--; ft.alpha = ft.life / 45;
    if (ft.life <= 0) gameState.floatingTexts.splice(i, 1);
  }

  // 5. 臨時障礙倒計時
  for (let i = gameState.tempWalls.length - 1; i >= 0; i--) {
    gameState.tempWalls[i].lifetime--;
    if (gameState.tempWalls[i].lifetime <= 0) {
      const tw = gameState.tempWalls[i];
      gameState.grid[tw.x][tw.y] = 0;
      gameState.tempWalls.splice(i, 1);
      updateAllEnemyPaths(gameState.enemies, gameState.grid, gameState.COLS, gameState.ROWS, gameState.SPAWN_POINT, gameState.BASE_POINT, gameState.WAYPOINTS, gameState.cachedPathTiles, gameState.cachedFullPath);
    }
  }

  // 6. 更新粒子特效 (Phase 4)
  updateParticles(gameState.particles);

  // 7. 更新背景星星與天氣 (Phase 4)
  updateBgStars();
  updateWeather();
}

export function updateBgStars() {
  for (const star of gameState.bgStars) {
    star.alpha += star.alphaSpeed;
    if (star.alpha > 1.0 || star.alpha < 0.2) {
      star.alphaSpeed = -star.alphaSpeed;
    }
  }
}

export function updateWeather() {
  // 更新閃電計時
  if (gameState.currentWeather === 'thunder') {
    if (gameState.lightningActive > 0) {
      gameState.lightningActive--;
    } else {
      if (gameState.lightningTimer > 0) {
        gameState.lightningTimer--;
      } else {
        // 觸發閃電機率
        if (Math.random() < 0.005) {
          gameState.lightningActive = 10 + Math.floor(Math.random() * 15); // 閃電持續 10-25 幀
          gameState.lightningTimer = 180 + Math.floor(Math.random() * 240); // 隨機 3~7 秒冷卻
          generateLightningPaths();
        }
      }
    }
  } else {
    gameState.lightningActive = 0;
  }

  // 更新天氣粒子
  if (gameState.currentWeather === 'none') {
    gameState.weatherParticles = [];
    return;
  }

  // 1. 產生新粒子
  if (gameState.currentWeather === 'rain' || gameState.currentWeather === 'thunder') {
    // 雨/雷雨：每幀產生雨粒子
    const spawnCount = gameState.currentWeather === 'thunder' ? 4 : 2;
    for (let i = 0; i < spawnCount; i++) {
      gameState.weatherParticles.push({
        x: Math.random() * getDomRefs().canvas.width,
        y: -10,
        vx: -1.5 - Math.random() * 1.5,
        vy: 8 + Math.random() * 4,
        size: 1 + Math.random() * 1.5,
        alpha: 0.3 + Math.random() * 0.4,
        length: 12 + Math.random() * 15
      });
    }
  } else if (gameState.currentWeather === 'fog') {
    // 霧氣粒子初始化與定時補充
    if (gameState.weatherParticles.length < 25) {
      const isInit = gameState.weatherParticles.length === 0;
      const spawnCount = isInit ? 25 : 1;
      for (let i = 0; i < spawnCount; i++) {
        gameState.weatherParticles.push({
          x: isInit ? Math.random() * getDomRefs().canvas.width : -120,
          y: Math.random() * getDomRefs().canvas.height,
          vx: 0.2 + Math.random() * 0.4,
          vy: (Math.random() - 0.5) * 0.1,
          size: 80 + Math.random() * 80,
          alpha: 0.02 + Math.random() * 0.05
        });
      }
    }
  }

  // 2. 移動並過濾粒子
  for (let i = gameState.weatherParticles.length - 1; i >= 0; i--) {
    const p = gameState.weatherParticles[i];
    p.x += p.vx;
    p.y += p.vy;

    // 邊界檢查
    if (gameState.currentWeather === 'rain' || gameState.currentWeather === 'thunder') {
      if (p.y > getDomRefs().canvas.height + 20 || p.x < -20) {
        gameState.weatherParticles.splice(i, 1);
      }
    } else if (gameState.currentWeather === 'fog') {
      if (p.x > getDomRefs().canvas.width + 150) {
        gameState.weatherParticles.splice(i, 1);
      }
    }
  }
}

export function generateLightningPaths() {
  gameState.lightningPaths = [];
  const pathCount = 1 + Math.floor(Math.random() * 2);
  for (let p = 0; p < pathCount; p++) {
    const path: Point[] = [];
    let curX = 100 + Math.random() * (getDomRefs().canvas.width - 200);
    let curY = 0;
    path.push({ x: curX, y: curY });
    
    const segmentCount = 6 + Math.floor(Math.random() * 6);
    const targetY = getDomRefs().canvas.height * 0.6 + Math.random() * (getDomRefs().canvas.height * 0.4);
    const dy = targetY / segmentCount;
    
    for (let i = 0; i < segmentCount; i++) {
      curY += dy;
      curX += (Math.random() - 0.5) * 60;
      path.push({ x: curX, y: curY });
    }
    gameState.lightningPaths.push(path);
  }
}

function triggerSplit(e: Enemy) {
  e.hasSplit = true;

  // Work B 反向分裂：分裂時獲得金幣
  if (gameState.roguelikeState.splitRewardActive) {
    gameState.gold += 10;
    showFloat(e.x, e.y - 10, '💰 反向分裂 +10g', '#f59e0b');
  }

  // 移除 e
  const idx = gameState.enemies.findIndex(enemy => enemy.id === e.id);
  if (idx !== -1) {
    gameState.enemies.splice(idx, 1);
  }
  // 生成 3 隻 salamander
  const def = ENEMY_DEFS['salamander'];
  const waveNum = gameState.wave || 20;
  const waveConfigs = getWaveConfig(waveNum);
  const cfg = waveConfigs.find(c => c.enemyType === 'salamander') || waveConfigs[0];
  const hpMult = cfg ? cfg.hpMultiplier : 10.0;

  const offsets = [-8, 0, 8];
  for (let k = 0; k < 3; k++) {
    gameState.enemies.push({
      id: gameState.nextEnemyId++,
      type: 'salamander',
      element: def.element,
      x: e.x + offsets[k],
      y: e.y + (k % 2 === 0 ? 4 : -4),
      currentGridX: e.currentGridX,
      currentGridY: e.currentGridY,
      hp: Math.floor(def.baseHp * hpMult),
      maxHp: Math.floor(def.baseHp * hpMult),
      speed: def.speed,
      baseSpeed: def.speed,
      goldAward: def.goldAward,
      isFlying: def.isFlying,
      waypointIndex: e.waypointIndex,
      path: [...e.path],
      pathIndex: e.pathIndex,
      slowDuration: 0,
      dotDamage: 0,
      dotDuration: 0,
      hitFlashFrame: 0,
      vx: e.vx,
      vy: e.vy,
      squashX: 1.0,
      squashY: 1.0,
      hitRadius: getEnemyCollisionRadius('salamander', gameState.TILE_SIZE),
      isStuck: e.isStuck,
      pathBlockedHintShown: e.pathBlockedHintShown
    });
  }
  showFloat(e.x, e.y, '💥 分裂！', '#ef4444', 16);
  playSFX('enemy_death');
  updateUI();
}
