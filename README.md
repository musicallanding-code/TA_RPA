# TA_RPA — 招募自動化

招募自動化第一階段：把招募人員從「系統間的搬運工」變回「決策者」，先做零判斷、最高頻的連接型自動化。

## 子專案

| 目錄 | 說明 | 狀態 |
|---|---|---|
| [`scheduler/`](./scheduler) | 自建 Calendly（面試自助預約系統）。規格見 `scheduler/SPEC.md`。 | **M1 完成**（骨架 + 資料模型 + 管理後台建立 Event Type + 公開頁渲染靜態 slot；尚未串接 Google） |

其餘第一階段項目（Jira 狀態同步、信件模板引擎、統一提醒引擎）為後續工作。

## 快速開始（scheduler）

```bash
cd scheduler
npm install
npm run setup   # 建立 SQLite + 灌入範例資料
npm run dev     # http://localhost:3000
npm test        # M1 時段引擎 acceptance test
```

詳見 [`scheduler/README.md`](./scheduler/README.md)。
