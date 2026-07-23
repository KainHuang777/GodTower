// ============================================================
// src/maps.ts — 關卡地圖配置與平台存檔持久化
// ============================================================

import { currentSaveStorage } from './system/platform';
import type { Point } from './types';
import type { TowerTypeId } from './towers';

export interface InitialTowerConfig {
  typeId: TowerTypeId;
  x: number;
  y: number;
  locked?: boolean;
}

export interface MapPresentation {
  motif: 'showcase' | 'zigzag' | 'hexagram' | 'valley' | 'gorge' | 'ruins' | 'custom';
  featureTags: string[];
  strategy: string;
  focusPoint?: Point;
  expectedAttackWindows?: number;
  previewAccent?: string;
  /** 固定關卡的視覺點綴；不改變 grid、碰撞或尋路。 */
  terrainProps?: Array<{ x: number; y: number; atlasCell: number }>;
}

export interface MapConfig {
  id: string;
  name: string;
  difficulty: '教學' | '簡單' | '中等' | '困難' | '自訂' | '測試';
  description: string;
  spawnPoint: Point;
  basePoint: Point;
  waypoints: Point[];
  /** 路線錨點可很密；此欄只決定畫面上要顯示哪些檢查點。 */
  visibleWaypointIndices?: number[];
  obstacles: Point[]; // 預設天然地形阻擋的網格點
  initialTowers?: InitialTowerConfig[];
  tutorialHints?: {
    wallTiles: Point[];
  };
  presentation?: MapPresentation;
  dimensions?: {
    cols: number;
    rows: number;
    tileSize: number;
    overview?: boolean;
  };
}

// 輔助函式：產生指定矩形區域內的點陣
function generateRectPoints(x1: number, y1: number, x2: number, y2: number): Point[] {
  const pts: Point[] = [];
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      pts.push({ x, y });
    }
  }
  return pts;
}

/**
 * 將視覺折線轉成短距離正交錨點，讓四方向 A* 呈現穩定的像素階梯斜線。
 * stride=2 仍保留每兩格之間的小幅改道空間，避免把整條道路鎖死。
 */
function generateOrthogonalAnchors(vertices: Point[], stride = 2): Point[] {
  const anchors: Point[] = [];
  for (let segmentIndex = 1; segmentIndex < vertices.length; segmentIndex++) {
    const start = vertices[segmentIndex - 1];
    const end = vertices[segmentIndex];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    let movedX = 0;
    let movedY = 0;
    let x = start.x;
    let y = start.y;
    let stepCount = 0;

    while (x !== end.x || y !== end.y) {
      const nextXProgress = movedX < absX ? (movedX + 1) / Math.max(1, absX) : Infinity;
      const nextYProgress = movedY < absY ? (movedY + 1) / Math.max(1, absY) : Infinity;
      if (nextXProgress <= nextYProgress) {
        x += stepX;
        movedX++;
      } else {
        y += stepY;
        movedY++;
      }
      stepCount++;
      if (stepCount % stride === 0 || (x === end.x && y === end.y)) anchors.push({ x, y });
    }
  }
  return anchors;
}

const TUTORIAL_ROUTE_VERTICES: Point[] = [
  { x: 0, y: 5 },
  { x: 4, y: 2 },
  { x: 16, y: 2 },
  { x: 4, y: 7 },
  { x: 16, y: 7 },
  { x: 4, y: 2 },
  { x: 19, y: 5 },
];
const TUTORIAL_WAYPOINTS = generateOrthogonalAnchors(TUTORIAL_ROUTE_VERTICES)
  .slice(0, -1)
  .filter(point => point.x !== 10 || point.y !== 5);
const TUTORIAL_VISIBLE_WAYPOINT_INDICES = TUTORIAL_ROUTE_VERTICES.slice(1, -1)
  .map(vertex => TUTORIAL_WAYPOINTS.findIndex(point => point.x === vertex.x && point.y === vertex.y))
  .filter((index, position, indices) => index >= 0 && indices.indexOf(index) === position);

