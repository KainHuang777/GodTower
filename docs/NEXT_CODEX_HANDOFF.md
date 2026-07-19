# 五行迷宮塔防 — 下一階段 Codex 美術接手事項

> 本文件記錄 P1 內容擴充階段中**保留給 Codex（美術產線）**的視覺／動畫／音效交接項目。
> 邏輯層與 #1 成就通知已完成（當前驗證：298 tests／14 files，65 modules build clean），
> 以下僅列出視覺/動畫/音效相關的待實作與強化項目。

> 2026-07-19 更新：#2 MORE 系統 SVG icon、#4 圖鑑 UI 翻新、#5 圖鑑／成就進度條與 #6 核心 UI 改造已完成；#6 已追加完成關卡選擇紙本路線卡與戰場地形質感第一輪（高細節草地、固定裝飾、外置素材 fallback、Lv1 塔縮尺），並以出口置中的 16 格專用道路 autotile 取代偏心參考圖集的道路拼接。同步完成教學「清風折廊」、初級「六合星陣」與可組合道路地塊。圖鑑 Tab 天賦連線殘留亦已修正。已確認順序：銀級成就邏輯與設定完成後才實作 #1 通知；Lv2／配方／詞條資料進入 config 後才補 #3 Lore。驗證：278/278 tests、64 modules build clean。
>
> 2026-07-19 更新（第三次）：銀級成就系統與 #1 成就通知動畫已實作完成。驗證：298/298 tests、65 modules build clean；待 Antigravity 人工目視確認。

| # | 項目 | 狀態 | 優先級 | 依賴 |
|:--:|:---|:---:|:---:|:---|
| 1 | 成就解鎖通知動畫 | ✅ | High | 無（銀級成就邏輯已完成） |
| 2 | MORE 系統（SVG icon 置換 emoji） | ✅ | High | 無 |
| 3 | 圖鑑 Lore 補完（新條目文案） | ⏳ | Medium | 銀級成就 config 完成後 |
| 4 | 圖鑑 UI 翻新（東方像素風格） | ✅ | Medium | 無 |
| 5 | 圖鑑進度條視覺 | ✅ | Low | 項目 4 完成後 |
| 6 | Codex UI 美術改造（已核准範圍） | ✅ | Optional | 共用基礎＋HUD＋主選單＋關卡選擇 |

## 執行順序（2026-07-19）

1. ✅ **MORE 系統 SVG icon（#2）**：已完成，作為後續圖鑑 UI 的共同基礎。
2. ✅ **圖鑑 UI 翻新（#4）**：已接入 SVG icon，完成紙本／青銅視覺語言。
3. ✅ **圖鑑進度條（#5）**：已完成五行漸變圖鑑條與 tier 成就條。
4. ✅ **成就解鎖通知（#1）**：已完成通知掛鉤與 DOM overlay；不修改純邏輯。
5. **進階圖鑑 Lore（#3）**：等待 Lv2、配方塔與詞條圖鑑資料進入 config 後補完。
6. ✅ **全域 Codex UI 改造（#6）**：已完成共用視覺基礎、戰鬥 HUD、主選單與關卡選擇紙本路線卡；卡牌、彈窗、結算與羅盤圖鑑仍未核准。

---

## 1. 成就解鎖通知動畫 — High

### 現況
- 成就判定在 `src/collection/state.ts`（純函式 `evaluateAchievements`）
- 戰鬥掛鉤在 `src/battle/battleManager.ts`、`src/physics/physics.ts`、`src/battle/towerActions.ts`
- **目前成就解鎖無任何視覺通知**——僅寫入 `collectionCompleted` 陣列，玩家需手動到天賦頁圖鑑 Tab 查看

### 需求
在戰鬥中（或結算時）即時顯示成就解鎖通知：

```
┌─────────────────────────┐
│  🏆 成就解鎖！           │
│  五十斬                  │
│  累計擊殺 50 隻怪物       │
│         [ 收起 ]         │
└─────────────────────────┘
```

### 規格
- **觸發時機**：`physics.ts` 擊殺判定／`towerActions.ts` 合成判定／`battleManager.ts` 結算時，若 `evaluateAchievements()` 回傳新解鎖成就
- **顯示位置**：戰鬥 Canvas 上方 HUD 區塊，使用 DOM overlay（非 Canvas 渲染）
- **動畫**：從頂部滑入 → 停留 3 秒 → 自動淡出（玩家可點擊提早關閉）
- **佇列**：若同時解鎖多個成就，依序顯示（每次顯示一個，完成後顯示下一個）
- **音效**：可選短暫「叮」聲（使用既有音效系統，`assets/audio/goal_complete.mp3` 或新增 `achievement_unlock.mp3`）
- **無障礙**：`role="status"` + `aria-live="polite"`
- **reduced-motion**：跳過滑入動畫，直接顯示

