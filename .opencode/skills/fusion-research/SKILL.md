---
name: fusion-research
description: Use ONLY when the user asks complex research, architecture design, multi-faceted analysis, or strategic decision questions. Implements OpenRouter Fusion-style multi-model collaborative reasoning. Triggers on keywords: research, analyze deeply, compare models, architecture decision, multi-perspective, pros and cons, evaluate options, 分析, 研究, 比較, 評估. Do NOT use for simple coding, file operations, or single-answer questions.
---

# Fusion Research - Multi-Model Collaborative Analysis

This skill implements a multi-model "Fusion" pipeline inspired by OpenRouter Fusion, adapted for opencode's agent system. When a complex question is detected, dispatch it to multiple panel agents (each with a different model architecture) in parallel, then act as Judge to synthesize the results.

> **適用環境**：本版本（`.opencode/skills/`）使用**不同架構模型**作為 panel，需要多模型 token 環境，盲點互補效果最佳。
> 若你在 Antigravity 等**僅單一底層模型**的 IDE 運行，請改用 `.agents/skills/fusion-research`（單模型 Self-Fusion 版）。

## Core Principle

**不同架構的模型有不同的推理風格與擅長領域，同時發問、平行收集、綜合裁判，能有效涵蓋彼此的盲點。**

Reference research data (OpenRouter Fusion DRACO benchmark):
- Solo DeepSeek V4 Pro: 60.3%
- Self-Fusion (Opus 4.8 ×2, same model as Judge): 58.8% → 65.5% (+6.7 分)
- Multi-model Fusion (3 diverse models): 64.7% ~ 69.0%
- Best Solo (Claude Fable 5): 65.3%

> 註：Self-Fusion（同模型 ×2）是 OpenRouter 原始研究中正式存在的合法組合，並非禁忌。優先順序為「不同架構模型 > 同模型 ×2 > 單一模型」。上述 +6.7 分為 DRACO 上 Opus 4.8 的實測值。

### ⚠️ Critical Rule: Judge Bias Avoidance

**Judge 必須與所有 Panel 使用不同架構的模型**，否則會產生系統性偏差（模型傾向認同自己的輸出，即使提示詞不同）。

OpenRouter Fusion 研究報告指出 Judge 偏差會造成 10~25 分的絕對分數差異。

- 當 Judge 為 DeepSeek V4 Pro 時 → Panel 不得包含 DeepSeek 系列模型
- 當 Judge 為 GLM-5.2 時 → Panel 不得包含 GLM 系列模型
- **Self-Fusion** 是合法的例外（同模型做 Judge + Panel，DRACO 上 Opus 4.8 達 +6.7 分）。這是因為合成步驟本身新增價值，但仍需意識到存在 Judge 偏差。它是「無多模型環境時的次優選擇」，仍優於單一模型直接回答

**模型家族相容性快查（配置任何 Fusion 流水線前務必對照）：**

| Judge 模型 | 禁止同家族 Panel | 允許的 Panel 家族（示例） |
|---|---|---|
| DeepSeek V4 Pro/Flash | DeepSeek 全系（Pro / Flash / V3.x） | Kimi / Qwen / GLM / Gemini / Mimo / Claude |
| GLM-5.2 | GLM 全系 | DeepSeek / Kimi / Qwen / Gemini / Mimo / Claude |
| Kimi K2.7 | Kimi 全系 | DeepSeek / Qwen / GLM / Gemini / Mimo / Claude |
| Qwen3.7 Plus | Qwen 全系 | DeepSeek / Kimi / GLM / Gemini / Mimo / Claude |

> **📚 教訓案例（Fiction Editor V4 Benchmark）**：V4 流水線中 Plot Editor 用 `deepseek-v4-flash`、Judge 用 `deepseek-v4-pro`——兩者同屬 DeepSeek 家族，違反本規則。後果有二：(1) Plot 編輯評審眼界被 #18 模型封頂；(2) 同家族偏差未被察覺，是 Fusion 輸給單模型的關鍵根因之一。V5 已將 Plot Editor 升級為 `glm-5.2`（不同家族）修復。**教訓：規則只在 fusion-research 明文不夠，必須在每條 Fusion 流水線（含 fiction-editor）配置時逐項核查 Judge × Panel 家族組合。**

## Phase 0: 環境偵測與套餐選擇（自動執行)

