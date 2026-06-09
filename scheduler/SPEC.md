# 自建 Calendly（核心子專案）— 建置規格

> 本檔案為招募自動化第一階段藍圖「第 3 節」的獨立化版本，作為本子專案的施工依據。
> 施工原則：先讓它能動，再讓它好看；先單向，再雙向；每個里程碑都要有 acceptance test 才算完成。

## 3.1 為什麼自建

Calendly 的本質是：**讀面試官 Google Calendar 的忙碌時段 → 算出可預約 slot → 候選人自助選 → 建行事曆事件 + 通知**。自建後可：把預約結果直接寫回內部人資系統、發 webhook 給中樞、用公司網域與品牌、不受外部訂閱限制。

## 3.2 MVP 功能範圍

- **Event Type（面試關卡類型）**：管理者為每個職缺 / 關卡建立一種預約類型，綁定 JIRA 編號、時長、地點類型、說明文字、面試官、可預約規則。
- **可預約時段引擎**：讀面試官 Google Calendar free/busy，依規則產生 slot。
- **公開預約頁**：候選人選日期 → 選時段 → 填表 → 確認。
- **預約成立後（自動）**：建 Google Calendar 事件（視訊則附 Meet 連結）、寄確認信給候選人與面試官、發 webhook 給中樞、寫一筆人資系統紀錄。
- **改期 / 取消**：確認信內含帶 token 的連結。
- **管理後台**：CRUD event type、連接 Google 帳號、檢視預約清單。

## 3.3 技術選型

| 層 | 選型 |
|---|---|
| 全端框架 | Next.js 14（App Router）+ TypeScript |
| UI | Tailwind CSS（還原 Calendly 版面） |
| 資料庫 | PostgreSQL + Prisma ORM（MVP 可先用 SQLite） |
| 管理者登入 | Google OAuth，限定 `@cmoney.com.tw` 網域 |
| Google 串接 | `googleapis` npm；OAuth2；scope：`calendar.events`、`calendar.freebusy` |
| 寄信 | Gmail API（以 recruit@ 寄出）或 Workspace SMTP（Nodemailer） |
| 時區 / 時間 | Luxon 或 date-fns-tz；**一律以 UTC 儲存，顯示用 Asia/Taipei** |
| 對外 webhook | HMAC 簽章 payload 送中樞 |
| 部署 | 內部主機 / Docker / Vercel 擇一 |

## 3.4 資料模型（Prisma 概念）

```
EventType    id, slug, title, jiraKey, durationMin,
             locationType(phone|meet|onsite), instructionsMd,
             bufferBeforeMin, bufferAfterMin, minNoticeHours,
             maxPerDay, bookingWindowDays, assignment(single|collective|round_robin), active
Interviewer  id, name, email, googleAccountId
EventTypeInterviewer   eventTypeId, interviewerId   // 多對多
Availability  interviewerId, dayOfWeek, startTime, endTime   // 每週可面試時段
DateOverride  interviewerId, date, available(bool), startTime?, endTime?  // 特定日覆寫
Booking      id, eventTypeId, interviewerId,
             candidateName, candidateEmail, candidatePhone,
             startUtc, endUtc, status(confirmed|cancelled|rescheduled),
             googleEventId, rescheduleToken, cancelToken, jiraKey, createdAt
GoogleCredential   ownerId, accessToken, refreshToken(加密), expiry
AuditLog           actor, action, entity, before, after, ts
```

## 3.5 API 端點

| Method | Path | 說明 |
|---|---|---|
| GET | `/api/event-types/:slug` | 公開：取得關卡資訊（標題、時長、說明、面試官） |
| GET | `/api/event-types/:slug/availability?date=YYYY-MM-DD&tz=Asia/Taipei` | 公開：回傳該日可預約 slot |
| POST | `/api/bookings` | 公開：建立預約 `{ slug, startUtc, candidate{...} }` |
| POST | `/api/bookings/:token/cancel` | 取消 |
| POST | `/api/bookings/:token/reschedule` | 改期 |
| — | `/admin/*` | 管理後台：event type CRUD、連 Google、預約清單 |

