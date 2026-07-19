---
name: fiction-editor
description: Use ONLY for fiction writing, novel chapters, short stories, or narrative content editing. Provides multi-perspective literary critique and produces a final revised draft. Triggers on: 小說, 章節, 故事, fiction, novel, chapter, narrative, prose, 修改文章, 編輯, edit chapter, revise story. Do NOT use for code, technical writing, or factual research.
---

# Fiction Editor — Multi-Model Literary Revision Pipeline

This skill adapts the Fusion multi-model approach for fiction writing. Three specialized literary editors (Plot, Character, Prose) review the text in parallel, then an Editor-in-Chief (Judge) synthesizes their critiques and produces a final revised chapter.

> **適用環境**：本版本（`.opencode/skills/`）使用**不同架構模型**分別擔任三位編輯，需要多模型 token 環境。
> 若你在 Antigravity 等**僅單一底層模型**的 IDE 運行，請改用 `.agents/skills/fiction-editor`（單模型 Self-Fusion 版，靠角色化提示詞區分編輯視角）。

## Core Principle

**一篇小說的修改需要同時關注結構、人物與文筆三個層面。不同模型對不同層面的敏感度不同，平行審稿 + 綜合改稿能產出比單一編輯更好的結果。**

## Workflow

```
使用者提供原文（章節/故事）
        │
        ▼
┌──────────────────────────────────┐
│ Phase 0: 風格攝取與校準           │
│ 自動發現專案風格檔 → 建立基線     │
└──────────┬───────────────────────┘
           ▼
┌──────────────────────────────────┐
│ Phase 1: Ingestion               │
│ 讀取原文，確認長度與結構          │
└──────────┬───────────────────────┘
           ▼
┌──────────────────────────────────┐
│ Phase 2: Multi-Perspective       │
│ Review (Parallel)                │
│                                  │
│  ┌────────┐  ┌────────┐  ┌────┐ │
│  │ Plot   │  │Character│  │Prose│ │
│  │Editor  │  │Editor   │  │Edit│ │
│  └────┬───┘  └────┬───┘  └─┬──┘ │
│       │           │         │    │
│  ─────┴───────────┴─────────┴── │
│  三份獨立評審報告 (平行產生)      │
└──────────┬───────────────────────┘
           ▼
┌──────────────────────────────────┐
│ Phase 3: Judge Analysis          │
│ Editor-in-Chief 分析三份報告:     │
│  ✅ 共識意見                     │
│  ⚠️ 分歧觀點                     │
│  💡 獨特建議                     │
│  📋 優先修改項目                 │
└──────────┬───────────────────────┘
           ▼
┌──────────────────────────────────┐
│ Phase 4: Final Revision          │
│ 產出:                            │
│  1. 評審摘要 (Review Summary)    │
│  2. 修改後章節全文               │
│     (Final Revised Chapter)      │
└──────────────────────────────────┘
```

## Phase 0: 環境偵測與套餐選擇（自動執行）

> **僅在首次觸發或持久化狀態過期時執行。** 檢查專案根目錄 `.fusion/fusion-state.json`。

### Step 0.1 — 載入持久化狀態
1. 檢查 `.fusion/fusion-state.json` 是否存在
2. 存在 + 未過期（`detected_at` < 7 天前）：**跳過 Step 0.2~0.4**，直接使用已保存的 `selected_tier.fiction` 啟動編輯流程
3. 不存在 或 過期：繼續執行 Step 0.2~0.4

### Step 0.2 — 環境偵測（不讀取 provider 的 apiKey）
1. 讀取 `opencode.jsonc` 的 `agent` 區塊 → 檢查是否有 `fusion-fiction-*` agent（**不讀取 `provider` 的 apiKey/bearerToken**）
2. 檢查 `.agents/skills/fiction-editor/SKILL.md` 是否存在
3. 判定環境：
   - 有 `fusion-fiction-plot/character/prose` → **opencode-multi**（使用本檔案）
   - 無 `fusion-fiction-*` 但有 `.agents/skills/fiction-editor/SKILL.md` → **antigravity-single**（跳轉 `.agents/skills/fiction-editor`）

### Step 0.3 — 生成套餐並讓使用者選擇
根據可用編輯 agent 生成套餐（Standard / Premium），使用 `question()` 呈現。若 `fusion-sonnet` 不可用 → 僅提供 Standard。

