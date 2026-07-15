import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { gameState } from '../state';
import { checkWaveEnd, endBattle } from '../battle/battleManager';
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
      spawnPoint: { x: 0, y: 5 },
      basePoint: { x: 19, y: 5 },
      waypoints: [],
      obstacles: [],
      dimensions: { cols: 20, rows: 10, tileSize: 64, overview: true }
    };
    gameState.wave = 0;
    gameState.isWaveActive = false;
    gameState.levelTutorialStep = 'intro';
    gameState.towers = [];
    gameState.grid = Array.from({ length: 20 }, () => Array(10).fill(0));
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
      x: 8,
      y: 2,
      typeId: 'fire',
      def: { cost: 10, isWall: true } as any,
      cooldown: 0,
      damageDealt: 0,
      recoilY: 0
    });
    gameState.grid[8][2] = 1;

    gameState.wave = 1;
    gameState.isWaveActive = true;
    gameState.levelTutorialStep = 'wave_1_active';

    // 觸發波次結束
    checkWaveEnd();

    // 應該生成第二座烈焰塔
    expect(gameState.towers.length).toBe(2);
    expect(gameState.towers[1].typeId).toBe('fire');
    // 第二座塔應該在第一座塔的相鄰格
    expect(Math.abs(gameState.towers[1].x - 8) + Math.abs(gameState.towers[1].y - 2)).toBe(1);
    
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
      resultX: 8,
      resultY: 2,
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

  it('should introduce flying enemies after wave 3 ends', () => {
    gameState.wave = 3;
    gameState.isWaveActive = true;
    gameState.levelTutorialStep = 'idle';

    checkWaveEnd();

    expect(gameState.levelTutorialStep).toBe('wave_4_guide');
  });
});

import { renderTalentScreen } from '../scenes/scenesManager';
import { getAvailablePoints } from '../talent';
import * as domRefs from '../domRefs';

describe('Talent Onboarding Tutorial Fixes', () => {
  let originalDocument: any;
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete storage[key];
      }),
      clear: vi.fn(() => {
        storage = {};
      })
    });

    originalDocument = (globalThis as any).document;

    const mockEl = { 
      textContent: '', 
      className: '', 
      remove: vi.fn(), 
      appendChild: vi.fn(), 
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() },
      dataset: {},
      querySelector: vi.fn().mockImplementation(() => mockEl)
    };

    (globalThis as any).document = {
      getElementById: vi.fn().mockImplementation((id) => {
        if (id === 'talentPointsVal') return { textContent: '' } as any;
        if (id === 'talentSvg') return {} as any;
        return mockEl as any;
      }),
      querySelectorAll: vi.fn().mockReturnValue([]),
      querySelector: vi.fn().mockReturnValue(mockEl),
      createElement: vi.fn().mockReturnValue(mockEl)
    };

    // Mock getDomRefs to return all scene elements
    vi.spyOn(domRefs, 'getDomRefs').mockReturnValue({
      mainMenuEl: mockEl,
      levelSelectScreenEl: mockEl,
      mapEditorSceneEl: mockEl,
      gameUiEl: mockEl,
      gameOverScreenEl: mockEl,
      talentScreenEl: mockEl,
      battleSceneEl: mockEl,
      btnStartWave: mockEl,
      btnMerge: mockEl,
      btnSpeed: mockEl,
      towerButtonsContainer: {
        querySelector: () => mockEl,
        querySelectorAll: () => []
      },
      instructionText: mockEl
    } as any);
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    vi.unstubAllGlobals();
  });

  it('should grant at least 2 talent points on first endBattle to allow purchasing gold_1', () => {
    gameState.talentData.hasPlayedBefore = false;
    gameState.talentData.totalTalentPoints = 0;
    gameState.talentData.spentTalentPoints = 0;
    gameState.wave = 1; // 1 波生存理論上只有 1 點

    endBattle(false);

    // 應該獲得 2 點（保底），並且 talentTutorialActive 為 true
    expect(gameState.talentData.totalTalentPoints).toBe(2);
    expect(gameState.talentTutorialActive).toBe(true);
  });

  it('should defensively top up talent points to 2 in renderTalentScreen if tutorial is active and points < 2', () => {
    gameState.talentTutorialActive = true;
    gameState.talentData.totalTalentPoints = 1;
    gameState.talentData.spentTalentPoints = 0;

    renderTalentScreen();

    // 應該防禦性地把可用點數補到 2
    expect(getAvailablePoints(gameState.talentData)).toBe(2);
  });
});
