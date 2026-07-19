---
name: fiction-editor
description: (Self-Fusion / 單模型版) Use ONLY for fiction writing, novel chapters, short stories, or narrative content editing in single-model IDE environments (e.g. Antigravity). Provides multi-perspective literary critique via role-based subagents on the same underlying model, then produces a final revised draft. Triggers on: 小說, 章節, 故事, fiction, novel, chapter, narrative, prose, 修改文章, 編輯, edit chapter, revise story. Do NOT use for code, technical writing, or factual research.
---

# Fiction Editor - Antigravity 2.0 Multi-Perspective Literary Revision Pipeline

本技能專為 **Antigravity 2.0** 系統設計。在無法跨越底層大模型的限制下，透過定義三個不同視角的虛擬編輯子代理（編劇、塑造大師、文筆大師），平行審查小說原文，再由主對話代理（總編輯 Judge）綜合他們的意見，產出高水準的最終修改草稿。

> **適用環境**：本版本（`.agents/skills/`）為**單模型 Self-Fusion** 設計，三位編輯均基於同一底層模型，僅靠角色化提示詞區分視角，適用於 Antigravity 等無法切換模型的 IDE。
> 若你**有多個模型可用**（opencode-go / Google / 第三方 API），請改用 `.opencode/skills/fiction-editor`（真·多模型版，由不同架構模型分別擔任編輯，盲點互補效果更佳）。
> 效能優先序：**不同架構模型 > 同模型 ×2（本版）> 單一模型直答**。

## 核心原則

一篇優秀的小說修改需要同時關注「情節結構」、「人物塑造」與「文筆修辭」三個維度。雖然在 Antigravity 中所有編輯均基於同一個底層大模型，但藉由在 `system_prompt` 中賦予極為具體的寫作偏好與評審視角，子代理能提供比單一回答深邃數倍的批註。

---

## 啟動決策 (Activation Decision)

### ❌ 跳過 Fiction-Editor (直接回答)
- 程式碼審查、編譯出錯排查或技術問題。
- 非敘事性的技術文件、行銷文案或事實性學術寫作。
- 單純的錯字/語法微調（不需要結構性修改）。
- 使用者要求單一模型快速潤飾。

###   啟用 Fiction-Editor (啟動本技能)
- 完整的小說章節修改與評審。
- 需要針對情節結構與節奏給予改進意見。
- 需要深入刻畫角色對話、情感張力或人物性格。
- 使用者上傳一整段故事，並要求「編輯」、「改寫」或「優化文筆」。

---

## Phase 0: 環境偵測與套餐選擇（自動執行）

> **僅在首次觸發或持久化狀態過期時執行。** 檢查專案根目錄 `.fusion/fusion-state.json`。

### Step 0.1 — 載入持久化狀態
1. 檢查 `.fusion/fusion-state.json` 是否存在
2. 存在 + `environment.type == "antigravity-single"` + 未過期（<7 天）：**跳過互動**，直接使用已保存的 `selected_tier.fiction` 啟動 Self-Fusion 編輯
3. 不存在 或 過期：繼續執行 Step 0.2~0.3

### Step 0.2 — 確認環境並讓使用者選擇
1. 確認 `.agents/skills/fiction-editor/SKILL.md` 存在 → Antigravity 單模型 Self-Fusion 環境
2. 若同時偵測到 opencode-go fiction agent：**提示使用者切換**，但也可繼續以 Self-Fusion 執行
3. 使用 `question()` 呈現 Quick / Standard 選項（見下方互動分層選擇表格）

### Step 0.3 — 寫入持久化狀態
將偵測結果與選擇寫入 `.fusion/fusion-state.json`（僅含環境類型與 tier，不含 credential）。

### 套餐重置指令
使用者輸入「**fusion reset**」或「**重置 Fusion**」→ 刪除 `.fusion/fusion-state.json` → 重新偵測。

---

## Phase 0.5: Pre-flight Safety Check（強制預檢）

> **在 Phase 1 派發編輯子代理前必須通過。**

### Step 0.5.1 — 環境相容性確認

確認當前環境為 `antigravity-single`。
- 若 state 記錄與實際不符 → 🟡 **WARN**，自動切換為 Self-Fusion Standard