### Step 0.4 — 寫入持久化狀態
將偵測結果與選擇寫入 `.fusion/fusion-state.json`（僅含 agent 名稱，不含 credential）。

### 套餐重置指令
使用者輸入「**fusion reset**」或「**重置 Fusion**」→ 刪除 `.fusion/fusion-state.json` → 重新偵測。

---

## Phase 0.5: Pre-flight Safety Check（強制預檢）

> **在 Phase 1 派發編輯前必須通過。** 若有 BLOCK/ERROR 則阻斷執行。

### Step 0.5.1 — 解析 Combo 並驗證存在性

將選定套餐的編輯 agent（fusion-fiction-plot/character/prose）解析為 `opencode.jsonc` 中的實際 model ID。

- agent 不存在 → 🚫 **BLOCK**
- 以 `fusion-sonnet` 替代 `fusion-fiction-prose` 時，檢查 `fusion-sonnet` agent 是否存在

### Step 0.5.2 — Provider 可用性檢查

| 編輯 Agent | Model 前綴 | 所需 Provider |
|---|---|---|
| `fusion-fiction-plot` | `opencode-go/glm-5.2` | opencode-go（內建） |
| `fusion-fiction-character` | `opencode-go/qwen3.7-plus` | opencode-go（內建） |
| `fusion-fiction-prose` | `opencode-go/mimo-v2.5` | opencode-go（內建） |
| `fusion-sonnet`（選配） | `thirdparty/claude-sonnet-5` | **thirdparty** |

- `fusion-sonnet` 被選用但 thirdparty provider 未配置 → 🔴 **ERROR：PROVIDER_CREDENTIAL_MISSING**
  - 選項：[A] 退回 Standard（MiMo Prose） / [M] 補上 thirdparty 配置 / [X] 中止

### Step 0.5.3 — Judge Bias 檢查

- Judge（DeepSeek V4 Pro） vs Panel 家族：
  - GLM-5.2（Plot）✅ / Qwen3.7+（Character）✅ / MiMo V2.5（Prose）✅ / Sonnet 5（Prose 升級）✅
- 所有預設編輯均與 Judge 不同家族 → 自動通過
- 若未來更換 Judge 或編輯模型時需重新驗證

### Step 0.5.4 — 整合結果

通過後進入 Phase 1（載入原文 + 風格基線）。若中止則以單模型直接修改。

### 套餐重置指令（Phase 0 沿用）
見上方 Phase 0。

---

## Activation Decision

### Skip Fiction-Editor if:
- Factual/technical editing
- Code or documentation review
- Short proofreading (typos only)
- User asks for single-model edit

### Activate if:
- Full chapter or story revision
- Narrative structure feedback needed
- Character/plot/prose multi-aspect editing
- User submits a chapter/story for critique
- 小說章節修改、故事編輯、長篇稿件審閱

## Phase Details

### Phase 0: 風格攝取與校準 (Style Ingestion & Calibration)

> **V5 新增 — 修復根因⑤「認知誤差」**：V4 Benchmark 暴露三位編輯以**通用文學標準**評審，未參考目標專案自身的風格設定，導致把專案刻意追求的風格誤判為缺陷。典型案例：專案 `style-params.json` 的 default preset 節奏目標=6（「適中」），卻被通用「男頻爽文=急速」心智模型判為「太慢」；專案要求**白描**並禁用特定詞彙，Prose 卻套用通用「豐富意象 / 剪贅詞」標準，抹平了冷硬腔調。

在讀取原文之前，先攝取目標專案的風格設定，建立「**風格基線 (Style Baseline)**」並注入後續所有 panel。

#### 0.1 自動發現（Auto-discovery）
以 glob/grep 掃描專案根目錄與 `docs/`，按優先級尋找風格檔：

| 優先級 | 檔案模式（慣例名） | 內容 | 用途 |
|---|---|---|---|
| ★★★ | `style-params.json` | 量化維度 + presets | 機器可讀的節奏/幽默/爽感等目標值 |
| ★★★ | `*CONSTRAINTS*.md`（如 `WORLD-CONSTRAINTS.md`） | 鐵律、禁用詞、角色行為禁區 | 絕對禁區（命中即標記） |
| ★★ | `0*-style*.md`（如 `09-style-guide.md`） | 負面禁令、翻譯腔識別、長短句量化 | 文筆校準 |
| ★★ | `docs/style-samples/{good,bad}-samples.md` | 正反範例 | 具體對照 |
| ★ | `0[0-9]-*.md`（overview/theme/world/cast/plot） | 專案背景 | 輕量上下文，不逐字載入 |

