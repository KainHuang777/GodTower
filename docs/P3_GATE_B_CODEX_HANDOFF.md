# P3 Gate B 下次目標系統 — Codex 接手事項

> 本文件記錄 P3 Gate B 中**保留給 Codex（美術產線）**的交接項目與完成狀態。
> 邏輯層已全數完成（交接時為 244 測試綠、52 modules build clean；目前工作區的最新驗證數以 `ROADMAP.md` 為準），
> 以下僅列出視覺/動畫/音效相關的待替換與強化項目。

> 2026-07-18 交接盤點：**9 個交接項目均已完成**。目標圖示改為 code-native SVG；首次達成會顯示粒子並播放現有成功音效，音效不可用時安全無聲回退。畫面仍需在 Antigravity 做最後驗收。

| # | 項目 | 狀態 | 說明 |
|:--:|:---|:---:|:---|
| 1 | 起卦儀式動畫 | ✅ | 程式化五行陣、正五邊形、依序出現、跳過與 fallback 已完成。 |
| 2 | GAME_OVER 目標達成提示 | ✅ | 已實作達成／差一點／挑戰中三態回饋，並有 3 項純函式測試。 |
| 3 | 目標卡片 icon | ✅ | 8 個目標已改用可縮放、主題一致的 code-native SVG icon。 |
| 4 | 紀錄板視覺風格 | ✅ | 紙本格線、狀態色與達成徽章已完成。 |
| 5 | 主選單目標提示 | ✅ | 印章提示、連續嘗試色彩與轉場已完成。 |
| 6 | 天賦頁目標選擇面板 | ✅ | 羊皮紙、青銅、朱砂、鎖定／選取／完成狀態已完成。 |
| 7 | HUD 目標進度 | ✅ | 波次／擊殺／合成目標會在 HUD 顯示即時進度；其他類型自動隱藏。 |
| 8 | 慶祝動畫／音效 | ✅ | 首次達成觸發金色粒子與成功音效；音效不可用時無聲回退。 |
| 9 | CSS 動畫與轉場 | ✅ | 儀式、面板、卡片、提示與 reduced-motion 規則已完成。 |

---

## 目錄