### Step 0.5.2 — 模型洩漏檢查

確認所有編輯角色**不出現需要外部 provider 的模型**（`opencode-go/*`、`google/*`、`thirdparty/*`）。
- 若有 → 🚫 **BLOCK**（Antigravity 僅能使用 IDE 當前主模型的 Self-Fusion）
  - 選項：[A] 切換為純 Self-Fusion（Quick 或 Standard） / [X] 中止

### Step 0.5.3 — 編輯數量檢查

- Quick (2 editors) / Standard (3 editors) → ✅ 自動通過
- 版本確認：Antigravity Self-Fusion 版，3 位虛擬編輯使用同一底層模型，靠角色化提示詞區分視角

通過後進入 Phase 0（風格攝取）。

---

## 環境確認 (Environment Verification)

> **本檔案（`.agents/skills/`）僅適用於 Antigravity 等單一底層模型的 IDE 環境。**
> 若你的環境具備多模型 token（opencode-go / Google / 第三方API），請改用 `.opencode/skills/fiction-editor`（真·多模型版本，由不同架構模型分別擔任編輯）。
> 兩種環境的組合**不可混用** — Antigravity 環境下所有編輯均基於 IDE 當前主模型，僅靠角色化提示詞區分視角。

## 互動分層選擇 (Interactive Tier Selection)

> **Antigravity Self-Fusion 環境專用。** 所有編輯子代理基於 IDE 當前主模型。Judge 即主對話代理。

向使用者提供兩層選擇（啟動時以 `question()` 呈現）：

```
question(): 「本次編輯深度？」
```

| Tier | 名稱 | 編輯數 | 角色配置 | Token 消耗 | 適用場景 |
|:----:|------|:--------:|---------|:---------:|---------|
| ⚡ | **Quick** | 2 | Plot 編輯 + Prose 編輯（人物意見合併至兩者） | 低（2× 並行） | 快速潤飾、輕量修改 |
| ⭐ | **Standard** | 3 | Plot 編輯 + Character 編輯 + Prose 編輯 | 中（3× 並行） | 完整章節評審（預設） |

> **Quick**：2 編輯模式，情節結構與文筆修辭獨立評審，人物/對話意見由兩位編輯在報告中附帶。Token 消耗最低。
> **Standard**：3 編輯模式，情節、人物、文筆三角獨立評審，最大化盲點覆蓋。三份報告由主代理（Judge）綜合裁決。
> 無論哪個 Tier，均須執行 Phase 0 風格攝取與校準（單模型環境下更需校準以對齊專案風格基線）。

## 工作流階段 (Workflow Phases)

### Phase 0: 風格攝取與校準 (Style Ingestion & Calibration)
> **V5 新增 — 修復「認知誤差」**：單模型環境下更需校準，否則三位虛擬編輯的通用文學標準會抹平專案刻意追求的風格（如白描、冷硬腔、適中節奏）。

讀取原文前，先攝取目標專案風格設定，建立「風格基線」並注入三個子代理：
- **自動發現**：glob 專案根與 `docs/`，尋找 `style-params.json`（量化維度+presets）、`*CONSTRAINTS*.md`（鐵律/禁用詞）、`0*-style*.md`（負面禁令/翻譯腔/長短句量化）、`docs/style-samples/{good,bad}-samples.md`、`0[0-9]-*.md`（背景）
- **建立基線**：active preset 量化目標 + 禁用詞表 + 白描/翻譯腔指令 + 角色聲音鐵律 + 節奏鉤子規則
- **注入**：Phase 2 派發子代理時連同原文附上基線，明示「專案規則覆蓋通用 focus areas」（白描優先、禁詞命中即標記、節奏按 preset 目標值而非「急速爽文」假設）
- **兜底**：無風格檔時用內建基本基線（白描優先、禁 AI 套話、節奏適中），輸出註明已套用基本基線

### Phase 1: 原文讀取與角色定義
讀取使用者輸入的小說原文。在 Antigravity 2.0 中，主代理調用 `define_subagent` 定義以下三個專業編輯子代理：

