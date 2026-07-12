// ============================================================
// src/maps.ts — 關卡地圖配置與平台存檔持久化
// ============================================================

import { currentSaveStorage } from './system/platform';
import type { Point } from './types';

export interface MapConfig {
  id: string;
  name: string;
  difficulty: '教學' | '簡單' | '中等' | '困難' | '自訂' | '測試';
  description: string;
  spawnPoint: Point;
  basePoint: Point;
  waypoints: Point[];
  obstacles: Point[]; // 預設天然地形阻擋的網格點
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
    obstacles: []
  },
  // 1. 教學關卡 (引導玩家使用 W 折返迷宮)
  {
    id: 'tutorial',
    name: '【教學】W型折返走廊',
    difficulty: '教學',
    description: '教學關卡：由於下方長長的地形障礙物阻擋，怪物出發後會先被迫向右繞行到 3 號檢查點入口才得以上行前往 1 號檢查點。請跟隨提示在右側瓶頸處建造攻擊塔，發揮交叉火力！',
    spawnPoint: { x: 5, y: 20 },
    basePoint: { x: 75, y: 20 },
    waypoints: [
      { x: 20, y: 10 }, // 檢查點 1
      { x: 40, y: 30 }, // 檢查點 2
      { x: 60, y: 10 }  // 檢查點 3
    ],
    obstacles: [
      // 橫向主隔離牆：迫使怪物必須向右走到 x=56 之後的開口才能上去
      ...generateRectPoints(0, 15, 55, 15),
      // 1 號點左側阻擋：封住左上角，防止怪物走捷徑
      ...generateRectPoints(12, 0, 12, 14),
      // 2 號點左側阻擋：在二號點左側隔離，防止起點怪直接走到二號點
      ...generateRectPoints(35, 18, 35, 39),
      // 3 號點右側阻擋：引導三號點的怪往右下出發去基地
      ...generateRectPoints(65, 0, 65, 14),
    ]
  },
  
  // 2. 簡單關卡 (經典平原，原版配置)
  {
    id: 'easy',
    name: '【簡單】九曲河谷',
    difficulty: '簡單',
    description: '明亮河谷中的五段彎曲古道。道路以圓角連續方式呈現，保留開闊建造空間，適合熟悉五行塔與迷宮改道。',
    spawnPoint: { x: 0, y: 26 },
    basePoint: { x: 79, y: 15 },
    waypoints: [
      { x: 12, y: 17 }, { x: 26, y: 29 }, { x: 40, y: 11 }, { x: 54, y: 26 }, { x: 68, y: 9 }
    ],
    obstacles: []
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
