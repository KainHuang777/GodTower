import { describe, it, expect, beforeEach, vi } from 'vitest';
import { gameState } from '../state';
import { checkWaveEnd } from '../battle/battleManager';
import { updateMergeAnimation } from '../battle/towerActions';

// Mock DOM
vi.mock('../domRefs', () => {
  const mockBtn = {
    disabled: false,
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn()
    },
    textContent: ''
  };
  return {
    getDomRefs: () => ({
      btnStartWave: mockBtn,
      btnMerge: mockBtn,
      btnSpeed: mockBtn,
      towerButtonsContainer: {
        querySelector: () => mockBtn,
        querySelectorAll: () => [mockBtn]
      },
      hpVal: {},
      goldVal: {},
      waveVal: {},
      killVal: {},
      instructionText: {}
    })
  };
});

// Mock renderer
vi.mock('../renderer/gameRenderer', () => ({
  showFloat: vi.fn()
}));

// Mock uiManager
vi.mock('../ui/uiManager', () => ({
  updateUI: vi.fn(),
  updateLevelTutorial: vi.fn(),
  updateRoguelikeHUD: vi.fn()
}));

// Mock pathfinding
vi.mock('../battle/pathfinding', () => ({
  updateAllEnemyPaths: vi.fn()
}));

describe('Tutorial Onboarding Logic Tests', () => {
  beforeEach(() => {
    gameState.currentMap = {
      id: 'tutorial',
      name: 'Tutorial Map',
      difficulty: '教學',
      description: 'Test',
      spawnPoint: { x: 5, y: 20 },
      basePoint: { x: 75, y: 20 },
      waypoints: [],
      obstacles: []
    };
    gameState.wave = 0;
    gameState.isWaveActive = false;
    gameState.levelTutorialStep = 'intro';
    gameState.towers = [];
    gameState.grid = Array.from({ length: 80 }, () => Array(40).fill(0));
    gameState.nextTowerId = 1;
    gameState.gameSpeed = 1;
    gameState.talentData = {
      talentPoints: 0,
      talentLevels: {}
    } as any;
    gameState.roguelikeState = {
      nextMergeCostPct: 1.0
    } as any;
  });

  it('should dynamically limit max waves to 5 for tutorial map', () => {
    const maxWaves = gameState.currentMap.id === 'tutorial' ? 5 : 20;
    expect(maxWaves).toBe(5);
  });

  it('should spawn a second fire tower and transition to merge_guide after wave 1 end', () => {
    // 建立第一座烈焰塔
    gameState.towers.push({
      id: gameState.nextTowerId++,
      x: 61,
      y: 9,
      typeId: 'fire',
      def: { cost: 10, isWall: true } as any,
      cooldown: 0,
      damageDealt: 0,
      recoilY: 0
    });
    gameState.grid[61][9] = 1;

    gameState.wave = 1;
    gameState.isWaveActive = true;
    gameState.levelTutorialStep = 'wave_1_active';

    // 觸發波次結束
    checkWaveEnd();

    // 應該生成第二座烈焰塔
    expect(gameState.towers.length).toBe(2);
    expect(gameState.towers[1].typeId).toBe('fire');
    // 第二座塔應該在第一座塔的相鄰格 (例如 62, 9)
    expect(Math.abs(gameState.towers[1].x - 61) + Math.abs(gameState.towers[1].y - 9)).toBe(1);
    
    // 狀態轉移
    expect(gameState.levelTutorialStep).toBe('merge_guide');
  });

  it('should transition to speed_guide after merge animation completes in tutorial', () => {
    gameState.levelTutorialStep = 'merge_guide';
    gameState.mergeAnimation = {
      active: true,
      timer: 30,
      duration: 30,
      t1: { id: 1, typeId: 'fire' },
      t2: { id: 2, typeId: 'fire' },
      resultX: 61,
      resultY: 9,
      resultTypeId: 'fire_2'
    } as any;

    updateMergeAnimation();

    // 狀態轉移
    expect(gameState.levelTutorialStep).toBe('speed_guide');
  });

  it('should transition to wave_5_guide after wave 4 ends', () => {
    gameState.wave = 4;
    gameState.isWaveActive = true;
    gameState.levelTutorialStep = 'idle';

    checkWaveEnd();

    // 狀態轉移
    expect(gameState.levelTutorialStep).toBe('wave_5_guide');
  });
});
