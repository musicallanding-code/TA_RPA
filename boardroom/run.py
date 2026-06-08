"""3-agent 虛擬經營團隊 — 最小編排原型（entry point）。

幕僚長（主 agent）協調 CFO 與 CDO 兩位 subagent，對使用者給的議題進行
三階段辯論並收斂出可決策的結論。

用法
----
    export ANTHROPIC_API_KEY=sk-...
    pip install -r requirements.txt
    python run.py "我們明年要不要砸 2000 萬建自有資料平台？"

不帶參數則使用內建的示範議題。可用 BOARDROOM_MODEL 環境變數覆寫模型。
"""

import asyncio
import os
import sys

from claude_agent_sdk import query, ClaudeAgentOptions
from claude_agent_sdk.types import (
    AssistantMessage,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
)

from team import TEAM, COORDINATOR_SYSTEM_PROMPT, KICKOFF_TEMPLATE

DEFAULT_ISSUE = (
    "我們是一家年營收 5 億的 B2B SaaS 公司。明年是否應投入 2000 萬元、"
    "花一年自建自有資料平台（取代現有外部分析工具），以支撐未來的 AI 產品線？"
)


def _render_assistant(msg: AssistantMessage, agent_names: dict) -> None:
    """把一則 assistant 訊息印成有「說話者標籤」的逐字稿。"""
    # parent_tool_use_id 有值 → 這是某個 subagent 在說話；否則是幕僚長本人。
    parent = getattr(msg, "parent_tool_use_id", None)
    speaker = agent_names.get(parent, "🧑‍✈️ 幕僚長") if parent else "🧑‍✈️ 幕僚長"

    for block in msg.content:
        if isinstance(block, TextBlock):
            text = block.text.strip()
            if text:
                print(f"\n【{speaker}】\n{text}")
        elif isinstance(block, ToolUseBlock) and block.name in ("Agent", "Task"):
            # 幕僚長委派 subagent：記下 id→名字，並印出它委派了什麼。
            sub = block.input.get("subagent_type", "?")
            label = {"cfo": "💰 CFO 財務長", "cdo": "📊 CDO 數據長"}.get(sub, sub)
            agent_names[block.id] = label
            delegated = (block.input.get("prompt") or "").strip()
            print(f"\n———  幕僚長委派 → {label}  ———")
            if delegated:
                print(f"（委派內容）{delegated}")


async def run_debate(issue: str) -> None:
    model = os.environ.get("BOARDROOM_MODEL")  # None → 用 SDK 預設模型
    options = ClaudeAgentOptions(
        system_prompt=COORDINATOR_SYSTEM_PROMPT,
        agents=TEAM,
        # 主 agent 只需要 Agent 工具來委派 subagent；把它放進 allowed_tools
        # 才能在非互動模式下自動核可委派（見官方 subagents 文件）。
        allowed_tools=["Agent"],
        permission_mode="bypassPermissions",
        setting_sources=[],   # 不載入任何檔案系統設定，保持原型可重現、無外部相依
        **({"model": model} if model else {}),
    )

    print("=" * 72)
    print("3-agent 虛擬經營團隊：三階段辯論")
    print("=" * 72)
    print(f"\n📌 議題：\n{issue}\n")

    agent_names: dict = {}  # tool_use_id -> 顯示用的 subagent 標籤
    result: ResultMessage | None = None

    async for message in query(
        prompt=KICKOFF_TEMPLATE.format(issue=issue),
        options=options,
    ):
        if isinstance(message, AssistantMessage):
            _render_assistant(message, agent_names)
        elif isinstance(message, ResultMessage):
            result = message

    print("\n" + "=" * 72)
    if result is not None:
        print(
            f"✅ 完成 | 回合數：{result.num_turns} | 耗時：{result.duration_ms} ms"
            + (
                f" | 成本：${result.total_cost_usd:.4f}"
                if result.total_cost_usd is not None
                else ""
            )
        )
    print("=" * 72)


def main() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit(
            "錯誤：未設定 ANTHROPIC_API_KEY 環境變數。\n"
            "請先執行：export ANTHROPIC_API_KEY=你的金鑰"
        )
    issue = " ".join(sys.argv[1:]).strip() or DEFAULT_ISSUE
    asyncio.run(run_debate(issue))


if __name__ == "__main__":
    main()