> **僅在首次觸發或持久化狀態過期時執行。** 檢查專案根目錄 `.fusion/fusion-state.json`。

### Step 0.1 — 載入持久化狀態
1. 檢查 `.fusion/fusion-state.json` 是否存在
2. 存在 + 未過期（`detected_at` < 7 天前）：**跳過 Step 0.2~0.4**，直接使用已保存的 `selected_tier` 啟動 Fusion
3. 不存在 或 過期：繼續執行 Step 0.2~0.4

### Step 0.2 — 環境偵測（不讀取 provider 的 apiKey）
1. 讀取 `opencode.jsonc` 的 `agent` 區塊 → 列舉所有 `fusion-*` agent 名稱（**不讀取 `provider` 的 apiKey/bearerToken**）
2. 檢查 `.agents/skills/` 目錄是否存在
3. 判定環境：
   - `fusion-*` agents ≥ 3 且多數 model 為 `opencode-go/*` → **opencode-multi**（使用本檔案）
   - 無 `fusion-*` 但有 `.agents/skills/fusion-research/SKILL.md` → **antigravity-single**（跳轉 `.agents/skills/fusion-research`，Self-Fusion 模式）
   - 兩者皆有 → 以 **opencode-multi** 為主，`.agents/` 為備援
4. 列舉可用 provider：opencode-go / google / thirdparty（僅根據 agent 中 model 前綴判斷，不讀取 provider 配置區塊）

### Step 0.3 — 生成套餐並讓使用者選擇
根據可用 agent 自動生成三層套餐（見下方「Interactive Tier Selection」表格），使用 `question()` 向使用者呈現。若某些 provider 不可用，自動從套餐中排除對應 Panel（例如無 Google API key → Standard 降為 4-panel，不含 Gemini）。

### Step 0.4 — 寫入持久化狀態
```jsonc
// .fusion/fusion-state.json（僅含 agent 名稱與選擇，不含 credential）
{
  "version": 1,
  "detected_at": "ISO-timestamp",
  "environment": { "type": "opencode-multi", "confidence": "high" },
  "available_providers": ["opencode-go", "google", "thirdparty"],
  "available_agents": { "research": ["fusion-kimi", ...], "fiction": [...] },
  "selected_tier": { "research": "standard", "fiction": "standard" }
}
```

### 套餐重置指令
使用者輸入「**fusion reset**」或「**重置 Fusion**」→ 刪除 `.fusion/fusion-state.json` → 下次觸發時重新執行 Step 0.2~0.4。

---

## Phase 0.5: Pre-flight Safety Check（強制預檢）

> **在 Phase 1 派發任何 panel 前必須通過此閘道。** 若有失敗則阻斷執行，直到使用者選擇修復或降級。

### Step 0.5.1 — 解析 Combo 並驗證存在性

讀取 `opencode.jsonc` 的 `agent` 區塊，將選定 combo 的每個 panel agent 名稱解析為實際 `model` ID。

- 任何 agent 名稱在 `opencode.jsonc` 中不存在 → 🚫 **BLOCK：AGENT_NOT_FOUND**
  - 訊息：「`{agent_id}` 未在 opencode.jsonc 註冊。請檢查配置或執行 `fusion reset` 重新偵測。」
  - 選項：[A] 自動從套餐移除該 panel / [M] 手動修復 opencode.jsonc / [X] 中止

### Step 0.5.2 — Provider 可用性檢查

解析每個 model ID 的 provider 前綴：

| Model 前綴 | Provider | 檢查方式 |
|---|---|---|
| `opencode-go/` | opencode-go | 內建，自動通過（opencode 自身提供） |
| `google/` | Google Gemini | 檢查 `provider.google.options.apiKey` 非空 |
| `thirdparty/` | 第三方 API | 檢查 `provider.thirdparty.options.apiKey` 與 `baseURL` 非空 |
| `antigravity/` | Antigravity CLI (agy) | 用 `bash: agy --version` 或 `powershell: Get-Command agy` 檢查本地 `agy` 命令可用 |

- 所需 provider 未配置 → 🔴 **ERROR：PROVIDER_CREDENTIAL_MISSING**
  - 受影響 panel：列出所有依賴缺失 provider 的 agent
  - 選項：[A] 自動降級（移除受影響 panel，以剩餘 panel 繼續） / [M] 手動補上 provider 配置後重試 / [C] 略過（該 panel 執行時將失敗） / [X] 中止