> 發現多個檔時全部讀取並合併；高優先級覆蓋低優先級衝突。若使用者已在訊息中指明風格檔路徑，優先採用。

#### 0.2 建立風格基線（Build Baseline）
將抓到的內容濃縮為一個結構化區塊，至少包含：
- **量化目標**：active preset 的關鍵維度（pacing / detail / humor / satisfaction / dialogue_ratio / nostalgia 等）及其數值與文字標籤（如 pacing=6「適中」）
- **禁用詞表**：絕對禁區詞彙（網文爛俗詞 / AI 填充句 / AI 過渡詞 / AI 結論性廢話）——命中即標記，不論通用標準如何看待
- **硬性風格指令**：白描 vs 形容詞、翻譯腔識別規則、長短句混搭量化標準（如每 300 字 2-4 單句+3-5 中句+1-2 長句）
- **角色聲音規則**：主角口癖／生理信號代情緒、AI 角色說話鐵律（供 Character 編輯）
- **節奏鉤子規則**：如「前 500 字必須出現外部威脅或技術秀場」（供 Plot 編輯）

#### 0.3 注入（Inject）
Phase 2 派發每個 panel 時，連同原文一起附上風格基線，並明示校準指令（見 Phase 2 校準區塊）。

#### 0.4 兜底（Basic Profile Fallback）
若專案無任何風格檔，使用內建極簡基線，避免退化成純通用標準：
- 白描優先，避免形容詞快捷鍵與網文爛俗詞
- 禁 AI 套話（「空氣突然安靜了」「從這一刻起」「突然/然而」過度使用）
- 節奏以「適中」為基準，**不預設「快=好」**
- 輸出開頭註明：`⚠️ 已套用內建基本風格基線；建議專案補上 style-params.json / style-guide 以獲得精準校準`

> 本 Phase 0 同時落地目標專案自身的風格路線圖（如 `10-style-optimization-roadmap.md` 的「風格評分機制」階段），讓 Fusion 的評審成為專案既存量化標準的執行者，而非外掛通用裁判。

### Phase 1: Ingestion

- Read the full text from the user's message or referenced file
- Note: author's style, genre, chapter position (if known)
- If text is very long (>8000 words), inform user and handle section by section

### Phase 2: Parallel Review

> ⛔ **CRITICAL：嚴禁使用 `subagent_type: "general"`**
> 
> `opencode.jsonc` 中的 `general` agent 無 `model` 欄位，會靜默繼承主對話模型（DeepSeek V4 Pro）。這會使 Fiction Editor 退化成單模型自評，完全喪失「不同架構編輯平行盲測」的價值。
> 
> **若 fusion-fiction-* agent 無法使用，應改用：**
> - `fusion-glm`（GLM-5.2）替代 Plot Editor — 中文理解相近
> - `fusion-qwen`（Qwen3.7+）替代 Character Editor — 同家族
> - `fusion-budget-mimo`（MiMo V2.5）替代 Prose Editor — 同家族
> - 或完全降級為單模型直接修改

Launch three panel agents IN PARALLEL. Give each agent:

1. The full original text
2. The **Style Baseline** from Phase 0（若已建立）— 見下方校準指令
3. A perspective-specific instruction (see below)
4. Ask for structured analysis

> **🎛️ 風格校準（覆蓋優先級）**：各 panel 下列 focus areas 為**預設值**；當 Phase 0 風格基線存在時，**專案規則覆蓋通用標準**：
> - 專案要求**白描** → Prose 不得建議「豐富意象 / 增加感官細節」，反而要標記形容詞快捷鍵
> - 專案**禁用詞** → 命中即標記為 issue，不論通用標準是否視為合理修辭
> - 專案節奏目標=「適中」(pacing≈6) → Plot 不得將適中節奏判為「太慢」；僅標記**偏離目標值**的段落
> - 專案角色聲音鐵律 → Character 以專案規則為準（如「情緒用生理信號代替」），不套用通用「增加 interiority」
> - 無風格基線 → 退回通用 focus areas + Phase 0.4 內建基本基線

