# 美術資源清單 (Art Asset Manifest)

> 本文件定義遊戲所有精靈圖的命名規範、儲存路徑、SD 提示詞參數，以及導入狀態追蹤。
> 所有外部圖片資源均需提供 PNG 透明背景版本，配合 `sprites.ts` 的 `imageAssetCache` Hybrid 渲染機制使用。
>
> **批量產圖工具：** `sd_batch_generate.py`（專案根目錄）

---

## 目錄結構規範

```
assets/
  sprites/
    enemies/           ← 怪物精靈圖
    towers/            ← 基礎砲台精靈圖
    towers_lv2/        ← 同系 Lv2 合成塔精靈圖
    towers_recipe/     ← 異系配方合成塔精靈圖
    ui/                ← UI 元素（未來擴充）
```

---

## 命名規範

| 類型 | 命名格式 | 範例 |
|------|----------|------|
| 怪物 | `{typeId}.png` | `snake.png` |
| 基礎塔 | `{typeId}.png` | `fire.png` |
| Lv2 同系塔 | `{typeId}.png` | `fire_2.png` |
| 配方合成塔 | `{typeId}.png` | `wood_fire.png` |

**對應 `imageAssetCache` 的 key 格式：**
- 怪物：`enemy_{typeId}` → 路徑 `assets/sprites/enemies/{typeId}.png`
- 基礎塔：`tower_{typeId}` → 路徑 `assets/sprites/towers/{typeId}.png`
- Lv2 塔：`tower_{typeId}` → 路徑 `assets/sprites/towers_lv2/{typeId}.png`
- 配方塔：`tower_{typeId}` → 路徑 `assets/sprites/towers_recipe/{typeId}.png`

---

## 圖片規格

| 項目 | 規格 |
|------|------|
| 格式 | PNG（必須支援 Alpha 透明通道） |
| 背景 | 完全透明（去背後的結果） |
| 怪物尺寸 | 64×64 px（Boss 為 96×96 px） |
| 基礎塔尺寸 | 64×64 px |
| 合成塔尺寸 | 64×64 px |
| 風格 | 像素藝術 (pixel art)，8-bit / 16-bit 風格，符合中國風五行主題 |

---

## 怪物精靈清單

| #  | typeId | 中文名 | 屬性 | 檔名 | 狀態 |
|----|--------|--------|------|------|------|
| 1  | `snake` | 小蛇 | 木 | `assets/sprites/enemies/snake.png` | 🟢 已完成 |
| 2  | `fly` | 小蒼蠅 | 金（飛行） | `assets/sprites/enemies/fly.png` | 🟢 已完成 |
| 3  | `salamander` | 火蜥蜴 | 火 | `assets/sprites/enemies/salamander.png` | 🟢 已完成 |
| 4  | `water_spirit` | 水靈 | 水 | `assets/sprites/enemies/water_spirit.png` | 🟢 已完成 |
| 5  | `golem` | 石傀儡 | 土 | `assets/sprites/enemies/golem.png` | 🟢 已完成 |
| 6  | `beetle` | 金甲蟲 | 金 | `assets/sprites/enemies/beetle.png` | 🟢 已完成 |
| 7  | `boss_dragon` | 龍影（Boss） | 火（飛行） | `assets/sprites/enemies/boss_dragon.png` | 🟢 已完成 |

---

## 基礎砲台精靈清單

| #  | typeId | 中文名 | 屬性 | 檔名 | 狀態 |
|----|--------|--------|------|------|------|
| 1  | `fire` | 烈焰塔 | 火 | `assets/sprites/towers/fire.png` | 🟢 已完成 |
| 2  | `water` | 冰凍塔 | 水 | `assets/sprites/towers/water.png` | 🟢 已完成 |
| 3  | `wood` | 纏繞塔 | 木 | `assets/sprites/towers/wood.png` | 🟢 已完成 |
| 4  | `earth` | 岩壁塔 | 土 | `assets/sprites/towers/earth.png` | 🟢 已完成 |
| 5  | `metal` | 鏡刃塔 | 金 | `assets/sprites/towers/metal.png` | 🟢 已完成 |
| 6  | `yin` | 暗影塔 | 陰 | `assets/sprites/towers/yin.png` | 🟢 已完成 |
| 7  | `yang` | 聖光塔 | 陽 | `assets/sprites/towers/yang.png` | 🟢 已完成 |

---

## Lv2 同系合成塔精靈清單

> Lv2 塔視覺上應比 Lv1 更宏偉，加上光暈、能量紋路等強化視覺效果。

| #  | typeId | 中文名 | 屬性 | 檔名 | 狀態 |
|----|--------|--------|------|------|------|
| 1  | `fire_2` | 烈焰塔 Lv2 | 火 | `assets/sprites/towers_lv2/fire_2.png` | 🟢 已完成 |
| 2  | `water_2` | 冰凍塔 Lv2 | 水 | `assets/sprites/towers_lv2/water_2.png` | 🟢 已完成 |
| 3  | `wood_2` | 纏繞塔 Lv2 | 木 | `assets/sprites/towers_lv2/wood_2.png` | 🟢 已完成 |
| 4  | `earth_2` | 岩壁塔 Lv2 | 土 | `assets/sprites/towers_lv2/earth_2.png` | 🟢 已完成 |
| 5  | `metal_2` | 鏡刃塔 Lv2 | 金 | `assets/sprites/towers_lv2/metal_2.png` | 🟢 已完成 |
| 6  | `yin_2` | 暗影塔 Lv2 | 陰 | `assets/sprites/towers_lv2/yin_2.png` | 🟢 已完成 |
| 7  | `yang_2` | 聖光塔 Lv2 | 陽 | `assets/sprites/towers_lv2/yang_2.png` | 🟢 已完成 |

---

## 異系配方合成塔精靈清單

| #  | typeId | 中文名 | 配方 | 屬性 | 檔名 | 狀態 |
|----|--------|--------|------|------|------|------|
| 1  | `wood_fire` | 焚林塔 | 木＋火 | 火 | `assets/sprites/towers_recipe/wood_fire.png` | 🟢 已完成 |
| 2  | `fire_earth` | 熔岩塔 | 火＋土 | 土 | `assets/sprites/towers_recipe/fire_earth.png` | 🟢 已完成 |
| 3  | `earth_metal` | 鍛造塔 | 土＋金 | 金 | `assets/sprites/towers_recipe/earth_metal.png` | 🟢 已完成 |
| 4  | `metal_water` | 寒鐵塔 | 金＋水 | 水 | `assets/sprites/towers_recipe/metal_water.png` | 🟢 已完成 |
| 5  | `water_wood` | 靈木塔 | 水＋木 | 木 | `assets/sprites/towers_recipe/water_wood.png` | 🟢 已完成 |
| 6  | `yin_yang` | 太極塔 | 陰＋陽 | 陰 | `assets/sprites/towers_recipe/yin_yang.png` | 🟢 已完成 |

---

## 狀態圖例

| 圖示 | 狀態說明 |
|------|----------|
| ⬜ | 未產：尚未生成 |
| 🟡 | 已產圖：SD 已生成原始圖，尚未去背/導入 |
| 🟢 | 已完成：去背完成，已放置於正確目錄 |
| ❌ | 問題：圖片有瑕疵或路徑錯誤，需要重新產圖 |

---

## 導入後的 main.ts 初始化片段（參考）

```typescript
// 在遊戲啟動時（例如 startBattle() 或 initGame() 內）呼叫：
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
await Promise.all(imagePreloads.map(([key, src]) => preloadImage(key, src)));
```
