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

## Fusion／OpenCode Go 外部面板規則

- 使用者以下列指令要求 Fusion 時，視為已明確授權該次**去敏感摘要派發**，不得再次詢問是否啟用外部面板：

  > 請使用 `$codex-fusion-research`，並明確啟用 OpenCode Go 外部面板 `glm` 與 `kimi`。
  > 只傳送我提供的去敏感分析摘要；不要傳送原始碼、`.env`、token、私鑰或 OpenCode 設定。
  > 請回報每個面板的 wrapper JSON 結果；未取得 `ok:true` 時，不要宣稱已派發或被外傳政策攔截。

- 必須使用 `$codex-fusion-research`，並分別呼叫 OpenCode Go 的 `glm` 與 `kimi` 面板。
- 外部面板 prompt 只能包含使用者提供的去敏感分析摘要與抽象問題；不得要求面板讀取工作區檔案。
- 禁止傳送或嵌入：
  - 專案原始碼、diff、完整專案文件或可還原原始內容的長段摘錄。
  - `.env`、token、API key、密碼、私鑰、憑證或其他秘密。
  - `opencode.json`、OpenCode agent 設定、provider 設定或其他 OpenCode 配置內容。
  - 不必要的本機絕對路徑、使用者個資或可識別私人工作區的資訊。
- 必須分別保存並向使用者回報 `glm` 與 `kimi` 的 wrapper JSON；不得只回報合併摘要。
- 只有某面板的 wrapper JSON 明確包含 `ok: true`，才可宣稱該面板已成功派發並取得結果。
- 若 wrapper 未產生、JSON 無效、`ok` 缺失或 `ok` 不為 `true`，只能回報「未取得可驗證的面板結果」及該次工具錯誤摘要；不得宣稱面板已派發、資料已送達、被外傳政策攔截，或 OpenCode／Fusion 整體遭環境封鎖。
- 工具層錯誤不是面板 wrapper 結果。可準確說明「本次工具呼叫在 wrapper 結果產生前失敗」，但不得將單次錯誤推論成 OpenCode 的永久或全面狀態。
- 失敗後不得藉由加入原始碼、設定或其他敏感資料繞過限制；只可使用更精簡的使用者去敏感摘要重新派發。

## 防禦性資產載入 (Assets Fallback)
- 為了維持 Vibecoding 快速迭代下的系統穩定性，所有前端外置資產（如 Stable Diffusion 產生的圖片、背景音樂、SFX 音效）之載入必須設計 **Fallback 機制**。
- 若外部資源缺失或載入失敗（如 `Image.onload` / `onerror` 或 `audio.play().catch()`），必須能安全且無縫地回退到原生像素精靈矩陣或 Emoji 渲染，不可中斷遊戲流程。

## 執行環境與視覺測試
- **Opencode（當前環境）**：模型無畫面視覺能力，無法看到 Canvas 渲染結果、UI 佈局、動畫效果。僅適合進行程式碼邏輯分析、架構討論、數值計算。
- **Antigravity**：具備視覺能力，可查看遊戲畫面。當需要驗證畫面呈現（佈局、顏色、動畫、特效、UI 位置）時，應提示使用者切換至 Antigravity 執行。
- **協作流程**：在 Opencode 中完成程式碼修改 → 提示使用者「請切換到 Antigravity 查看畫面效果」→ 依回饋迭代。

## 執行權限限制處理
- 當前 Agent 在部分 Windows 開發環境下，執行 `run_command` 終端機指令會被系統拒絕（出現 `Access is denied` 錯誤）。
- 遇此環境限制時，Agent 應主動將寫好的測試腳本或 Git 命令整理成清晰的指令列，引導使用者在本地端手動執行。