### 視覺風格
- 背景：深木色或羊皮紙橫幅，金色邊框（與目標系統視覺語言一致）
- 圖示：金色獎盃 SVG（code-native，不需外部資產）
- 文字：金色大字「🏆 成就解鎖！」+ 白色成就名 + 灰色描述
- 五行色點綴：依成就 tier 不同（銅＝青銅色、銀＝銀白色）

### 完成內容（2026-07-19）
- 新增 `src/ui/achievementNotify.ts`：固定 DOM overlay、3 秒自動收起、可點擊收起、單張依序佇列、`role="status"`／`aria-live="polite"` 與 reduced-motion 回退。
- 以 code-native 獎盃 SVG 與深木色／銀白 tier 視覺呈現，使用既有 `merge_success` 音效及其合成音 fallback。
- 在擊殺、合成與結算三條 `evaluateAchievements()` 回傳新成就的路徑接上通知；純邏輯與成就 config 未修改。
- 自動驗證：298/298 tests 通過、65 modules production build clean；待 Antigravity 人工目視確認。

### 掛鉤點參考
```typescript
// src/collection/state.ts — 已存在
function evaluateAchievements(
  current: CollectionSaveData,
  config: CollectionConfig
): { newlyCompleted: string[] }

// 戰鬥中取得 newlyCompleted 後呼叫：
function showAchievementUnlockNotification(achievementIds: string[]): void
```

### 不應修改的檔案
- `src/collection/*.ts` — 純邏輯層
- `src/collection/state.ts` — 成就判定邏輯
- `src/battle/battleManager.ts` — 戰鬥流程（僅新增通知呼叫點）
- `src/config/collection.json` — 成就定義

---

## 2. MORE 系統（SVG icon 置換 emoji）— High

### 現況
- `src/ui/collectionTab.ts` 第 5-9 行定義 `BESTIARY_EMOJI` map
- 圖鑑卡片、成就卡片目前使用系統 emoji（🐍🪰🦎💧🗿🪲🐲🔥❄️🌿⛰️⚔️🌑☀️）
- 系統 emoji 在不同平台顯示不一致，且與 pixel art 風格不協調

### 需求
將所有 emoji 替換為 code-native SVG icon，符合 pixel art / 東方奇幻視覺語言

### 圖示清單（需 14 枚）

| ID | 當前 emoji | 主題意象 |
|:---|:---:|:---|
| snake | 🐍 | 翠綠小蛇盤繞 |
| fly | 🪰 | 六翅金蠅 |
| salamander | 🦎 | 赤紅火蜥蜴吐焰 |
| water_spirit | 💧 | 藍色水靈流體 |
| golem | 🗿 | 棕褐石傀儡厚重 |
| beetle | 🪲 | 金甲蟲堅殼 |
| boss_dragon | 🐲 | 暗紅龍影展翼 |
| fire | 🔥 | 烈焰塔火紋核心 |
| water | ❄️ | 冰凍塔六角冰晶 |
| wood | 🌿 | 纏繞塔藤葉螺旋 |
| earth | ⛰️ | 岩壁塔岩層疊砌 |
| metal | ⚔️ | 鏡刃塔刃鋒交錯 |
| yin | 🌑 | 暗影塔幽月蝕影 |
| yang | ☀️ | 聖光塔日輪光暈 |

### 規格
- 尺寸：32×32 SVG viewbox（同 `src/ui/goalIcons.ts` 做法）
- 風格：低風格化像素感、2 色主色 + 1 色描邊、五行色票對應
  - 木＝`#69B84A`、火＝`#EE6638`、土＝`#B77A45`、金＝`#F2C14E`、水＝`#4CA7D8`
  - 陰＝`#6656A8`、陽＝`#F5D85A`
- 描邊：1.5px `#2A1F14`
- 每個 icon 可辨識灰階輪廓（元素色輔助辨識）
- 載入方式：inline SVG（直接嵌入 DOM，無外部請求）

