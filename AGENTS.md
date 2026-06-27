# 五行迷宮塔防 — Agent 指南

## 專案概述
- 名稱：五行迷宮塔防 (Wuxing Maze Tower Defense)
- 類型：Web 迷宮塔防遊戲 (HTML5 Canvas)
- 技術棧：TypeScript + Vite + HTML5 Canvas

## 開發指令
- `npm run dev` — 啟動開發伺服器 (Vite HMR)
- `npm run build` — TypeScript 編譯 + Vite 打包
- `npm run preview` — 預覽 production build

## 專案結構
```
src/
  main.ts      — 遊戲主循環、場景管理、輸入處理
  towers.ts    — 砲台系統（五行陰陽七種基礎塔 + 合成）
  enemies.ts   — 怪物系統（六種常規怪 + Boss）
  talent.ts    — 天賦系統（Meta-Progression, localStorage）
  sprites.ts   — 像素美術繪製（所有怪物與砲台）
docs/
  AI_Coding_Guidelines.md — AI 協同開發規範
  GDD.md                  — 遊戲設計文件（核心參考）
  GDD_Template.md         — GDD 模板
index.html     — 入口頁面
```

## 編碼規範 (摘要)
- **KISS**：單一職責、衛句提早返回、避免深層巢狀
- **Data-Driven**：遊戲數值不硬編碼，未來移入 config JSON
- **狀態機**：怪物 (`SPAWNING → MOVING → WAITING → DYING → REACHED_BASE`)、砲台 (`IDLE → ATTACKING`)
- **尋路優化**：事件驅動（僅放置/拆除塔時重新計算）、分幀更新
- **座標系統**：網格座標 `(x, y)` 整數（尋路/擺放）、世界座標 `(px, py)` 實數（渲染/碰撞）

## 天賦系統
- 以 `localStorage` 持久化，key 為 `td_talent_data`
- 多級天賦樹，支援舊存檔自動轉換
- 結算天賦點公式：`max(1, floor(存活波次 / 3))`

## 場景管理
- `MAIN_MENU` / `TALENT_SCREEN` / `BATTLE` / `GAME_OVER` 四場景
- 以 CSS `display: none / flex` 切換

## OpenCode 配置規範
- `opencode.json` 必須符合官方 Schema 規格。使用 `command` 物件來配置自訂快捷命令，而非已棄用或錯誤的 `customCommands` 陣列。
- 每個自訂命令物件應包含 `description`（說明）與 `template`（要執行的命令內容）欄位。
- 隨附的 `verify_opencode.py` 驗證腳本必須保持與 `command` 物件格式一致的檢驗邏輯。

## 防禦性資產載入 (Assets Fallback)
- 為了維持 Vibecoding 快速迭代下的系統穩定性，所有前端外置資產（如 Stable Diffusion 產生的圖片、背景音樂、SFX 音效）之載入必須設計 **Fallback 機制**。
- 若外部資源缺失或載入失敗（如 `Image.onload` / `onerror` 或 `audio.play().catch()`），必須能安全且無縫地回退到原生像素精靈矩陣或 Emoji 渲染，不可中斷遊戲流程。

## 執行權限限制處理
- 當前 Agent 在部分 Windows 開發環境下，執行 `run_command` 終端機指令會被系統拒絕（出現 `Access is denied` 錯誤）。
- 遇此環境限制時，Agent 應主動將寫好的測試腳本或 Git 命令整理成清晰的指令列，引導使用者在本地端手動執行。