> **安全規則**：預檢過程**只讀取 `provider.*.options` 的存在性**（欄位是否為空），**絕不回顯、不記錄、不寫入任何 apiKey 的值**。

### Step 0.5.3 — 模型家族衝突檢查（Judge Bias）

比對 Judge 家族 vs 每個 Panel 家族。已知家族對照：

| Family | 匹配關鍵字 | 與 Judge(DeepSeek) 相容？ |
|---|---|---|
| `deepseek` | `deepseek-*` | ❌ 衝突 |
| `kimi` | `kimi-*` | ✅ |
| `qwen` | `qwen*` | ✅ |
| `glm` | `glm-*` | ✅ |
| `gemini` | `gemini-*` | ✅ |
| `claude` | `claude-*` | ✅ |
| `mimo` | `mimo-*` | ✅ |

- 任一 Panel 的 family 與 Judge family 相同（Self-Fusion tier 除外）→ 🔴 **ERROR：JUDGE_BIAS_VIOLATION**
  - 訊息：「Judge（{judge_family}）與 Panel `{agent_id}`（{panel_family}）同家族，將造成 10~25 分系統性裁判偏差。」
  - 選項：[A] 自動替換（尋找同 provider 的其他 family 替代） / [M] 手動選擇替代 panel / [C] 略過（須二次確認） / [X] 中止

### Step 0.5.4 — Panel 完整性檢查

- 有效 panel 數 < 2 → 🚫 **BLOCK：PANEL_COUNT_TOO_LOW**（不可繞過）
  - 選項：[A] 自動降級到下一個 tier / [X] 中止
- 重複的 agent_id → 🟡 **WARN：DUPLICATE_PANEL**（自動去重，繼續執行）
- opencode-multi 環境下所有 panel 同一家族 → 🟡 **WARN：INSUFFICIENT_DIVERSITY**（提示但允許繼續）

### Step 0.5.5 — General Agent 誤用檢查

`opencode.jsonc` 中的 `general` agent **沒有 model 欄位**，若被選用為 subagent_type，會**靜默繼承主對話模型**（目前為 DeepSeek V4 Pro），導致：
- Judge Bias 衝突（Judge + Panel 同家族）
- 架構多樣性喪失（退化成同模型 ×2）

- 若任何 panel agent 被錯誤映射為 `general` 或 `subagent_type: "general"` → 🟡 **WARN：GENERAL_AGENT_FALLBACK**
  - 訊息：「`general` subagent 無指定模型，將繼承主對話模型（DeepSeek V4 Pro），可能違反 Judge Bias 規則。」
  - 選項：[A] 自動替換為可用 fusion agent（如 fusion-kimi/fusion-qwen 等） / [M] 手動選擇替換 / [C] 略過（風險自負）

### Step 0.5.6 — 整合結果

所有檢查通過（或使用者已處理完所有 BLOCK/ERROR）後：
- 更新 `.fusion/fusion-state.json`，記錄 `preflight.last_ok_at`
- 進入 Phase 1

若使用者選擇中止：回退為單模型直接回答，不啟動 Fusion。

---

## Activation Decision

ALWAYS evaluate the user's question against this triage checklist BEFORE answering:

### Progressive Triage (先做輕量判斷，再決定啟動規模)

在決定是否啟動 Fusion 之前，先快速評估問題的**複雜度 × 不確定性**：

1. **直接回答**（不啟動 Fusion）：
   - Simple coding task (write a function, fix a bug)
   - File read/write operations
   - Single-fact lookup
   - Short, unambiguous question with a clear correct answer
   - User explicitly requests a single model answer

2. **啟動 Fusion**（問題需同時滿足：多面向 + 高不確定性 + 不同視角有增益）：
   - Research/deep analysis question
   - Architecture or design decision with real trade-offs
   - Multi-faceted comparison or evaluation (A vs B with no obvious winner)
   - Strategic planning with competing priorities
   - 使用者用中文問複雜問題，且問題無單一標準答案

> **防止誤觸發**：「分析」、「研究」、「比較」等詞單獨出現不足以啟動 Fusion。
> 必須確認問題確實有多個合理視角，且增加 panel 能帶來實質增益。
> 例：「比較兩個函數的效能」→ 直接回答（有客觀答案）；「比較兩種架構的長期維護成本」→ 啟動 Fusion（視角依賴多）。

