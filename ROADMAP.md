# 🗺️ 五行迷宮塔防 — 開發路線圖 (ROADMAP)

> 狀態標記：✅ 已完成｜🚧 進行中｜📋 計劃中

---

## 任務恢復指示

開始新任務時，先讀取本 Roadmap → 檢查程式碼與 `npm test` / `npm run build` 結果 → 以程式碼為準更新本文件。

---

## Project Overview

| 項目 | 內容 |
|:---|:---|
| 專案目標 | 五行、陰陽、迷宮建構為核心的 HTML5 Canvas 塔防遊戲 |
| 目前階段 | P1 收尾中（程式碼層面完成，僅剩 4 隻新怪物正式像素精靈待 Codex 美術） |
| 核心功能 | A* 尋路、7 基礎塔+合成、元素相剋（含陰陽互剋）、波次/Boss、Roguelike 卡牌、天賦持久化、Ascension 難度、教學關卡、五行圖鑑+成就、目標系統 v2、11 種怪物+6 張地圖 |
| 技術棧 | TypeScript + Vite + HTML5 Canvas；網格座標（邏輯）/ 世界座標（渲染）；外置資產具 fallback；尋路事件驅動 |
| 非目標 | WebGL、手把、Steam/iOS/Android、AI 高清精靈 |

---

## Current Task Context

| 欄位 | 內容 |
|:---|:---|
| 任務 | P1 收尾 — 待 Codex 像素精靈替換 |
| 狀態 | 🚧 進行中（程式碼完成，僅剩美術） |
| 已完成 | 目標系統 v2（17 goals）、4 新怪物+2 新地圖邏輯、陰陽相剋、新詞條系統、圖鑑 v1.4.0（34 條+Lore）、SVG icon 38 枚、成就通知、難度選擇、UI 翻新 |
| 待完成 | 無；4 隻新怪物正式 24×24 像素精靈矩陣與 2 幀動畫已完成，待畫面驗收 |
| 驗證 | 311 tests／14 files、build 65 modules clean（2026-07-24） |

---

## Technical Decisions

| 決策 | 原因 | 不可輕易改變 |
|:---|:---|:---|
| Canvas 2D 優先 | 瓶頸在 drawImage 次數；快取優先 | 新視覺不得破壞 tile/道路快取與 60 FPS |
| 標準 80×40/16px；教學可覆寫 | 教學 20×10/64px 全圖展示 | 戰鬥核心不得硬編碼教學尺寸 |
| 原生像素精靈為正式視覺 | AI 圖在小網格模糊；fallback 保可玩性 | 外置資產失敗必須回退程式繪製 |
| 塔=牆體，事件驅動重算尋路 | 迷宮建構是核心玩法 | 不得因視覺改變網格/碰撞/封路規則 |
| 天賦視覺：藏象×任督×易象 | 可使用五藏官職、任督太極八卦 | 不宣稱醫療效果；太極八卦不冒稱《內經》原圖 |
| 天賦改名只改顯示層 | 古典主名提升氛圍，機制副標維持可讀性 | TalentId/數值/前置/門檻/存檔 key 不得改變 |
| 天賦存檔 key: `td_talent_data` | 對齊規範，舊 key 可 fallback | 新存檔只寫正式 key，讀取先正式後舊 key |
| 經脈頁：古書 raster + SVG fallback | 生成圖負責筆觸，HTML 負責互動 | 正/背人體分離；節點文字不烘焙進圖片 |
| 天賦頁正式名稱：靈蘭藏象圖 | 呼應《素問・靈蘭秘典論》典藏意象 | UI 可保留「五行經脈・天賦修習」作副標 |

---

## Files and Components

| 檔案 | 用途 | 狀態 |
|:---|:---|:---|
| `src/main.ts` | 遊戲主循環、場景管理、輸入處理 | 穩定 |
| `src/sprites.ts` | 像素精靈矩陣（怪物/塔/地圖 tile） | 4 新怪物 24×24、各 2 幀已接線 |
| `src/towers.ts` / `src/enemies.ts` | 塔/怪物定義與合成邏輯 | 穩定 |
| `src/battle/` | 戰鬥核心（physics/battleManager/towerActions/pathfinding/difficulty） | 穩定 |
| `src/goals/` | 目標系統 v2（types/config/state/migrate） | 新增 |
| `src/collection/` | 圖鑑+成就系統（types/config/state/migrate） | 新增 |
| `src/ui/` | UI 元件（collectionTab/collectionIcons/achievementNotify/goalSelector/goalHint/goalBoard/ritual） | 新增/穩定 |
| `src/talent.ts` | 天賦資料、經脈頁渲染 | 穩定 |
| `src/config/*.json` | 資料驅動配置（enemies/towers/waves/goals/collection/maps） | 穩定 |
| `src/renderer/` | Canvas 渲染（gameRenderer/tileCache/particles） | 穩定 |
| `src/input/` | 輸入處理（inputHandler/buildPlacement） | 穩定 |
| `src/system/` | Roguelike 卡牌、天賦持久化 | 穩定 |
| `src/__tests__/` | Vitest 測試（14 檔，311 項） | 穩定 |
| `docs/NEXT_CODEX_HANDOFF.md` | P1 Codex 美術交接文件 | 待啟動 |
| `docs/TALENT_MERIDIAN_PHASE2_PLAN.md` | 天賦頁二階規劃 | P2-A~E 已完成 |