// 產生困難關卡的散落古代石柱 (避開路徑附近的起點、終點與檢查點)
function generateHardObstacles(): Point[] {
  const pts: Point[] = [];
  const cols = 80;
  const rows = 40;
  
  // 檢查是否太靠近特定保護點
  const protectPoints = [
    { x: 0, y: 5 }, { x: 79, y: 35 }, // 起終點
    { x: 15, y: 35 }, { x: 30, y: 5 }, { x: 45, y: 35 }, { x: 60, y: 5 } // 檢查點
  ];
  
  const isProtected = (x: number, y: number): boolean => {
    for (const pt of protectPoints) {
      // 距離 3 格內都保護，確保尋路暢通不會被完全堵死
      if (Math.abs(pt.x - x) <= 3 && Math.abs(pt.y - y) <= 3) return true;
    }
    return false;
  };

  // 每隔一定間距放置 2x2 石柱
  for (let x = 8; x < cols - 8; x += 10) {
    for (let y = 4; y < rows - 4; y += 8) {
      if (!isProtected(x, y) && !isProtected(x + 1, y + 1)) {
        pts.push({ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 });
      }
    }
  }

  // 加上額外幾條不規則斷牆
  pts.push(...generateRectPoints(22, 18, 22, 24));
  pts.push(...generateRectPoints(52, 12, 52, 18));
  
  return pts;
}