## Workflow

### Phase 1: Triage & Prompt Design

Analyze the user's question and craft panel-specific prompts:
1. Extract the core question
2. Design 2-3 perspective-specific prompts (each panel gets a different angle)
3. Each prompt should be self-contained and include the original question

**Prompt design guidelines (example with Judge = DeepSeek V4 Pro):**
- Panel 1 (Kimi/Technical): Focus on technical accuracy, data, logic
- Panel 2 (Qwen/Broad): Focus on comprehensiveness, context, practical implications
- Panel 3 (GLM/Alternative): Focus on creative angles, edge cases, counterarguments

**Always verify Judge != any Panel model.** Refer to the Judge Bias rule above.

### Phase 2: Panel Dispatch (Parallel)

> ⛔ **CRITICAL：嚴禁使用 `subagent_type: "general"`**
> 
> `opencode.jsonc` 中的 `general` agent（第 119 行）**沒有 model 欄位**，會靜默繼承主對話模型（DeepSeek V4 Pro）。這會：
> 1. 違反 Judge Bias 規則（Judge 與 Panel 同屬 DeepSeek 家族 → 10~25 分偏差）
> 2. 喪失多模型架構多樣性（退化成 Self-Fusion 而非真·多模型）
> 
> **替代方案**（依當前 Combo Tier 選擇）：

| 若你正要使用 `general` 當... | 應改用 | 原因 |
|---|---|---|
| 技術深度 Panel | `fusion-kimi` 或 `fusion-deepseek` | 都有獨立架構，Kimi 無 Bias、DeepSeek 標記衝突 |
| 綜合分析 Panel | `fusion-qwen` | Qwen3.7+ 不同家族，綜合能力佳，成本低 |
| 創意/逆向 Panel | `fusion-glm` | GLM-5.2 中文理解強，與 Judge(DeepSeek) 不同架構 |
| 低成本 Panel | `fusion-budget-mimo` 或 `fusion-budget-ds` | MiMo 不同家族首選；DS Flash⚠️ 同家族但 Budget tier 可容忍 |
| 多樣性 Panel | `fusion-gemini`（需 Google API key）或 `fusion-skyunion`（需第三方API） | 引入 Google/Anthropic 架構多樣性 |

> **若所有 fusion agent 均無法使用**：降級為單模型直接回答，或改用 `.agents/skills/` 的 Self-Fusion 模式。

**AUTO MODE** — if fusion agents are configured in opencode.jsonc:
- Launch 2-3 panel subagents IN PARALLEL via the `task` tool
- Available agent types: `fusion-deepseek`, `fusion-kimi`, `fusion-qwen`, `fusion-glm`, `fusion-gemini`, `fusion-skyunion`, `fusion-sonnet`, `fusion-budget-ds`, `fusion-budget-mimo`
- Each agent has a different model pre-assigned
- Use `task` tool with `subagent_type` matching the agent name
- **例外**：model 前綴為 `antigravity/` 的 panel（目前僅 `fusion-gemini`）**不可**使用 `task` 工具，因為它會嘗試以該前綴尋找不存在的外部 provider，導致失敗。改用具備 `agy` 的 `bash` 橋接腳本：
  - Windows PowerShell: `powershell -NoProfile -ExecutionPolicy Bypass -File "scripts/fusion-gemini-bridge.ps1" -Question "panel prompt"`
  - Bash: `bash scripts/fusion-gemini-bridge.sh "panel prompt"`
  - 橋接腳本輸出即為該 panel 回應，與其他 `task` 回應並列進行 Judge 綜合

**MANUAL MODE** — if fusion agents are NOT configured:
- Inform the user clearly:
  1. "切換到模型 X，輸入以下指令："
  2. Show the exact prompt for each model
  3. "完成後將所有回應貼回來，我進行綜合裁判"
- Wait for user to provide all responses before proceeding to Phase 3

### Phase 2.5: 失敗處理 (Failure Handling)

收到所有 panel 回應後，先檢查：

- **部分 panel 失敗**（超時、API 限流、錯誤）：
  - 在報告中明確標記 `[FAILED: 模型名 — 原因]`
  - 以剩餘正常 panel 繼續進行 Judge Synthesis
  - 在最終報告開頭提示：「本次 X/N panel 成功」