1.  **Plot & Structure Editor (`plot-editor`)**：
   - **定位**：情節與節奏把關者。
   - **專攻**：起承轉合結構、場景切換、懸念與衝突設計、敘事節奏（太快/太慢/拖沓）、邏輯合理性。
2.  **Character & Emotion Editor (`character-editor`)**：
   - **定位**：人物性格與情感刻畫大師。
   - **專攻**：角色對話語氣是否符合人設、內心活動是否飽滿、情感變化是否合理自然、角色關係動態。
3.  **Prose & Style Editor (`prose-editor`)**：
   - **定位**：文筆與修辭修潤者。
   - **專攻**：用詞精準度、句式多樣性、氛圍感營造、冗詞贅句修剪、文風流暢度。

---

### Phase 2: 平行評審派發 (Parallel Review)

> ⛔ **注意：`general` 子代理的陷阱**
> 
> opencode 的 `general` agent 沒有 model 欄位，會在 Antigravity 中靜默繼承當前 IDE 主模型。若用 `general` 做 Fiction Editor，必須透過**角色化 system_prompt 區分三位編輯**（Plot / Character / Prose），否則等同一個模型未經角色提示就看了三次同一原文——無實際編輯增益。
> 
> **正確做法**：定義三個獨立 subagent 名稱，各賦予不同 system_prompt（見下方角色定義）；不要直接派發未區分角色的 `general`。

主代理調用 `invoke_subagent` 平行啟動上述三個編輯子代理，傳遞小說原文並要求產出結構化的「評審報告」。

> **🎛️ 風格校準**：連同原文附上 Phase 0 風格基線（若有）。**專案規則覆蓋各編輯的通用專攻**：白描優先不「豐富意象」、禁詞命中即標記、節奏對照 preset 目標值（適中≠太慢）、角色聲音鐵律優先於通用「增加 interiority」。無基線時退回通用專攻 + 內建基本基線。

每個子代理須產出：
1. **維度評分**：該維度（如文筆）的 1-10 分評估與理由。
2. **具體批註**：具體到某行或某段的修改意見（指明優缺點）。
3. **具體改寫範例**：針對有瑕疵的段落給出改寫示範。

> **失敗處理**：若某個子代理失敗，在報告中標記 `[FAILED: 編輯角色]`，以剩餘報告繼續 Phase 3，並在最終輸出開頭說明「X/3 編輯成功」。已完成的子代理結果不得丟棄。

---

### Phase 3: 總編輯 (Judge) 綜合改稿 (Final Synthesis)
主代理收集三份報告後，進行對比、歸納共識，並產出綜合性修改成果：

```markdown
## ✍️ Fiction Editor 綜合修訂報告 (Antigravity Self-Fusion)

### 📋 編輯部評審摘要
| 編輯角色 | 關注維度 | 核心診斷 | 評分 (1-10) |
|------|------|------|:---:|
| plot-editor | 情節與結構 | ... | /10 |
| character-editor | 人物與情感 | ... | /10 |
| prose-editor | 文筆與修辭 | ... | /10 |

### ✅ 共識修改建議
三位編輯一致認同需要調整的段落或方向：
- ...

### ⚠️ 分歧修改建議
例如情節編輯認為某段對話需要刪減以加快節奏，而人物編輯認為該對話是展現人設的關鍵。總編輯在此需要進行裁決：
- ...

### 💡 總編輯最終修改版 (Final Revised Chapter)
以下是結合了所有編輯意見後，修訂完成的全新章節內容：

[ 在此輸出修改後的完整小說正文 ]
```

> ⚠️ **字數與品質的權衡（重要）**
>
> - 若使用者**有明確字數限制**（如「約 3000 字」）：總編輯須在修改後核對字數，並明確說明是否符合。
> - 若優先保留某段精彩內容會超出字數：**明確告知使用者取捨**，由作者決定，不要靜默截斷。
> - 若使用者**無字數要求**：以品質為優先，但避免無謂地大幅擴充原文篇幅。
>
> 根據 Fiction Editor V4 Benchmark 實測，字數超標是最常見的「機械扣分」來源，高品質修改可能因此被埋沒——總編輯有責任主動管理這個風險。
