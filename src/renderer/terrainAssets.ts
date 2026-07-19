// src/renderer/terrainAssets.ts — 高細節草地／道路 atlas 載入與繪製

const MEADOW_BASE_SRC = '/assets/terrain/meadow-base-v1.png';
const MEADOW_ATLAS_SRC = '/assets/terrain/meadow-road-atlas-v1.png';
const ROAD_AUTOTILE_SRC = '/assets/terrain/road-autotile-v2.png';
const ATLAS_COLUMNS = 4;
const ATLAS_INSET = 4;

export interface ChineseTerrainAssets {
  meadowBase: HTMLImageElement | null;
  atlas: HTMLImageElement | null;
  roadAtlas: HTMLImageElement | null;
}

export interface AtlasRoadTileVariant {
  cell: number;
  rotation: number;
}

let meadowBase: HTMLImageElement | null = null;
let meadowAtlas: HTMLImageElement | null = null;
let roadAutotile: HTMLImageElement | null = null;
let roadDirtPattern: CanvasPattern | null = null;
let roadDirtPatternContext: CanvasRenderingContext2D | null = null;
let roadDirtPatternSource: HTMLImageElement | null = null;
let started = false;
let pendingLoads = 0;
const readyCallbacks = new Set<() => void>();

function notifyWhenSettled(): void {
  if (pendingLoads > 0) return;
  for (const callback of readyCallbacks) callback();
  readyCallbacks.clear();
}

function loadImage(src: string, onSuccess: (image: HTMLImageElement) => void): void {
  const image = new Image();
  image.onload = () => {
    onSuccess(image);
    pendingLoads--;
    notifyWhenSettled();
  };
  image.onerror = () => {
    // 外置美術缺失時保留 null，由 tileCache 使用原生程序化地塊。
    pendingLoads--;
    notifyWhenSettled();
  };
  image.src = src;
}

/** 首次呼叫開始載入，載入期間與失敗時都不阻斷既有地圖渲染。 */
export function getChineseTerrainAssets(onReady?: () => void): ChineseTerrainAssets {
  if (onReady && (!meadowBase || !meadowAtlas || !roadAutotile)) readyCallbacks.add(onReady);
  if (!started) {
    started = true;
    pendingLoads = 3;
    loadImage(MEADOW_BASE_SRC, image => { meadowBase = image; });
    loadImage(MEADOW_ATLAS_SRC, image => { meadowAtlas = image; });
    loadImage(ROAD_AUTOTILE_SRC, image => { roadAutotile = image; });
  }
  return { meadowBase, atlas: meadowAtlas, roadAtlas: roadAutotile };
}

/** 以 cover 方式鋪滿邏輯畫布；維持像素硬邊，不影響任何格座標。 */
export function drawMeadowBase(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
): void {
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;
  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
}

