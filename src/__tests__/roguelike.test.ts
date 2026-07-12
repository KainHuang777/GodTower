// ============================================================
// src/__tests__/roguelike.test.ts — Roguelike system unit tests
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gameState, createGameState } from '../state.js';

import {
  calcMysteryBoxPrice,
  rollMysteryBox,
  grantStartBonus,
} from '../system/roguelikeSystem.js';
import { handleBuild, updateMergeAnimation } from '../battle/towerActions.js';

// Mock UI & Audio & Renderer & Pathfinding modules to avoid DOM dependency errors
vi.mock('../renderer/gameRenderer.js', () => ({
  showFloat: vi.fn(),
}));

vi.mock('../audio/audioSystem.js', () => ({
  playSFX: vi.fn(),
}));

vi.mock('../ui/uiManager.js', () => ({
  updateUI: vi.fn(),
}));

vi.mock('../battle/pathfinding.js', () => ({
  validatePlacement: () => true,
  updateAllEnemyPaths: vi.fn(),
}));

describe('Roguelike System', () => {
  beforeEach(() => {
    // Reset global gameState
    Object.assign(gameState, createGameState());
    
    // Assign mock interfaces
    gameState.refreshToolSelection = vi.fn();
    gameState.currentScene = 'BATTLE';
    gameState.gold = 100;
    
    // Default mock maps
    gameState.currentMap = {
      id: 'level_1',
      name: '古典中式關卡',
      difficulty: '簡單',
      description: '測試用',
      spawnPoint: { x: 0, y: 20 },
      basePoint: { x: 79, y: 20 },
      waypoints: [],
      obstacles: [],
    };

    // Initialize 80x40 grid
    gameState.COLS = 80;
    gameState.ROWS = 40;
    gameState.grid = Array.from({ length: 80 }, () => Array(40).fill(0));
    gameState.towers = [];
  });

  // ===================================================================
  // 1. Mystery Box (rollMysteryBox & calcMysteryBoxPrice)
  // ===================================================================
  describe('Mystery Box Summon & Dynamic Pricing', () => {
    it('excludes wall tower ("earth") and locked towers from the pool', () => {
      // 模擬玩家只解鎖了 fire 和 earth 塔
      gameState.talentData = {
        totalTalentPoints: 5,
        spentTalentPoints: 2,
        talentLevels: {
          fire_awakening: 1, // 火塔已解鎖
          water_awakening: 0, // 水塔未解鎖
        },
      };

      // 由於 'earth' 被排除，池中唯一的解鎖基礎塔應為 'fire'
      const price = calcMysteryBoxPrice();
      expect(price).toBeGreaterThan(0);

      // 模擬召喚
      gameState.gold = 50;
      gameState.roguelikeState.mysteryBoxPrice = price;
      
      rollMysteryBox();

      // 驗證是否正確扣款 (非測試關卡)
      expect(gameState.gold).toBe(50 - price);
      // 驗證當前工具被設為唯一解鎖的 'fire'
      expect(gameState.selectedTool).toBe('fire');
      // 驗證下一次建置被標記為免費
      expect(gameState.roguelikeState.freeNextBuild).toBe(true);
    });

    it('resets mergeMode and mergeFirstTower when mystery box is rolled', () => {
      gameState.talentData = {
        totalTalentPoints: 5,
        spentTalentPoints: 2,
        talentLevels: {
          fire_awakening: 1,
        },
      };
      gameState.mergeMode = true;
      gameState.mergeFirstTower = { id: 999, x: 1, y: 1 } as any;
      gameState.gold = 100;
      gameState.roguelikeState.mysteryBoxPrice = 10;
      
      rollMysteryBox();
      
      expect(gameState.mergeMode).toBe(false);
      expect(gameState.mergeFirstTower).toBeNull();
    });

    it('calculates expected pricing dynamically based on unlocked towers', () => {
      // 情境 A：只解鎖火塔 (cost: 12)
      gameState.talentData = {
        totalTalentPoints: 5,
        spentTalentPoints: 2,
        talentLevels: {
          fire_awakening: 1,
        },
      };
      const priceA = calcMysteryBoxPrice();

      // 情境 B：解鎖了高價的聖光陽塔 (cost: 18)
      gameState.talentData = {
        totalTalentPoints: 10,
        spentTalentPoints: 4,
        talentLevels: {
          fire_awakening: 1,
          yang_law: 1, // cost: 18
        },
      };
      const priceB = calcMysteryBoxPrice();

      // 情境 B 解鎖了更高造價的塔，召喚期望值應高於情境 A
      expect(priceB).toBeGreaterThanOrEqual(priceA);
    });
  });

  // ===================================================================
  // 2. Start Bonus Continuous Free Build
  // ===================================================================
  describe('Start Bonus Continuous Free Build', () => {
    it('manages sequential placement of starter bonus towers for free', () => {
      // 模擬解鎖火、水、木塔
      gameState.talentData = {
        totalTalentPoints: 10,
        spentTalentPoints: 3,
        talentLevels: {
          fire_awakening: 1,
          water_awakening: 1,
          wood_awakening: 1,
        },
      };

      // 授權開局隨機補給 (這會給兩座不同元素塔)
      grantStartBonus();

      const rlState = gameState.roguelikeState as any;
      expect(rlState.startBonusTowers).toBeDefined();
      expect(rlState.startBonusTowers.length).toBe(2);
      expect(gameState.roguelikeState.freeNextBuild).toBe(true);

      const bonus1 = rlState.startBonusTowers[0];
      const bonus2 = rlState.startBonusTowers[1];

      // 玩家手頭上的金幣設為 0，確保如果需要收費就會失敗
      gameState.gold = 0;

      // 放置第一座補給塔
      gameState.selectedTool = bonus1;
      handleBuild(10, 10);

      // 驗證第一座塔是否被成功放置 (且免費)
      expect(gameState.towers.length).toBe(1);
      expect(gameState.towers[0].typeId).toBe(bonus1);

      // 驗證起始隨機補給狀態已自動遞增，並將工具跳轉到下一座補給塔，且再次標記為免費放置
      expect(rlState.startBonusIndex).toBe(1);
      expect(gameState.selectedTool).toBe(bonus2);
      expect(gameState.roguelikeState.freeNextBuild).toBe(true);

      // 放置第二座補給塔
      handleBuild(11, 11);

      // 驗證第二座塔成功被免費放置
      expect(gameState.towers.length).toBe(2);
      expect(gameState.towers[1].typeId).toBe(bonus2);

      // 驗證全部補給塔放完後，起始狀態被正確清理，且 freeNextBuild 關閉
      expect(rlState.startBonusTowers).toBeNull();
      expect(gameState.roguelikeState.freeNextBuild).toBe(false);
    });

    it('resets mergeMode and mergeFirstTower when start bonus is granted', () => {
      gameState.talentData = {
        totalTalentPoints: 10,
        spentTalentPoints: 3,
        talentLevels: {
          fire_awakening: 1,
        },
      };
      
      gameState.mergeMode = true;
      gameState.mergeFirstTower = { id: 999, x: 1, y: 1 } as any;
      
      grantStartBonus();
      
      expect(gameState.mergeMode).toBe(false);
      expect(gameState.mergeFirstTower).toBeNull();
    });
  });

  // ===================================================================
  // 3. Five Elements Resonance Merge Refund
  // ===================================================================
  describe('Five Elements Resonance Merge Refund', () => {
    it('refunds 50% of the material cost on merge when resonance buff is active', () => {
      // 啟動五行共鳴卡牌 Buff (nextMergeCostPct = 0.5)
      gameState.roguelikeState.nextMergeCostPct = 0.5;
      gameState.gold = 50;

      // 模擬兩座材料塔的合成動畫結束
      // 材料塔：烈焰塔 (cost: 12)、鏡刃塔 (cost: 18，原15→18)，總造價 = 30
      gameState.mergeAnimation = {
        active: true,
        timer: 44, // 倒數最後一幀
        duration: 45,
        t1: { x: 15, y: 15, typeId: 'fire' },
        t2: { x: 16, y: 16, typeId: 'metal' },
        resultX: 15,
        resultY: 15,
        resultTypeId: 'fire_2',
      };

      // 觸發合成動畫更新（完成合成）
      updateMergeAnimation();

      // 預期共鳴返還金額 = 30 * 50% = 15g
      // 玩家金幣應從 50 變為 65
      expect(gameState.gold).toBe(50 + 15);
      // 驗證共鳴 Buff 被正確消耗並重置為 1.0
      expect(gameState.roguelikeState.nextMergeCostPct).toBe(1.0);
    });

    it('does not refund or consume buff if merge is regular (nextMergeCostPct === 1.0)', () => {
      gameState.roguelikeState.nextMergeCostPct = 1.0;
      gameState.gold = 50;

      gameState.mergeAnimation = {
        active: true,
        timer: 44,
        duration: 45,
        t1: { x: 15, y: 15, typeId: 'fire' },
        t2: { x: 16, y: 16, typeId: 'metal' },
        resultX: 15,
        resultY: 15,
        resultTypeId: 'fire_2',
      };

      updateMergeAnimation();

      // 常規合成不退金幣
      expect(gameState.gold).toBe(50);
      expect(gameState.roguelikeState.nextMergeCostPct).toBe(1.0);
    });
  });
});