export const MAPS: MapConfig[] = [
  // 0. 測試關卡 (怪獸與砲台觀賞室)
  {
    id: 'test_level',
    name: '【測試】砲台與怪物觀賞室',
    difficulty: '測試',
    description: '測試關卡：1.地圖尺寸 20x10，網格放大 4 倍。2.怪物HP無限、金錢無限、基地HP無限。3.只能透過放棄按鈕結束關卡，不提供天賦點。可以用來清楚觀察所有怪物與砲台的圖片與動畫！',
    spawnPoint: { x: 0, y: 5 },
    basePoint: { x: 19, y: 5 },
    waypoints: [
      { x: 5, y: 2 },
      { x: 10, y: 7 },
      { x: 15, y: 2 }
    ],
    obstacles: [],
    presentation: {
      motif: 'showcase',
      featureTags: ['演武測試', '無限資源'],
      strategy: '自由生成敵人與砲台，專注觀察動畫與數值。',
      previewAccent: '#8b5cf6',
    },
    dimensions: { cols: 20, rows: 10, tileSize: 64, overview: true }
  },
  // 1. 教學關卡（之字折返：中央贈塔可重複覆蓋多段道路）
  {
    id: 'tutorial',
    name: '【教學】清風折廊',
    difficulty: '教學',
    description: '之字折返的全圖試煉場。開場贈送中央烈焰塔，讓同一座塔能反覆覆蓋數段道路，再依序學習岩壁改道、合成與波次控制。',
    spawnPoint: { x: 0, y: 5 },
    basePoint: { x: 19, y: 5 },
    waypoints: TUTORIAL_WAYPOINTS,
    visibleWaypointIndices: TUTORIAL_VISIBLE_WAYPOINT_INDICES,
    obstacles: [],
    initialTowers: [{ typeId: 'fire', x: 10, y: 5, locked: true }],
    tutorialHints: {
      wallTiles: [{ x: 9, y: 2 }, { x: 10, y: 2 }, { x: 11, y: 2 }],
    },
    presentation: {
      motif: 'zigzag',
      featureTags: ['之字折返', '中央贈塔', '一次改道'],
      strategy: '贈送的烈焰塔位於折返中央，可對同一批敵人形成多段火力覆蓋。',
      focusPoint: { x: 10, y: 5 },
      expectedAttackWindows: 5,
      previewAccent: '#c75b35',
      terrainProps: [
        { x: 1, y: 1, atlasCell: 1 }, { x: 18, y: 1, atlasCell: 2 },
        { x: 2, y: 8, atlasCell: 3 }, { x: 17, y: 8, atlasCell: 15 },
      ],
    },
    dimensions: { cols: 20, rows: 10, tileSize: 64, overview: true }
  },
  
  // 2. 簡單關卡（六芒星：中心陣眼反覆進出射程）
  {
    id: 'easy',
    name: '【簡單】六合星陣',
    difficulty: '簡單',
    description: '兩道三角路線交織成六芒星。將烈焰塔放在中央陣眼，可讓同一隻地面怪反覆離開並進入射程，形成六段火力窗口。',
    spawnPoint: { x: 20, y: 0 },
    basePoint: { x: 0, y: 6 },
    waypoints: [
      { x: 20, y: 2 }, { x: 21, y: 4 }, { x: 22, y: 6 },
      { x: 24, y: 9 }, { x: 25, y: 11 }, { x: 26, y: 13 }, { x: 27, y: 14 },
      { x: 25, y: 14 }, { x: 23, y: 14 }, { x: 21, y: 14 },
      { x: 19, y: 14 }, { x: 17, y: 14 }, { x: 15, y: 14 }, { x: 13, y: 14 },
      { x: 14, y: 12 }, { x: 15, y: 10 }, { x: 17, y: 9 },
      { x: 18, y: 5 }, { x: 19, y: 3 }, { x: 20, y: 2 },
      { x: 18, y: 3 }, { x: 16, y: 4 }, { x: 14, y: 5 }, { x: 13, y: 6 },
      { x: 15, y: 6 }, { x: 17, y: 6 }, { x: 19, y: 6 },
      { x: 21, y: 6 }, { x: 23, y: 6 }, { x: 25, y: 6 }, { x: 27, y: 6 },
      { x: 26, y: 8 }, { x: 25, y: 10 }, { x: 24, y: 12 },
      { x: 22, y: 15 }, { x: 21, y: 17 }, { x: 20, y: 18 },
      { x: 19, y: 16 }, { x: 18, y: 14 }, { x: 17, y: 12 },
      { x: 15, y: 9 }, { x: 14, y: 7 }, { x: 13, y: 6 },
    ],
    visibleWaypointIndices: [0, 6, 13, 23, 30, 36],
    obstacles: [],
    presentation: {
      motif: 'hexagram',
      featureTags: ['六芒折返', '中央陣眼', '六段火力'],
      strategy: '推薦在 (20, 10) 放置射程 4 的烈焰塔；地面怪會六度進出射程。',
      focusPoint: { x: 20, y: 10 },
      expectedAttackWindows: 6,
      previewAccent: '#9a6a28',
      terrainProps: [
        { x: 5, y: 3, atlasCell: 1 }, { x: 34, y: 3, atlasCell: 2 },
        { x: 5, y: 16, atlasCell: 3 }, { x: 34, y: 16, atlasCell: 15 },
      ],
    },
    dimensions: { cols: 40, rows: 20, tileSize: 32, overview: true }
  },
  
  // 3. 中等關卡 (山脈雙峽谷)
  {
    id: 'normal',
    name: '【中等】山脈裂谷通道',
    difficulty: '中等',
    description: '中等難度：地圖中間有兩道厚實的縱向天然山脈阻擋，分別在上方與下方留有唯一的峽谷通道。你必須利用山脈天然的屏障，在通道口擺放牆壁引導怪物。',
    spawnPoint: { x: 0, y: 10 },
    basePoint: { x: 79, y: 30 },
    waypoints: [
      { x: 18, y: 30 }, // 檢查點 1
      { x: 36, y: 10 }, // 檢查點 2
      { x: 54, y: 30 }  // 檢查點 3
    ],
    obstacles: [
      // 左側屏障山脈 (上方封閉，下方開口)
      ...generateRectPoints(26, 0, 28, 26),
      // 右側屏障山脈 (下方封閉，上方開口)
      ...generateRectPoints(50, 12, 52, 39),
    ]
  },
  
  // 4. 困難關卡 (九曲廢墟迷宮)
  {
    id: 'hard',
    name: '【困難】古代廢墟遺蹟',
    difficulty: '困難',
    description: '高難度挑戰：地圖上遍佈了無法拆除的古代遺跡石柱與斷壁殘垣。空間極為擁擠且曲折，請巧妙地用岩壁塔將廢墟石柱串聯起來，做成精巧的防禦陣線。',
    spawnPoint: { x: 0, y: 5 },
    basePoint: { x: 79, y: 35 },
    waypoints: [
      { x: 15, y: 35 }, { x: 30, y: 5 }, { x: 45, y: 35 }, { x: 60, y: 5 }
    ],
    obstacles: generateHardObstacles()
  },

  // 5. 盤蛇古陣 (螺旋向心)
  {
    id: 'spiral',
    name: '【簡單+】盤蛇古陣',
    difficulty: '簡單',
    description: '路徑從外圍順時針螺旋向中心盤旋，怪物在彎道處堆疊，是 AOE 與減速鏈的絕佳獵場。',
    spawnPoint: { x: 75, y: 2 },
    basePoint: { x: 20, y: 20 },
    waypoints: [
      { x: 75, y: 10 },
      { x: 60, y: 10 },
      { x: 60, y: 30 },
      { x: 30, y: 30 },
      { x: 30, y: 12 },
      { x: 50, y: 12 },
      { x: 50, y: 25 },
      { x: 35, y: 25 },
      { x: 35, y: 18 },
      { x: 20, y: 18 }
    ],
    visibleWaypointIndices: [1, 3, 5, 7, 9],
    obstacles: [
      ...generateRectPoints(62, 0, 64, 8),
      ...generateRectPoints(62, 12, 64, 28),
      ...generateRectPoints(32, 32, 34, 14),
      ...generateRectPoints(32, 14, 34, 10),
      ...generateRectPoints(52, 14, 54, 23),
      ...generateRectPoints(36, 27, 38, 20),
      ...generateRectPoints(36, 20, 38, 16),
      ...generateRectPoints(22, 20, 24, 16),
    ],
    presentation: {
      motif: 'custom',
      featureTags: ['螺旋向心', '彎道堆疊', 'AOE 獵場'],
      strategy: '在螺旋彎道內側放置烈焰塔與冰凍塔，怪物會反覆經過射程。',
      focusPoint: { x: 45, y: 20 },
      expectedAttackWindows: 4,
      previewAccent: '#065f46',
    },
    dimensions: { cols: 80, rows: 40, tileSize: 24 }
  },

  // 6. 陰陽裂界 (三線合流)
  {
    id: 'rift',
    name: '【中等+】陰陽裂界',
    difficulty: '中等',
    description: '三條獨立通道從左側匯向右方基地，中途合流為一。三路防禦考驗經濟分配，合流處是最後防線。',
    spawnPoint: { x: 3, y: 5 },
    basePoint: { x: 76, y: 20 },
    waypoints: [
      { x: 20, y: 5 },
      { x: 35, y: 10 },
      { x: 50, y: 18 },
      { x: 65, y: 20 }
    ],
    visibleWaypointIndices: [0, 1, 2, 3],
    obstacles: [
      ...generateRectPoints(10, 0, 12, 3),
      ...generateRectPoints(10, 7, 12, 13),
      ...generateRectPoints(10, 15, 12, 25),
      ...generateRectPoints(10, 27, 12, 33),
      ...generateRectPoints(10, 35, 12, 39),
      ...generateRectPoints(25, 7, 27, 9),
      ...generateRectPoints(25, 15, 27, 25),
      ...generateRectPoints(25, 30, 27, 33),
      ...generateRectPoints(45, 0, 47, 16),
      ...generateRectPoints(45, 24, 47, 39),
      ...generateRectPoints(60, 0, 62, 18),
      ...generateRectPoints(60, 22, 62, 39),
    ],
    presentation: {
      motif: 'custom',
      featureTags: ['三線合流', '三路防禦', '經濟壓力'],
      strategy: '用岩壁塔封閉 1-2 條路線迫使怪物繞行，集中火力於合流區。',
      focusPoint: { x: 50, y: 20 },
      expectedAttackWindows: 3,
      previewAccent: '#7c3aed',
    },
    dimensions: { cols: 80, rows: 40, tileSize: 24 }
  }
];

// ============================================================
// 自訂地圖 localStorage 持久化
// ============================================================

const CUSTOM_MAPS_KEY = 'td_custom_maps';

export function loadCustomMaps(): MapConfig[] {
  try {
    const raw = currentSaveStorage.getItem(CUSTOM_MAPS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MapConfig[];
  } catch {
    return [];
  }
}

export function saveCustomMaps(maps: MapConfig[]): void {
  currentSaveStorage.setItem(CUSTOM_MAPS_KEY, JSON.stringify(maps));
}

export function deleteCustomMap(mapId: string): void {
  const maps = loadCustomMaps().filter(m => m.id !== mapId);
  saveCustomMaps(maps);
}