function drawAtlasTile(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  cell: number,
  x: number,
  y: number,
  size: number,
  rotation = 0,
): void {
  const sourceCell = atlas.width / ATLAS_COLUMNS;
  const column = ((cell % ATLAS_COLUMNS) + ATLAS_COLUMNS) % ATLAS_COLUMNS;
  const row = Math.floor(cell / ATLAS_COLUMNS);
  const sx = column * sourceCell + ATLAS_INSET;
  const sy = row * sourceCell + ATLAS_INSET;
  const sourceSize = sourceCell - ATLAS_INSET * 2;

  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(rotation * Math.PI / 2);
  ctx.drawImage(atlas, sx, sy, sourceSize, sourceSize, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** 在固定地圖指定格放置高細節草地／石碑類純視覺裝飾。 */
export function drawTerrainProp(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  cell: number,
  x: number,
  y: number,
  size: number,
): void {
  drawAtlasTile(ctx, atlas, cell, x, y, size);
}

/**
 * 從高細節道路圖集的純土路中心擷取可重複紋理。
 * 轉角本身不再取用生成圖的邊框，因此連接保持格線精準；土壤細節仍完全來自新圖集。
 */
export function getAtlasRoadDirtPattern(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
): CanvasPattern | null {
  if (!atlas) return null;
  if (roadDirtPattern && roadDirtPatternContext === ctx && roadDirtPatternSource === atlas) {
    return roadDirtPattern;
  }

  const sample = document.createElement('canvas');
  // 保持取樣是「縮小」而非放大：避免出現低像素被放大的視覺感。
  const sampleWidth = 192;
  const sampleHeight = 116;
  sample.width = sampleWidth;
  sample.height = sampleHeight;
  const sampleCtx = sample.getContext('2d');
  if (!sampleCtx) return null;
  sampleCtx.imageSmoothingEnabled = false;

  const sourceCell = atlas.width / ATLAS_COLUMNS;
  // cell 4 是水平直道；只擷取中間土壤，避免把草邊與格線帶入道路紋理。
  const cropWidth = sourceCell * 0.76;
  const cropHeight = sourceCell * 0.46;
  const sx = sourceCell * 0.12;
  const sy = sourceCell + sourceCell * 0.27;
  sampleCtx.drawImage(atlas, sx, sy, cropWidth, cropHeight, 0, 0, sampleWidth, sampleHeight);

  roadDirtPattern = ctx.createPattern(sample, 'repeat');
  roadDirtPatternContext = ctx;
  roadDirtPatternSource = atlas;
  return roadDirtPattern;
}

/**
 * 找出道路遮罩所需的 atlas 格與旋轉角度。
 * 四個轉角明確使用兩種原生角落素材，避免把單一非對稱素材旋轉 90°。
 */
export function resolveAtlasRoadTileVariant(mask: number): AtlasRoadTileVariant {
  const north = (mask & 1) !== 0;
  const east = (mask & 2) !== 0;
  const south = (mask & 4) !== 0;
  const west = (mask & 8) !== 0;
  const branches = Number(north) + Number(east) + Number(south) + Number(west);

  if (mask === (2 | 8)) return { cell: 4, rotation: 0 };
  if (mask === (1 | 4)) return { cell: 5, rotation: 0 };
  if (branches === 4) return { cell: 9, rotation: 0 };
  if (branches === 3) {
    // cell 8 = 東、西、南三岔；以缺口決定旋轉。
    return { cell: 8, rotation: north && east && west ? 2 : north && south && west ? 1 : north && east && south ? 3 : 0 };
  }
  if (branches === 2) {
    if (east && south) return { cell: 6, rotation: 0 };
    if (south && west) return { cell: 7, rotation: 0 };
    if (north && west) return { cell: 6, rotation: 2 };
    if (north && east) return { cell: 7, rotation: 2 };
    return { cell: 11, rotation: 0 };
  }
  if (branches === 1) {
    // cell 10 的道路由下方進入；旋轉成所需端點方向。
    return { cell: 10, rotation: south ? 0 : west ? 1 : north ? 2 : 3 };
  }
  return { cell: 11, rotation: 0 };
}

/** 新版專用 autotile 的 4×4 格位；每個出口皆為固定中心線，不需旋轉素材。 */
export function resolveRoadAutotileCell(mask: number): number {
  const cells: Record<number, number> = {
    0: 0,
    1: 1,
    2: 2,
    4: 3,
    8: 4,
    10: 5,
    5: 6,
    6: 7,
    12: 8,
    9: 9,
    3: 10,
    14: 11,
    13: 12,
    11: 13,
    7: 14,
    15: 15,
  };
  return cells[mask] ?? 0;
}

/** 以無裁切、無旋轉的方式繪製專用道路圖集，保留每條邊的精準中心位置。 */
export function drawRoadAutotileTile(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  mask: number,
): boolean {
  if (!atlas) return false;
  const sourceCell = atlas.width / ATLAS_COLUMNS;
  const cell = resolveRoadAutotileCell(mask);
  const column = cell % ATLAS_COLUMNS;
  const row = Math.floor(cell / ATLAS_COLUMNS);
  ctx.drawImage(
    atlas,
    column * sourceCell,
    row * sourceCell,
    sourceCell,
    sourceCell,
    x,
    y,
    size,
    size,
  );
  return true;
}

/**
 * 將有序路徑遮罩對應到 atlas 的道路形態；回傳 false 讓呼叫端使用程序化 fallback。
 * 道路圖塊的草邊與碎石都烘焙在素材內，視覺上比純色組合更有層次。
 */
export function drawAtlasRoadTile(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  mask: number,
): boolean {
  if (!atlas) return false;
  const variant = resolveAtlasRoadTileVariant(mask);
  drawAtlasTile(ctx, atlas, variant.cell, x, y, size, variant.rotation);
  return true;
}
