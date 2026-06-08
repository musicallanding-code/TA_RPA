import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { googleEnabled } from "@/lib/google";
import DateOverrideEditor from "./DateOverrideEditor";
import GoogleConnect from "./GoogleConnect";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export default async function InterviewersPage({
  searchParams,
}: {
  searchParams: { google_connected?: string; google_error?: string };
}) {
  const gEnabled = googleEnabled();
  const interviewers = await prisma.interviewer.findMany({
    orderBy: { name: "asc" },
    include: {
      availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      dateOverrides: { orderBy: { date: "asc" } },
      eventTypes: { include: { eventType: { select: { slug: true, title: true } } } },
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">面試官與特定日設定</h1>
        <Link href="/admin" className="text-sm text-brand underline">
          ← 回管理後台
        </Link>
      </header>
      <p className="mt-1 text-sm text-gray-500">
        每週可面試時段於建立 Event Type 時設定；此頁管理「特定日覆寫」（休假 /
        臨時調整）與 Google 行事曆連接。
      </p>

      {searchParams.google_connected && (
        <div className="mt-4 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          已成功連接 Google：{searchParams.google_connected}
        </div>
      )}
      {searchParams.google_error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Google 連接失敗：{searchParams.google_error}
        </div>
      )}
      {!gEnabled && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Google 整合尚未啟用。設定 <code>GOOGLE_CLIENT_ID</code>、
          <code>GOOGLE_CLIENT_SECRET</code>、<code>GOOGLE_OAUTH_REDIRECT_URI</code>
          與 <code>GOOGLE_TOKEN_ENC_KEY</code> 後即可連接面試官行事曆（M2）。
        </div>
      )}

      {interviewers.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500">
          尚無面試官。請先在管理後台建立 Event Type 並指派面試官。
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {interviewers.map((iv) => (
            <section
              key={iv.id}
              className="rounded-lg border border-gray-200 bg-white p-6"
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold text-gray-900">{iv.name}</h2>
                <span className="text-sm text-gray-500">{iv.email}</span>
              </div>

              <div className="mt-2">
                <GoogleConnect
                  interviewerId={iv.id}
                  connected={Boolean(iv.googleAccountId)}
                  enabled={gEnabled}
                />
              </div>

              <p className="mt-2 text-xs text-gray-400">
                指派關卡：
                {iv.eventTypes.length
                  ? iv.eventTypes
                      .map((e) => e.eventType.title)
                      .join("、")
                  : "—"}
              </p>

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  每週可面試時段
                </p>
                {iv.availability.length > 0 ? (
                  <ul className="mt-1 flex flex-wrap gap-2 text-sm text-gray-700">
                    {iv.availability.map((a) => (
                      <li
                        key={a.id}
                        className="rounded bg-gray-100 px-2 py-0.5"
                      >
                        週{DAY_LABELS[a.dayOfWeek]} {a.startTime}–{a.endTime}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-gray-400">尚未設定。</p>
                )}
              </div>

              <DateOverrideEditor
                interviewerId={iv.id}
                overrides={iv.dateOverrides.map((o) => ({
                  id: o.id,
                  date: o.date,
                  available: o.available,
                  startTime: o.startTime,
                  endTime: o.endTime,
                }))}
              />
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
