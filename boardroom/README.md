# 3-agent 虛擬經營團隊 — 最小編排原型

用 [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) 建的多代理人決策輔助 MVP：
一個「幕僚長」主 agent 協調兩位 C-level subagent（**CFO 財務長**、**CDO 數據長**），
針對你給的議題進行**三階段辯論**並收斂出**可決策的結論**。

目的是驗證「自動辯論能否產生有實質張力、可決策的結論」，刻意維持最小可運作，
不做完整系統。

## 架構

完全使用 SDK 原生的 subagent 機制，沒有自造 orchestrator：

- **幕僚長（主 agent）** = `query()` 搭配 `system_prompt`（見 `team.py` 的
  `COORDINATOR_SYSTEM_PROMPT`）。它透過內建的 `Agent` 工具委派 subagent。
- **CFO / CDO（subagent）** = `ClaudeAgentOptions(agents=...)` ＋ `AgentDefinition`
  （見 `team.py` 的 `TEAM`）。兩者 `tools=[]`，是純推理者。

```
使用者議題
   │
   ▼
幕僚長 (Chief of Staff, 主 agent)
   ├─ 階段一 開場立場 ─┬─▶ cfo   ─┐
   │                  └─▶ cdo   ─┤  （各自獨立、全新 context）
   ├─ 階段二 交叉辯論 ─┬─▶ cfo   ─┤  幕僚長把對方論點塞進委派 prompt
   │                  └─▶ cdo   ─┘
   └─ 階段三 收斂結論  ◀── 幕僚長親自綜整、輸出結構化結論
```

### 三階段
1. **開場立場**：幕僚長分別委派 CFO、CDO 給出初始立場（關鍵假設／在意指標／建議方向）。幕僚長此階段不發言。
2. **交叉辯論**：幕僚長把對方上一輪論點原文放進委派 prompt，請各自反駁對方最強論點、點出真正的取捨。
3. **收斂結論**：幕僚長親自綜整，輸出：核心張力 / 關鍵取捨 / 情境判斷 / 建議決策 / 風險與前提 / 給決策者的待決問題。

### 一個關鍵的 SDK 細節
subagent 的 context 是全新的，看不到彼此或先前對話——父 agent 只能透過 `Agent`
工具的 prompt 字串傳資訊進去（官方 subagents 文件「What subagents inherit」）。
所以幕僚長的 system prompt 明確要求：**每次委派都要附上議題全文，第二階段起還要附上對方上一輪論點**，
否則 subagent 無從反駁。這也是讓辯論「真的有張力」的關鍵。

## 安裝與執行

需要 Python 3.10+。

```bash
cd boardroom
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...        # 金鑰只走環境變數，程式內不硬寫

# 用自己的議題
python run.py "我們明年要不要砸 2000 萬建自有資料平台？"

# 不帶參數則跑內建示範議題
python run.py
```

執行時會即時印出逐字稿（誰委派誰、各 subagent 的發言、幕僚長最後的結論）。

| 環境變數 | 說明 |
| --- | --- |
| `ANTHROPIC_API_KEY` | （必填）API 金鑰，SDK 自動讀取。 |
| `BOARDROOM_MODEL` | （選填）覆寫主 agent 模型；不設則用 SDK 預設。 |

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `team.py` | CFO / CDO 的 `AgentDefinition`、幕僚長 system prompt、開場指令範本。 |
| `run.py` | 進入點：組 `ClaudeAgentOptions`、跑 `query()`、把訊息流渲染成逐字稿。 |
| `requirements.txt` | 相依套件（`claude-agent-sdk`）。 |
| `.env.example` | 環境變數範例。 |

## 設計取捨與假設

- **CDO 定義為「數據長」**（Chief Data Officer，兼管數位轉型），刻意與 CFO 的財務紀律
  形成張力（長期能力投資 vs. 短中期財務健康）。若你的情境想用其他 C-level，改 `team.py` 即可。
- **單次 `query()` 驅動全程**：三階段由幕僚長依 system prompt 自主以 `Agent` 工具編排，
  而非由 Python 多次呼叫硬切階段——這最貼近「用 SDK 原生機制、不自造 orchestrator」的要求。
- subagent `tools=[]`、`permission_mode="bypassPermissions"`、`setting_sources=[]`：
  保持純推理、非互動可重現、無檔案系統相依。
- 屬 MVP：未做結果持久化、結構化 JSON 輸出、多輪交叉辯論或人機介入（human-in-the-loop），
  這些都是後續可加的方向。