> **失敗處理**：若某個 panel agent 失敗，在報告中標記 `[FAILED: 編輯角色]`，以剩餘 panel 報告繼續 Phase 3，並在最終輸出開頭說明「X/3 編輯成功」。不放棄已完成的 panel 結果。

#### Panel A: Plot & Structure Editor (`fusion-fiction-plot`)
Focus areas:
- Narrative structure (beginning/middle/end balance)
- Pacing analysis (too fast? too slow? inconsistent?)
- Scene construction (transitions, tension, payoff)
- Plot logic and consistency
- Chapter-level arc (does it serve the overall story?)

#### Panel B: Character & Emotion Editor (`fusion-fiction-character`)
Focus areas:
- Character voice consistency (dialogue, internal thought)
- Emotional depth and reader connection
- Character motivation and behavior logic
- Relationship dynamics
- Dialogue naturalness

#### Panel C: Prose & Style Editor (`fusion-fiction-prose`)
Focus areas:
- Sentence variety and rhythm
- Imagery and sensory detail
- Showing vs telling balance
- Word choice precision and register consistency
- Tone and atmosphere

### Phase 3: Judge Synthesis

After collecting all three reviews, produce a structured analysis:

```
## 📋 評審綜合分析

### ✅ 共識意見
(三位編輯都同意的觀點)

### ⚠️ 分歧意見
| 議題 | 編輯A立場 | 編輯B立場 |
|------|----------|----------|

### 💡 獨特建議
(僅單一編輯提出但有價值的觀點)

### 📊 優先修改項目
按重要性排列的修改項目清單
```

#### 🎚️ 風格校準評分（若 Phase 0 已載入 `style-params.json`）
落地專案既存的量化風格評分機制。按 active preset 維度逐項評分（1-10），對照目標值標注偏移，僅標記**偏離目標 ±2 以上**者為需調整：

```
| 維度 | 目標值(標籤) | 實測 | 偏移 | 判定 |
|------|------|------|------|------|
| 節奏感 pacing | 6 適中 | _ | _ | ✅/⚠️ |
| 細節度 detail | 6 適中 | _ | _ | |
| 幽默度 humor | 7 冷幽默 | _ | _ | |
| 爽感 satisfaction | 7 適度 | _ | _ | |
| 對話比例 dialogue_ratio | 7 均衡 | _ | _ | |
| ...（其餘按 preset 載入） | | | | |
```

> 無 `style-params.json` 時省略此表，改以通用文學維度（結構/人物/文筆）呈現評審摘要。

### Phase 4: Final Revision

Produce the final output:

1. **評審摘要** (2-3 paragraphs summarizing key findings)
2. **修改後章節全文** (the complete revised chapter with changes applied)

When generating the revised chapter:
- Incorporate consensus feedback definitely
- For contradictory feedback, use your own literary judgment
- Preserve the author's unique voice and style
- Mark major changes with inline comments `[改: 說明]`
- If the user originally provided the text in Chinese, output the revision in Chinese

> ⚠️ **字數與品質的權衡（重要）**
>
> 根據本專案 Fiction Editor V4 Benchmark 實測（§10 研究報告），字數超標是最常見的「機械扣分」來源——即使文本品質極高（如 fusion-fiction-opus 編輯分 9.00 冠全場，仍因字數超標被拖至 #3）。
>
> - 若使用者**有明確字數限制**（如「約 3000 字」）：Judge 必須在修改後明確核對字數，並在輸出時說明是否符合。不得讓高品質修改因字數失控而被評分懲罰。
> - 若使用者**無字數要求**：以品質為優先，但仍應避免在修改中無謂地大幅擴充原文篇幅。
> - 若優先保留某段精彩內容會超出字數：**明確告知使用者取捨**，由作者決定，不要靜默截斷。

## Environment Detection (環境檢測)

啟動 Fiction Editor 前，先判斷執行環境：

| 環境 | 編輯模型 | Judge | 組合方式 |
|------|---------|-------|---------|
| **Opencode 多模型** | 不同架構模型（GLM / Qwen / MiMo / Sonnet） | DeepSeek V4 Pro | 真·多模型盲測 |
| **Antigravity 單模型** | IDE 當前模型 ×3（角色化提示詞區分視角） | IDE 當前模型 | Self-Fusion |