### 實作參考
```typescript
// 新增檔案：src/ui/collectionIcons.ts
// 與 src/ui/goalIcons.ts 相同模式

export function getCollectionIcon(id: string): string {
  // 回傳 inline SVG string
}
```

### 不應修改的檔案
- `src/collection/*.ts` — 純邏輯層
- `src/config/collection.json` — 資料配置
- `src/__tests__/collection.test.ts` — 測試

---

## 3. 圖鑑 Lore 補完 — Medium

### 現況
- 14 條圖鑑各有 1 句 Lore（30-60 字），詳見 `src/config/collection.json`
- 已存在：7 怪物 + 7 基礎塔

### 待新增條目（銀級成就階段開放的進階圖鑑）

#### Lv2 同系合成塔 ×7
| ID | label | element | 建議 Lore |
|:---|:---|:---:|:---|
| fire_2 | 烈焰塔 Lv2 | fire | (待 Codex 撰寫) |
| water_2 | 冰凍塔 Lv2 | water | (待 Codex 撰寫) |
| wood_2 | 纏繞塔 Lv2 | wood | (待 Codex 撰寫) |
| earth_2 | 岩壁塔 Lv2 | earth | (待 Codex 撰寫) |
| metal_2 | 鏡刃塔 Lv2 | metal | (待 Codex 撰寫) |
| yin_2 | 暗影塔 Lv2 | yin | (待 Codex 撰寫) |
| yang_2 | 聖光塔 Lv2 | yang | (待 Codex 撰寫) |

#### 異系配方合成塔 ×5
| ID | label | element | 建議 Lore |
|:---|:---|:---:|:---|
| wood_fire | 焚林塔 | 木＋火 | (待 Codex 撰寫) |
| fire_earth | 熔岩塔 | 火＋土 | (待 Codex 撰寫) |
| earth_metal | 鍛造塔 | 土＋金 | (待 Codex 撰寫) |
| metal_water | 寒鐵塔 | 金＋水 | (待 Codex 撰寫) |
| water_wood | 靈木塔 | 水＋木 | (待 Codex 撰寫) |
| yin_yang | 太極塔 | 陰＋陽 | (待 Codex 撰寫) |

#### 詞條圖鑑 ×3（整合 `seenTraits`）
| ID | label | 建議 Lore |
|:---|:---|:---|
| trait_armor | 護甲 | (待 Codex 撰寫) |
| trait_regen | 再生 | (待 Codex 撰寫) |
| trait_split | 分裂 | (待 Codex 撰寫) |

### 格式
- 每條 30-80 字文言白話皆可，以五行世界觀為基調
- 可參考既有風格：「木氣所化，遊走於草莽之間，性敏而體弱。」

---

## 4. 圖鑑 UI 翻新（東方像素風格）— Medium（完成）

### 現況
- 圖鑑 Tab 位於天賦頁內 (`#tab-collection`)
- 目前沿用 dark theme web prototype 樣式（深藍灰底、8px 圓角卡片、半透明背景）
- CSS 定義在 `index.html` 第 160-254 行（`.collection-tab-panel` 等）
- 與 P2-E 已完成的「靈蘭藏象圖」天賦頁古書框架風格不協調

### 需求
將圖鑑面板改為與天賦頁一致的東方像素／紙本風格：

- **背景**：淺米紙 `#F2DFA7` 或淡青 `#D6E8D4`，取代深藍灰
- **卡片**：羊皮紙質感，朱砂或青銅邊框，取代半透明深色卡片
- **圖示**：使用項目 2 完成的 SVG icon，取代 emoji
- **標題**：毛筆風格標題字，「萬獸圖鑑」「成就」使用玉印或木刻匾額樣式
- **鎖定狀態**：褪色紙頁 + 雲紋鎖，取代 opacity 0.55
- **完成狀態**：綠色紙頁 + 金印「✓」，取代單純綠色邊框
- **進度區**：紙本統計條，與天賦頁「紀錄板」視覺語言一致

### 完成內容
- 圖鑑面板改為羊皮紙章頁、深木標題牌、青銅印章與朱砂角飾。
- 已解鎖卡、完成成就、進行中成就與鎖定卡分別使用紙本、綠印、朱砂與褪色紙頁狀態。
- SVG icon 置入青銅印章框；桌面自適應網格與橫向 Mobile 單欄規則已加入。
- 本項僅翻新視覺；進度條留給 #5。

### 依賴
- 需要項目 2（SVG icon）完成後一併替換
- 可參考 `index.html` 中 `.goal-*` 系列的 CSS 風格（羊皮紙、青銅、朱砂）

