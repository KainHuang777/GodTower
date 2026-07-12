// ============================================================
// src/domRefs.ts — 集中 DOM 元素參考
// ============================================================
//
// 由 main.ts 模組化拆分而來，避免各模組重複 getElementById，也便於統一 null 檢查。

export interface DomRefs {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hpVal: HTMLElement;
  goldVal: HTMLElement;
  waveVal: HTMLElement;
  killVal: HTMLElement;
  btnStartWave: HTMLButtonElement;
  btnInspect: HTMLElement;
  btnMerge: HTMLElement;
  btnSell: HTMLElement;
  btnQuitBattle: HTMLElement;
  btnDiagnostics: HTMLElement;
  diagnosticPanel: HTMLElement;
  btnDiagExport: HTMLElement;
  btnDiagBench: HTMLElement;
  diagFps: HTMLElement;
  diagLatency: HTMLElement;
  diagDrawCalls: HTMLElement;
  diagCacheSize: HTMLElement;
  diagMonsters: HTMLElement;
  diagTowers: HTMLElement;
  diagFilterWarning: HTMLElement;
  btnShowRoute: HTMLElement;
  instructionText: HTMLElement;
  towerButtonsContainer: HTMLElement;
  waveProgressFill: HTMLElement;
  waveProgressLabel: HTMLElement;
  waveEnemyCount: HTMLElement;
  selectTheme: HTMLSelectElement;
  selectWeather: HTMLSelectElement;
  selectStyle: HTMLSelectElement;

  // 場景元素
  mainMenuEl: HTMLElement;
  levelSelectScreenEl: HTMLElement;
  levelGridEl: HTMLElement;
  mapEditorSceneEl: HTMLElement;
  editorCanvasEl: HTMLCanvasElement;
  editorCtx: CanvasRenderingContext2D;
  editorStatusEl: HTMLElement;
  editorMapNameInput: HTMLInputElement;
  talentScreenEl: HTMLElement;
  gameOverScreenEl: HTMLElement;
  battleSceneEl: HTMLElement;
  btnSpeed: HTMLButtonElement;
  btnCodex: HTMLElement;
  wuxingCompass: HTMLElement;
  recipeCodexModal: HTMLElement;
  btnCloseCodex: HTMLElement;
  codexBody: HTMLElement;
}

function getEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`DOM element #${id} not found`);
  return el;
}

function getCanvas(id: string): HTMLCanvasElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLCanvasElement)) throw new Error(`DOM element #${id} is not a canvas`);
  return el;
}

function getSelect(id: string): HTMLSelectElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) throw new Error(`DOM element #${id} is not a select`);
  return el;
}

function getInput(id: string): HTMLInputElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`DOM element #${id} is not an input`);
  return el;
}

function getCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D context');
  return ctx;
}

/** 在 DOM 載入後呼叫一次 */
export function initDomRefs(): DomRefs {
  const canvas = getCanvas('gameCanvas');
  const editorCanvasEl = getCanvas('editorCanvas');

  domRefs = {
    canvas,
    ctx: getCtx(canvas),
    hpVal: getEl('hpVal'),
    goldVal: getEl('goldVal'),
    waveVal: getEl('waveVal'),
    killVal: getEl('killVal'),
    btnStartWave: getEl('btnStartWave') as HTMLButtonElement,
    btnInspect: getEl('btnInspect'),
    btnMerge: getEl('btnMerge'),
    btnSell: getEl('btnSell'),
    btnQuitBattle: getEl('btnQuitBattle'),
    btnDiagnostics: getEl('btnDiagnostics'),
    diagnosticPanel: getEl('diagnosticPanel'),
    btnDiagExport: getEl('btnDiagExport'),
    btnDiagBench: getEl('btnDiagBench'),
    diagFps: getEl('diagFps'),
    diagLatency: getEl('diagLatency'),
    diagDrawCalls: getEl('diagDrawCalls'),
    diagCacheSize: getEl('diagCacheSize'),
    diagMonsters: getEl('diagMonsters'),
    diagTowers: getEl('diagTowers'),
    diagFilterWarning: getEl('diagFilterWarning'),
    btnShowRoute: getEl('btnShowRoute'),
    instructionText: getEl('instructionText'),
    towerButtonsContainer: getEl('towerButtons'),
    waveProgressFill: getEl('waveProgressFill'),
    waveProgressLabel: getEl('waveProgressLabel'),
    waveEnemyCount: getEl('waveEnemyCount'),
    selectTheme: getSelect('selectTheme'),
    selectWeather: getSelect('selectWeather'),
    selectStyle: getSelect('selectStyle'),

    mainMenuEl: getEl('mainMenu'),
    levelSelectScreenEl: getEl('levelSelectScreen'),
    levelGridEl: getEl('levelGrid'),
    mapEditorSceneEl: getEl('mapEditorScene'),
    editorCanvasEl,
    editorCtx: getCtx(editorCanvasEl),
    editorStatusEl: getEl('editorStatus'),
    editorMapNameInput: getInput('editorMapName'),
    talentScreenEl: getEl('talentScreen'),
    gameOverScreenEl: getEl('gameOverScreen'),
    battleSceneEl: getEl('battleScene'),
    btnSpeed: getEl('btnSpeed') as HTMLButtonElement,
    btnCodex: getEl('btnCodex'),
    wuxingCompass: getEl('wuxingCompass'),
    recipeCodexModal: getEl('recipeCodexModal'),
    btnCloseCodex: getEl('btnCloseCodex'),
    codexBody: getEl('codexBody'),
  };

  return domRefs;
}

let domRefs: DomRefs | null = null;

export function getDomRefs(): DomRefs {
  if (!domRefs) throw new Error('DOM refs not initialized; call initDomRefs() first');
  return domRefs;
}