- **全部 panel 失敗**：
  - 告知使用者並說明原因，建議改用 Budget 或直接回答
- **Judge 本身失敗**：
  - 不丟失已產出的 panel 結果
  - 直接將各 panel 原始回應整理後呈現給使用者，附上說明：「Judge 合成失敗，以下為各 panel 原始分析，請自行參考」

After collecting all panel responses, produce a structured synthesis:

```
## 🔬 Fusion 綜合分析報告

### 📊 參與模型
| 模型 | 視角 | 摘要 |
|------|------|------|
| Model A | 技術分析 | ... |
| Model B | 綜合評估 | ... |
| Model C | 創意視角 | ... |

### ✅ 共識 (Consensus)
所有或大部分模型同意的觀點：

### ⚠️ 分歧 (Contradictions)
模型之間存在矛盾的觀點：
| 議題 | Model A 立場 | Model B 立場 |
|------|-------------|-------------|

### 💡 獨特見解 (Unique Insights)
僅單一模型提出的有價值觀點：
- [Model X]: ...
- [Model Y]: ...

### 🔻 盲點 (Blind Spots)
所有模型都未觸及的重要面向：

### 🎯 綜合結論 (Final Answer)
綜合以上分析的最終建議：
```

### Phase 4: Self-Evaluation

After producing the final answer, briefly self-evaluate:
- Confidence level (high/medium/low)
- Key uncertainties remaining
- Suggested follow-up if any

## Panel Agent Reference

### Available Agent Types (when configured):

| Agent Name | Model | Best For | Approx Cost | Judge Compat |
|-----------|-------|----------|-------------|-------------|
| `fusion-deepseek` | opencode-go/deepseek-v4-pro | Technical depth, code reasoning | $1.74/$3.48 per 1M | ⚠️ Conflicts if Judge = DeepSeek |
| `fusion-kimi` | opencode-go/kimi-k2.7-code | Code architecture, logic flow | $0.95/$4.00 per 1M | ✅ All judges |
| `fusion-qwen` | opencode-go/qwen3.7-plus | Comprehensive analysis, broad context | $0.40/$1.60 per 1M | ✅ All judges |
| `fusion-glm` | opencode-go/glm-5.2 | Creative thinking, alternative angles | $1.40/$4.40 per 1M | ✅ All judges |
| `fusion-gemini` | antigravity/gemini-3.5-flash | Google diversity, alternative framing | Antigravity CLI subscription | ✅ All judges |
| `fusion-skyunion` | claude-haiku-4-5-20251001 (第三方API) | Anthropic diversity (Haiku, fast) | Via 第三方API | ✅ All judges |
| `fusion-sonnet` | claude-sonnet-5 (第三方API) | Anthropic flagship, deep contextual reasoning | Via 第三方API | ✅ All judges |
| `fusion-budget-ds` | opencode-go/deepseek-v4-flash | Fast budget analysis | $0.14/$0.28 per 1M | ⚠️ Conflicts if Judge = DeepSeek |
| `fusion-budget-mimo` | opencode-go/mimo-v2.5 | Budget broad coverage | $0.14/$0.28 per 1M | ✅ All judges |

### Environment Detection (環境檢測)

啟動 Fusion 前，先判斷執行環境：

| 環境 | 特徵 | 可用模型 | 使用檔案 |
|------|------|---------|---------|
| **Opencode 多模型** | opencode-go / Google / 第三方API providers 可用 | 多架構模型平行盲測 | 本檔案 (`.opencode/skills/`) |
| **Antigravity 單模型** | 僅 IDE 當前模型（如 Gemini 3.5 Flash） | Self-Fusion（同模型 ×2） | `.agents/skills/fusion-research` |

> **本檔案（`.opencode/skills/`）僅適用於 Opencode 多模型環境。** 若在 Antigravity 等單模型 IDE 中，請改用 `.agents/skills/fusion-research`。兩種環境的組合**不可混用**。

### Interactive Tier Selection (互動分層選擇)

> **Opencode 多模型環境專用**。Judge 預設為 DeepSeek V4 Pro，所有 Panel 排除 DeepSeek 家族以避免裁判偏差。

向使用者提供三層選擇（啟動 Fusion 時以 `question()` 呈現）：