### 不應修改的檔案
- `src/ui/collectionTab.ts` — 保留 DOM 結構與 class 名稱
- `src/collection/*.ts`、`src/config/collection.json` — 邏輯與資料層

---

## 5. 圖鑑進度條視覺 — Low（完成）

### 現況
- `src/ui/collectionTab.ts` 第 79-88 行已有純文字統計（「圖鑑 5/14」「成就 3/8 (37%)」）
- 無視覺進度條

### 需求
在統計區加入彩色進度條：

```
圖鑑進度  ████████░░  8/14  (57%)
成就進度  ██████░░░░  3/8   (37%)
```

- 圖鑑進度條色：五行漸變（金→木→水→火→土）
- 成就進度條色：依最高達成 tier（銅＝青銅、銀＝銀白、金＝金色）
- 寬度：100% 容器，高度 12px
- 圓角：2px pixel 風格直角

### 完成內容
- 圖鑑進度以金→木→水→火→土的五行漸變呈現。
- 成就進度依目前最高已完成 tier 顯示青銅、銀白或金色。
- 進度數量、百分比與 `role="progressbar"`／ARIA 數值同步輸出，橫向 Mobile 可縮排顯示。

### 依賴
- 可在項目 4（UI 翻新）時一併完成

---

## 6. Codex UI 美術改造（參考提案）— Optional

### 本輪核准與完成範圍（2026-07-19）
- ✅ 共用視覺基礎：正式化紙本／青銅／玉色 token、像素外框、陰影、控制尺寸與 11 枚共用 SVG symbol。
- ✅ 主選單：建立「守塔令」指令面板、三個主要操作 SVG 圖示；844×390 採品牌／指令左右雙欄，避免上下裁切。
- ✅ 戰鬥 HUD：生命／金幣／波次／擊殺改為帶圖示及元素色底線的實體徽章；檢視／合成／拆除／圖鑑／更多／下一波使用共用圖示。
- ✅ 關卡選擇：紙本路線卡、程式化地圖縮圖、戰術標籤、火力窗口提示與鍵盤操作。
- ⏸ 未核准選修：卡牌、彈窗、結算與羅盤式圖鑑重製。

### 說明
`docs/CODEX_UI_ART_QUALITY_PROPOSAL.md` 記載了全面性的 UI 美術改造提案（2026-07-12 草案），包含：

- 主選單場景插畫與動態像素背景
- 戰鬥 HUD 實體徽章取代半透明面板
- 天賦頁太極核心佈局（已部分完成於 P2）
- 羅盤式圖鑑（Canvas radial layout）
- 9-slice 像素面板材質系統
- 像素 Icon 統一替換所有 emoji

此項為選修範圍，需專案擁有者決策後啟動。

---

## 檔案對照總表

| Codex 需動的檔案 | 職責 | 邏輯依賴 |
|-----------------|------|----------|
| `src/ui/collectionTab.ts` | SVG icon 置換、UI 翻新 | 不碰 collection 邏輯 |
| (新增) `src/ui/collectionIcons.ts` | 14 枚 SVG icon 定義 | 項目 2 |
| (新增) `src/ui/achievementNotify.ts` | 成就解鎖通知 overlay 與動畫 | 項目 1，呼叫 `evaluateAchievements` |
| `index.html` (style 區) | 所有 `.collection-*` CSS 替換 | 保留 class 名稱 |
| `src/config/collection.json` | 新增 Lv2/配方/詞條 Lore 文案 | 保留 data structure |
| (新增) `assets/audio/achievement_unlock.mp3` | 解鎖音效 | 選用，無則 fallback |
| `docs/CODEX_UI_ART_QUALITY_PROPOSAL.md` | 大型 UI 改造參考 | 需決策後啟動 |

### 不應修改的檔案（邏輯層，美術不需觸碰）
- `src/collection/*.ts` — 所有純邏輯
- `src/talent.ts` — 存檔與 migration
- `src/physics/physics.ts` — 擊殺判定
- `src/battle/battleManager.ts` — 戰鬥流程
- `src/battle/towerActions.ts` — 合成邏輯
- `src/__tests__/*.test.ts` — 測試

> **原則**：邏輯層禁止 import 美術資源或寫死路徑。
> 所有視覺資源應透過 DOM class 或 inline SVG 掛載。
> 若需新增掛載點，請在 Codex 端提案。