---

## Verification

| 最新驗證 | 311/311 tests（14 檔）、build 65 modules clean（2026-07-24） |
|:---|:---|
| 歷史基準 | P0~P3 Gate B 全部通過，最新基準 311 tests |
| 測試命令 | `npm test`（Vitest）/ `npm run build`（tsc && vite build） |
| 已知錯誤 | 無 |
| 未驗證 | 4 新怪物正式像素精靈視覺（待 Antigravity） |

---

## 下一步決策

| Gate | 範圍 | 狀態 | 證據 |
|:---|:---|:---:|:---|
| P1 Codex 美術 | 4 新怪物像素精靈 | ✅ 程式完成 | 24×24／2 幀矩陣，待畫面驗收 |
| P2-E 視覺 Gate | 天賦經脈頁 | ✅ 關閉 | P2-A~E 文件/測試/視覺 |
| P3 Gate A | 元素抗性+反雪球 | ✅ 關閉 | 194/194、build 42 |
| P3 Gate B | 目標系統 v1 | ✅ 關閉 | 240/240、build 54 |
| 五行圖鑑+成就 | 圖鑑 34 條+成就 20 項 | ✅ 關閉 | 311/311、build 65 |
| 難度選擇 | 簡單/普通/困難 | ✅ 關閉 | 311/311、build 65 |
| P4（延後） | 平台抽象/Tauri/天象輪 | 📋 | 待玩家回饋 |

---

## Roadmap 索引

| 里程碑 | 內容 |
|:---|:---|
| 目前 | P1 收尾（待 Codex 精靈） |
| 下一步 | P1 完成 → 玩家回饋循環（正式版後） |
| 後續 | P2 成長曲線重構 → P3 深度整合 → P4 打磨上線 |
| 原則 | 先 bug/測試/效能，再擴增高成本內容 |

---

## Task History（近期）

| 日期 | 任務 | 摘要 |
|:---|:---|:---|
| 2026-07-24 | P1 進度盤點 | 確認程式碼層面完成，僅剩 4 新怪物精靈待 Codex |
| 2026-07-23 | P1 目標系統 v2 | 17 goals、遞歸條件、獎勵體系、目標鏈；311/311 tests |
| 2026-07-23 | P1 新詞條系統 | 4 trait 詞條自動解鎖；302/302 tests |
| 2026-07-23 | P1 新地圖+怪物+陰陽相剋 | 4 新怪物+2 新地圖+yin↔yang +30%；302/302 tests |
| 2026-07-23 | P1 Lore+圖鑑進度條 | 30 條 lore 古典中文+五行漸變進度條；278/278 tests |
| 2026-07-19 | 圖鑑 expansion | Lv2/配方/詞條 16 條目；302/302 tests |
| 2026-07-19 | 成就通知+難度選擇 | DOM overlay 通知+3 級難度；298/298 tests |
| 2026-07-19 | 核心 UI 改造 | 視覺 token+11 SVG+主選單+HUD+關卡選擇；269/269 tests |
| 2026-07-18 | P3 Gate B 美術交接 | CSS/DOM 五行陣+羊皮紙視覺；240/240 tests |
| 2026-07-17 | P3 Gate B 最小切片 | goals/邏輯+UI+接線；244/244 tests |
| 2026-07-16 | P3 Gate A | 抗性階梯+退款+低血救濟；194/194 tests |
| 2026-07-15~16 | P2-C/D/E 天賦視覺 | 古書/人體 SVG/五色經線/響應式；189/189 tests |

> 完整歷史（P0~P2-B 逐項紀錄）保留於 git 歷史與舊版 Roadmap。

---

## 既有 Phase 清單（摘要）

### ✅ Phase 0 — 初始化
遊戲設計調研、AI 開發指南、GDD 模板

### ✅ Phase 1 — 核心系統
場景管理、天賦 Meta-Progression、7 基礎塔+合成、6 怪物+Boss、像素精靈

### ✅ Phase 2 — 系統優化
數值平衡、多級天賦、路線預覽、任意位置合成

### ✅ Phase 3 — 內容完善
6 異系合成塔實裝、售塔、波次進度列、統計面板

### ✅ Phase 4 — 視覺升級
圖片快取+Hybrid 渲染、行動適放、粒子特效、音效系統、4 地圖主題、動態天氣

### ✅ Phase 4.5 — 像素風升級
16×16/16×24 精靈矩陣、多幀動畫、地板 Tile、像素 UI、Outlines/閃白/Splatters

### ✅ Phase 4.6 — 自適應優化
雙向縮放、座標精確映射、Audio Pool、BGM Fallback、Debug 工具

### ✅ Phase 4.8 — 東方像素美術
明亮暖色山水、Console HUD、生物輪廓、連續岩壁、高密度塔身