## 3.6 可預約時段演算法（核心，務必照做）

```
輸入：eventType、日期範圍、候選人時區
1. 取該 eventType 指派的面試官清單
2. 對每位面試官：取該星期幾的 Availability 窗口，套用 DateOverride
3. 把窗口切成 durationMin 的 slot（步進如 30 分），前後預留 buffer
4. 呼叫 Google freebusy 取該面試官該範圍的忙碌區間
5. 移除與忙碌區間（含 buffer）重疊的 slot
6. 移除違反 minNotice（now + minNoticeHours）與 bookingWindow 的 slot
7. 以當天已確認預約數檢查 maxPerDay
8. 指派策略：
   - collective：所有面試官都空才算可預約（取交集）
   - round_robin / single：任一面試官空即可（取聯集，記錄分派給誰）
9. 轉成候選人時區回傳
```

## 3.7 預約交易流程（防重複預約，關鍵）

```
1. 重新驗證該 slot 仍可預約（重查 freebusy + DB）
2. 在交易內 insert Booking（status=pending）
   — 對 (interviewerId, startUtc) 加 DB unique constraint 或 advisory lock 防併發
3. 呼叫 Google Calendar events.insert（視訊則帶 conferenceData 產生 Meet）
4. 成功 → 存 googleEventId、status=confirmed；失敗 → rollback
5. 非同步（可重試）：發 webhook 給中樞、寄確認信、寫人資系統紀錄
```

## 3.8 信件與通知

- **確認信**（候選人 + 面試官）：時間、地點 / Meet 連結、說明文字、改期 / 取消連結。
- **提醒信**：面試前一天。
- **取消 / 改期通知**：雙方都收到。

## 3.9 還原 Calendly 的使用者體驗細節

公開預約頁左欄顯示：
- 關卡標題含 JIRA 編號（例：`職能：資深人才招募專員 (JIRA690)`）
- 時長（`1 hr`）、地點類型圖示（電話 / 視訊 / 現場）
- 條列說明（Markdown）：例「預約面試請填中文姓名」「Email 請與 104 履歷一致」「此關卡會致電進行」「Interviewer：黃琬心」

右欄：月曆（可選日期）+ 該日時段按鈕；底部時區選擇器（預設 Taipei Time）。

> 表單必填欄位：中文姓名、Email（與 104 一致）、手機。送出後導向確認頁並寄確認信。

## 3.10 內控與資安要求（組織治理，必做）

- 管理後台限定公司 Google 網域登入。
- OAuth refresh token 加密儲存。
- 對外 webhook 以 HMAC 簽章；中樞驗章。
- 所有預約 / 改期 / 取消寫 `AuditLog`（誰、何時、改了什麼）。
- 公開預約端點加 rate limit；候選人個資訂保留期限與刪除機制。

## 3.11 里程碑

| 里程碑 | 交付 | 驗收 |
|---|---|---|
| M1 | 專案骨架 + 資料模型 + 管理者可建 event type；公開頁用「每週可面試時段」渲染靜態 slot | 不接 Google 也能看到頁面與假 slot |
| M2 | Google OAuth + freebusy 整合 | slot 會依面試官真實行事曆增減 |
| M3 | 預約流程 → 建 Calendar 事件 + 寄確認信 | 預約後面試官行事曆出現事件、雙方收到信 |
| M4 | 改期 / 取消 + 前一天提醒 cron | token 連結可改期 / 取消並通知雙方 |
| M5 | 寫人資系統紀錄 + 對外 webhook + AuditLog | 中樞收到 `booking.created` 並可回寫人資系統 |
| M6 | UI 還原 Calendly 版面、時區處理、併發防重複預約硬化 | 兩人同時搶同一 slot 只會有一筆成立 |