1. [起卦儀式動畫 (Ritual Animation) — High](#1-起卦儀式動畫-ritual-animation--high)
2. [GAME_OVER 目標達成提示 — High](#2-game_over-目標達成提示--high)
3. [目標卡片 Icon 替換 — Low](#3-目標卡片-icon-替換--low)
4. [紀錄板視覺風格 — Medium](#4-紀錄板視覺風格--medium)
5. [主選單目標提示視覺 — Medium](#5-主選單目標提示視覺--medium)
6. [天賦頁目標選擇面板 — Medium](#6-天賦頁目標選擇面板--medium)
7. [HUD 目標進度指示 (v1.1) — Medium](#7-hud-目標進度指示-v11--medium)
8. [慶祝動畫/音效 — Low](#8-慶祝動畫音效--low)
9. [CSS 動畫與轉場 — Medium](#9-css-動畫與轉場--medium)
10. [期望流程圖](#10-期望流程圖)

---

## 1. 起卦儀式動畫 (Ritual Animation) — High（基線完成）

### 現況
- `src/ui/ritual.ts` — `WuxingRitualAssetProvider` 為預設實作
- 以 DOM/CSS 繪製太極、五行方位、卦爻與「五行歸元」；不依賴外部資產
- 約 2.2 秒自動結束；玩家可按跳過或 Space/Enter 立即進入遊戲
- 僅在 provider 載入／播放失敗時顯示「卦象凝結中…」文字 fallback

### 可選：替換為正式資產
TypeScript 介面（已存在，無需改簽名）：

```typescript
export interface RitualAssetProvider {
  loadAssets: () => Promise<void>;  // 載入動畫資源；失敗 reject → 走 fallback
  play: (container: HTMLElement) => void;  // 於 .ritual-stage 播放動畫
  cleanup: () => void;  // 釋放資源；finish() 時自動呼叫
}
```

注入點（已在 `ritual.ts` line 33）：

```typescript
setRitualAssetProvider(myProvider);
```

### DOM 容器

```html
<!-- 由 playOpeningRitual() 動態生成於 document.body -->
<div id="ritual-overlay">
  <div class="ritual-backdrop"></div>           <!-- 半透明黑幕 -->
  <div class="ritual-stage">                    <!-- ← Codex 填入 canvas/img/svg -->
    <!-- 播放動畫的容器，play(container) 接收此元素 -->
  </div>
  <div class="ritual-fallback-text">卦象凝結中…</div>  <!-- loadAssets 失敗時顯示 -->
  <button class="ritual-skip-btn">跳過</button>        <!-- 跳過按鈕 -->
</div>
```

### 規格
- 持續時間：**≤3 秒**
- 跳過：畫面上方「跳過」按鈕 + Space/Enter 鍵盤
- 載入失敗：自動 fallback 到 placeholder 文字「卦象凝結中…」+ 2 秒等待
- 無障礙：`aria-hidden="true"`（overlay 本身）
- `prefers-reduced-motion` 時自動跳過
- 老玩家（同目標嘗試 ≥3 次）儀式可智慧跳過（不需要改 provider，logic 層已在 call 處判斷）

### NoOpRitualAssetProvider 參考實作（用於獨立測試）

```typescript
const NoOpProvider: RitualAssetProvider = {
  loadAssets: () => Promise.resolve(),
  play: () => {},
  cleanup: () => {},
};
```

---

## 2. GAME_OVER 目標達成提示 — High（完成）

### 完成內容
- GAME_OVER 新增 `#goalRunResult`，僅在一般關卡且已選目標時顯示。
- 依現有 `commitEndOfRun()`／`RunStats` 呈現三態：目標達成、接近門檻與挑戰中。
- 教學／測試關、未選目標或無效目標時安全隱藏；存檔失敗仍可顯示本局的即時回饋。

### 需新增
在 GAME_OVER DOM（`#gameOverScreen`）的統計區下方，加入 `.goal-run-result` 元素：

```html
<div id="goalRunResult" class="goal-run-result">
  <!-- 由 JS 動態填入，三種狀態： -->
  <!-- justAchieved=true → 金色大字 "🎉 目標達成：xxx！" -->
  <!-- failure but close → 橙色 "🔥 差一點！wave 14 / 目標 15" -->
  <!-- failure far → 灰色 "📜 挑戰中：xxx" -->
</div>
```

### 邏輯對接
- `commitEndOfRun(data, goalId, runStats, result, now)` 回傳 `{ justAchieved, snapshot }`
- `endBattle()` 在 `switchScene('GAME_OVER')` 前拿到此回傳值
- 可直接在 `battleManager.ts` 中設定 DOM

---

## 3. 目標卡片 Icon 替換 — Low（完成）

### 完成內容
- 新增 `src/ui/goalIcons.ts`，為 8 個目標提供可縮放的 code-native SVG icon。
- 目標卡、主選單提示與紀錄板均改用同一組 SVG，保留 `emoji` 欄位作資料相容 fallback。

### 建議
- 替換為主題一致的 pixel icon / SVG emblem（規格 32×32 或 48×48）
- 五行主題每個目標都對應一個卦象或符號意象
- 若替換，需同時更新 `goal-card-icon` class 的樣式支援

---

## 4. 紀錄板視覺風格 — Medium（完成）

### 現況
- `src/ui/goalBoard.ts` — `renderGoalBoard(container, data)` 渲染 `.goal-board-card`
- CSS 在 `index.html` 的 `<style>` 中（約 70 行基礎樣式）

### 完成內容
- 卡片改為帶朱砂裝訂線的紙本格線，完成目標改用綠色裝訂線。
- 成功、失敗與中途離開維持可辨識的狀態色；`justAchieved` 徽章已加入強調轉場。
- requiresVictory 的「通關挑戰」邏輯沿用既有 renderer，未改動邏輯層。

### DOM 結構（供樣式參考）

```html
<div class="goal-board-card">
  <div class="goal-board-header">紀錄板</div>
  <div class="goal-board-empty">尚無挑戰紀錄</div>  <!-- 無目標時 -->
  <!-- 有目標時 -->
  <div class="goal-board-goal">reach_wave_15</div>
  <div class="goal-board-row">
    <span class="goal-board-label">嘗試次數</span>
    <span class="goal-board-value">3</span>
  </div>
  <div class="goal-board-row">
    <span class="goal-board-label">最近結果</span>
    <span class="goal-board-value result-failure">嘗試未達</span>
  </div>
  <div class="goal-board-row">
    <span class="goal-board-label">最高波次</span>
    <span class="goal-board-value">12</span>
  </div>
</div>
```

---

## 5. 主選單目標提示視覺 — Medium（完成）

### 現況
- `src/ui/goalHint.ts` — `renderGoalHint()` 插入 `.goal-hint-bar`
- 位於 `#btnStartGame` 正上方
- 無目標：「尚未設定下次目標」（灰色）
- 有目標：emoji + label + description
- 已完成：「✓ 已達成」（綠色邊框）
- 新鮮感動畫：`goal-hint-fresh` class（CSS 淡入）

### 完成內容
- 主選單提示改為深木底、金邊與圓形印章，和主選單 CTA 保持可讀的視覺層級。
- 連續嘗試（attempts ≥ 3）會套用橙／紅邊框的 `.goal-hint-persistent` 狀態。

---

## 6. 天賦頁目標選擇面板 — Medium（完成）

### 現況
- `src/ui/goalSelector.ts` — `renderGoalSelector()` 在 `#talentScreen` 內 `#btnBackFromTalent` 前插入 `#goal-panel-v1`
- 兩 tab：select（目標卡片網格）/ board（紀錄板）
- 目標卡片依 `isGoalUnlocked` 顯示/隱藏鎖定
- 已選目標標金色「目前選擇」
- 已達成標 ✓「已達成」

### 完成內容
- 面板改為羊皮紙、青銅邊框與朱砂 tab，與天賦頁圖譜語言對齊。
- 目標卡已具印章、選取朱砂角標、完成綠色紙頁與褪色鎖定狀態。
- `justAchieved` 紀錄板徽章加入彈出轉場；不改既有完成判定或存檔。

### DOM 結構

```html
<div id="goal-panel-v1" class="goal-panel">
  <div class="goal-tab-bar">
    <button class="goal-tab active" data-tab="select">選擇目標</button>
    <button class="goal-tab" data-tab="board">紀錄板</button>
  </div>
  <div class="goal-tab-content" data-tab="select">
    <div class="goal-card-grid">
      <div class="goal-card selected">... </div>
      <div class="goal-card locked">... </div>
      <div class="goal-card completed">... </div>
    </div>
  </div>
  <div class="goal-tab-content" data-tab="board">
    <!-- renderGoalBoard 輸出 -->
  </div>
</div>
```

---

## 7. HUD 目標進度指示 (v1.1) — Medium（完成）

### 完成內容
- 在戰鬥 HUD 新增 `#hudGoalProgress`，以 `🎯 目標名・進度 current/target` 顯示。
- 只顯示可直接量化的 `highestWave`、`killCount`、`mergeCount`，其他目標、未選目標會自動隱藏。
- 跟隨既有 `updateUI()` 週期更新，因此波次、擊殺與合成變化會立即反映。

### 需新增
在戰鬥 HUD（`#battleHud`）中新增極簡目標進度指示器：

```html
<div id="hudGoalProgress" class="hud-goal-progress" style="display:none">
  🎯 wave 10/15
</div>
```

### 規格
- 只在玩家已選目標且該目標存活條件可量化時顯示
- 可量化條件：`highestWave`、`killCount`、`mergeCount`
- 每波結束（`checkWaveEnd`）更新
- 位置：建議在上方 HUD 左側 HP 旁或右上角
- 行內文字即可，不需進度條

---

## 8. 慶祝動畫/音效 — Low（完成）

### 完成內容
- `justAchieved=true` 時，在 GAME_OVER 目標回饋上方播放金色粒子爆發。
- 同時重用既有 `merge_success` 成功音效；音效檔缺失或瀏覽器拒絕播放時由既有音效系統安全 fallback／無聲繼續。

### 期望
- 當 `justAchieved=true`：
  - 紀錄板顯示金色「✓ 已達成」徽章
  - 可選：短時間粒子/光效動畫（由 Codex 決定是否需要）
  - 可選：播放 `achievement_win` SFX（音效系統已有 `merge_success`/`win` 等，新增一個 key）

### 音效檔路徑
- 依 `src/audio/audioSystem.ts` 慣例：`assets/audio/goal_complete.mp3`
- 若檔案缺失 → fallback 無聲（catch `audio.play()`）

---

## 9. CSS 動畫與轉場 — Medium（完成）

### 已完成 CSS class（位於 `index.html <style>`）
| class | 作用 | 完成狀態 |
|-------|------|----------|
| `.goal-hint-fresh` | 主選單目標提示轉場 | 已完成 |
| `.goal-hint-persistent` | 連續挑戰橙／紅提示 | 已完成 |
| `.goal-card-selected` | 朱砂選取框與「已擇」角標 | 已完成 |
| `.goal-card-completed` | 綠色完成紙頁 | 已完成 |
| `.goal-card-locked` | 褪色鎖定紙頁 | 已完成 |
| `.ritual-*` | overlay、五行位移與 fallback | 已完成 |
| `.goal-board-fresh` | 剛剛達成徽章轉場 | 已完成 |

---

## 10. 期望流程圖

```
天賦頁選目標
  ↓  目標卡片 icon（美術替換）
主選單提示（hint bar 視覺強化）
  ↓
點「開始遊戲」
  ┣━ 首玩 → 跳過儀式 → 進教學
  ┗━ 老玩家 → 起卦儀式動畫（Codex 替換） → 關卡選擇
  ↓
戰鬥中（v1.1 HUD 進度指示）
  ↓
結算（commitGoalRunResult）
  ↓
GAME_OVER（目標達成提示，Codex 實作）
  ↓
主選單（hint bar 更新，justAchieved 徽章）
  ↓
天賦頁（board tab，justAchieved 金徽章）
       （celebrate 動畫/音效，Codex 決定）
```

---

## 檔案對照總表

| Codex 需動的檔案 | 職責 | 邏輯依賴 |
|-----------------|------|----------|
| `src/ui/ritual.ts` | 已完成程式化五行儀式；可選替換為真實動畫資產 | 不碰 `playOpeningRitual()` 流程邏輯 |
| `src/battle/battleManager.ts` | 新增 GAME_OVER goal-run-result DOM | 讀 `commitEndOfRun` 回傳值 |
| (新增) `assets/audio/goal_complete.mp3` | 達成音效 | 選用，無則 fallback |
| `index.html` (style 區) | 所有 `.goal-*/ritual-*` CSS 樣式替換 | 保留 class 名稱 |
| `src/config/goals.json` | 目標 emoji → icon 路徑（可選） | 改 `emoji` 欄位值 |

**不應修改的檔案**（邏輯層，美術不需觸碰）：

- `src/goals/*.ts` — 所有純邏輯
- `src/talent.ts` — 存檔與 migration
- `src/scenes/scenesManager.ts` — 場景接線
- `src/input/inputHandler.ts` — 主選單接線
- `src/state.ts` — 遊戲狀態
- `src/config/goals.json` — 目標定義（除非改 icon）
- `src/__tests__/*.test.ts` — 測試

> **原則**：邏輯層禁止 import 美術資源或寫死路徑。
> 所有視覺資源應透過 `RitualAssetProvider` 或 `imageAssetCache` 掛載。
> 若需新增掛載點，請在 `src/ui/workflow.md` 或本文件提案修改。