> **本檔案（`.opencode/skills/`）僅適用於 Opencode 多模型環境。** 若在 Antigravity 等單模型 IDE 中，請改用 `.agents/skills/fiction-editor`。兩種環境的組合**不可混用**。

## Interactive Tier Selection (互動分層選擇)

> **Opencode 多模型環境專用。** Judge（Editor-in-Chief）使用 DeepSeek V4 Pro。

向使用者提供兩層選擇（啟動時以 `question()` 呈現）：

```
question(): 「本次編輯等級？」
```

| Tier | 名稱 | 編輯組合 | 每輪成本 (per 1M) | 適用場景 |
|:----:|------|---------|:---:|---------|
| ⭐ | **Standard** | Plot(GLM-5.2) + Character(Qwen3.7+) + Prose(MiMo V2.5) | ~$1.94/$6.28 | 日常章節編輯（預設 V5） |
| 🏆 | **Premium** | Plot(GLM-5.2) + Character(Qwen3.7+) + Prose(**Sonnet 5**) | 上升 | 關鍵章節、需要頂級文筆推理 |

> **Standard (V5 預設)**：GLM-5.2（Plot）、Qwen3.7 Plus（Character）、MiMo V2.5（Prose）。三位編輯均與 Judge（DeepSeek V4 Pro）不同家族，無裁判偏差。
> **Premium**：以 Claude Sonnet 5 取代 Prose Editor，大幅提升文筆／意象／句式推理深度。Sonnet 5 與 Judge 不同家族，無衝突。亦可選擇將 Sonnet 5 作為第四位編輯平行覆審，或升級 Character Editor。

### Available Agents

| Agent | Model | Role | Cost |
|-------|-------|------|------|
| `fusion-fiction-plot` | opencode-go/glm-5.2 | Plot & Structure | $1.40 / $4.40 |
| `fusion-fiction-character` | opencode-go/qwen3.7-plus | Character & Emotion | $0.40 / $1.60 |
| `fusion-fiction-prose` | opencode-go/mimo-v2.5 | Prose & Style | $0.14 / $0.28 |
| `fusion-sonnet`（選配） | 第三方API/claude-sonnet-5 | Anthropic 旗艦文筆推理 | Via 第三方API |
| Judge (main model) | opencode-go/deepseek-v4-pro | Editor-in-Chief | — |

> Note: Update `opencode.jsonc` to register `fusion-fiction-*` agents before use. See configuration section.

## Example

User pastes a chapter and asks:
> 「幫我 review 這篇小說第四章，給修改建議後產出最終版」

AI:
1. Ingests the chapter text
2. Dispatches 3 agents in parallel:
   - `fusion-fiction-plot`: structural analysis
   - `fusion-fiction-character`: character/dialogue analysis
   - `fusion-fiction-prose`: prose/stylistic analysis
3. Synthesizes reviews
4. Outputs: Review Summary + Full Revised Chapter

## Design Notes

- Judge (Editor-in-Chief) uses DeepSeek V4 Pro to avoid panel overlap
- **V5 修正**：V4 的 Plot Editor 原為 `deepseek-v4-flash`，與 Judge 同屬 DeepSeek 家族，違反 Judge Bias 規則（見 `fusion-research` SKILL.md「模型家族相容性快查」）。V5 起改用 `glm-5.2`，三位 panel（GLM / Qwen / Mimo）現與 Judge（DeepSeek）皆為不同架構，真正達成 no self-bias
- If only 2 of 3 panels succeed, still produce revision with note
- For very long chapters, consider section-by-section processing
- **V5 Phase 0（風格攝取）**：修復根因⑤「認知誤差」——V4 三位編輯以通用文學標準評審，未參考專案 `style-params.json` / `WORLD-CONSTRAINTS.md` / `09-style-guide.md` 等量化與禁令設定。Phase 0 自動發現這些檔、建立風格基線並注入 panel，使專案規則覆蓋通用標準（白描優先、禁用詞命中即標記、節奏按 preset 目標值而非「急速爽文」假設）。同時以 Phase 3 風格校準評分表落地專案 `10-style-optimization-roadmap.md` 的 pending「風格評分機制」。
