# 自建 Calendly — 面試自助預約系統

招募自動化第一階段的核心子專案。完整規格見 [`SPEC.md`](./SPEC.md)。

**目前進度：M1（專案骨架 + 資料模型 + 管理後台建立 Event Type + 公開頁渲染靜態 slot；尚未串接 Google）。**

## 技術棧

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Prisma ORM · SQLite（MVP，可換 PostgreSQL）· Luxon · Zod · Vitest。

## M1 範圍

- ✅ 專案骨架（Next.js 14 App Router + TS + Tailwind）。
- ✅ Prisma 資料模型（SPEC §3.4 全部模型）。
- ✅ 管理後台 `/admin`：建立 Event Type、指派面試官與每週可面試時段、列出現有關卡。
- ✅ 公開 API：`GET /api/event-types/:slug`、`GET /api/event-types/:slug/availability`。
- ✅ 公開預約頁 `/[slug]`：還原 Calendly 兩欄版面，依「每週可面試時段」渲染靜態 slot（SPEC §3.6 步驟 1–3、6–9；§3.6 步驟 4–5 的 Google free/busy 預留接口，M2 接上）。
- ✅ 時間一律以 UTC 儲存、預設以 Asia/Taipei 顯示，並支援候選人時區切換。
- ✅ AuditLog：建立 Event Type 寫一筆稽核紀錄。

**尚未做（後續里程碑）**：Google OAuth / free/busy（M2）、建立預約 + 寄信（M3）、改期 / 取消 / 提醒（M4）、人資系統回寫 + 對外 webhook（M5）、UI 還原硬化 + 併發防重（M6）。

## 執行方式

```bash
cd scheduler
npm install
npm run setup     # prisma generate + db push（建立 SQLite）+ seed 範例資料
npm run dev       # http://localhost:3000
```

`npm run setup` 等同：

```bash
npm run prisma:generate   # 產生 Prisma client
npm run prisma:push       # 建立 SQLite schema（dev.db）
npm run db:seed           # 灌入範例 Event Type（/senior-recruiter-jira690）
```

開啟頁面：

- 首頁（關卡清單）：<http://localhost:3000>
- 公開預約頁：<http://localhost:3000/senior-recruiter-jira690>
- 管理後台：<http://localhost:3000/admin>

## Acceptance Test（M1 驗收）

M1 驗收標準（SPEC §3.11）：**不接 Google 也能看到頁面與假 slot。**

### A. 自動化測試（時段引擎，核心邏輯）

```bash
npm test
```

涵蓋 SPEC §3.6 的演算法：窗口切片與步進、UTC 儲存 / 時區顯示、minNotice、bookingWindow、DateOverride 封鎖、既有預約重疊排除、maxPerDay、以及 single / collective / round_robin 指派策略。全部通過即代表時段引擎符合規格。

### B. 端到端手動驗收（管理後台 → 公開頁）

1. `npm run setup && npm run dev`。
2. 進 `/admin`，填 slug、標題、JIRA 編號、面試官姓名 / Email 與每週時段，按「建立 Event Type」→ 應出現在「現有 Event Types」表格。
3. 點該關卡的「開啟」→ 進入公開預約頁；左欄顯示標題（含 JIRA 編號）、時長、地點、Interviewer、Markdown 說明。
4. 右欄選擇有設定可面試時段的「星期幾」對應日期 → 應出現對應的時段按鈕（例：10:00 / 10:30 / 11:00）。
5. 切換底部時區（例：UTC）→ 時段標籤對應改變，但同一批 slot。
6. 選擇沒有設定的日期 → 顯示「這天沒有可預約的時段」。

以上 A 全綠 + B 全部符合，即通過 M1。通過後再進 M2。

## 後續里程碑需要你提供（窗口先準備好）

- **M2（Google）**：Google Workspace OAuth client id / secret、授權的 redirect URI、可存取面試官行事曆的 scope 與帳號授權方式。
- **M3（寄信）**：以 `recruit@cmoney.com.tw` 寄信的權限（Gmail API 或 Workspace SMTP 憑證）。
- **M5（中樞 / 人資系統）**：內部人資系統 API 規格與端點、編排中樞 webhook URL 與 HMAC 密鑰。

詳見 PR 說明中的「待提供清單」。