```
question(): 「本次 Fusion 分析等級？」
```

| Tier | 名稱 | Panel 數 | 模型組合 | 架構多樣性 | 每輪成本 | 適用場景 |
|:----:|------|:--------:|---------|:---------:|---------|---------|
| 💰 | **Economy** | 2 | `fusion-kimi` + `fusion-budget-mimo` | Moonshot + MiMo | ~$1.09/$4.28 per 1M | 快速原型驗證、初步方向探索 |
| ⭐ | **Standard** | 4~5 | `fusion-kimi` + `fusion-qwen` + `fusion-glm` + `fusion-gemini` + `fusion-skyunion` | Moonshot / Alibaba / Zhipu / Google / Anthropic | ~$1.35/$5.60 + Antigravity CLI + 第三方API | 日常研究分析、架構決策（預設） |
| 🏆 | **Premium** | 5~6 | Standard + `fusion-sonnet` | Standard + Anthropic 旗艦視角 | 依用量（Sonnet 額外成本） | 關鍵決策、需要最深推理 |

> **Economy** 使用 Moonshot (Kimi) + MiMo 兩種不同架構，最低成本仍保持盲點互補。
> **Standard** 為預設選項：4 種不同架構平行盲測，最大化盲點覆蓋。若不需 GLM 創意視角可降為 4-panel compact（去掉 GLM），若不需 Gemini 可降為 3-panel。
> **Premium** 在 Standard 基礎上追加 Claude Sonnet 5 旗艦視角（Anthropic 最深推理），適用於不可失誤的關鍵決策。
> 各 Tier 內使用的 Panel 均排除 DeepSeek 家族（`fusion-deepseek` / `fusion-budget-ds`），保持 Judge 獨立性。

進階用戶可透過 `question()` 進一步自訂（分層揭露）：
- Layer 1（預設）：只選等級（Economy / Standard / Premium）
- Layer 2（進階）：展開後可勾選/排除特定 Panel，或自訂 Judge 模型

## Example Usage

User: "Should we use microservices or monolith for our new e-commerce platform?"

AI (with this skill loaded):
1. Recognizes as architecture decision → activate Fusion
2. Designs 3 panel prompts (Judge = DeepSeek V4 Pro, panels avoid DeepSeek):
   - Panel 1 (kimi): "Analyze the TECHNICAL trade-offs: performance, scalability, debugging complexity..."
   - Panel 2 (qwen): "Analyze the ORGANIZATIONAL trade-offs: team structure, deployment, operational cost..."
   - Panel 3 (glm): "Analyze CREATIVE/ALTERNATIVE approaches: hybrid architectures, migration strategies, edge cases..."
3. Dispatches all 3 in parallel via `task` tool
4. Collects responses, produces structured synthesis

## Notes

- Fusion calls have ~2-3x latency vs single model (parallel dispatch mitigates this)
- Not suitable as a coding model replacement — use for research/architecture only
- If only 1 panel succeeds, still produce analysis noting the failure
- Always cite which model said what in the synthesis

### Antigravity CLI Bridge (`fusion-gemini`)

`fusion-gemini` 改走本地 Antigravity CLI (`agy`)，原因：
- Google API free tier 在 OpenCode 多模型環境下頻繁限流、異常（見 README 開發規則第 3 條）
- `agy -p` 使用官方 Antigravity 客戶端 + 你的 Gemini 訂閱額度，穩定性較高

前置需求：
1. 安裝 Antigravity CLI：
   - Windows: `Invoke-RestMethod -Uri https://antigravity.google/cli/install.ps1 | Invoke-Expression`
   - macOS: `brew install --cask antigravity-cli`
   - Linux: `curl -fsSL https://antigravity.google/cli/install.sh | bash`
2. 安裝後重啟終端機，執行 `agy login` 登入 Google 帳號
3. 不要設定 `GEMINI_API_KEY`，否則會改走 API 計費而非訂閱額度

整合方式：
- `fusion-gemini` 的 model 設為 `antigravity/gemini-3.5-flash`（標記用，非真實 provider）
- Phase 2 派發時，對 `antigravity/` 前綴 panel 使用 `bash` 呼叫橋接腳本，而非 `task`
- 橋接腳本在乾淨 temp 目錄執行 `agy -p`，避免專案 `AGENTS.md` 干擾純研究查詢
