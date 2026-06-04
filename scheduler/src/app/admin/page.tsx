import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EventTypeForm from "./EventTypeForm";
import EventTypeRowActions from "./EventTypeRowActions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const eventTypes = await prisma.eventType.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      interviewers: { include: { interviewer: true } },
      _count: { select: { bookings: true } },
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">管理後台</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin/interviewers" className="text-brand underline">
            面試官與特定日設定
          </Link>
          <Link href="/" className="text-brand underline">
            ← 回首頁
          </Link>
        </nav>
      </header>
      <p className="mt-1 text-sm text-amber-700">
        M1：尚未啟用 Google 網域登入保護，請勿對外公開。
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">現有 Event Types</h2>
        {eventTypes.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">尚未建立任何關卡。</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2">標題</th>
                  <th className="py-2">slug</th>
                  <th className="py-2">時長</th>
                  <th className="py-2">面試官</th>
                  <th className="py-2">預約數</th>
                  <th className="py-2">狀態</th>
                  <th className="py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {eventTypes.map((et) => (
                  <tr key={et.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 font-medium text-gray-900">
                      {et.title}
                      {et.jiraKey ? ` (${et.jiraKey})` : ""}
                    </td>
                    <td className="py-2 text-gray-600">
                      <Link href={`/${et.slug}`} className="text-brand underline">
                        {et.slug}
                      </Link>
                    </td>
                    <td className="py-2 text-gray-600">{et.durationMin}m</td>
                    <td className="py-2 text-gray-600">
                      {et.interviewers
                        .map((ei) => ei.interviewer.name)
                        .join("、") || "—"}
                    </td>
                    <td className="py-2 text-gray-600">{et._count.bookings}</td>
                    <td className="py-2">
                      {et.active ? (
                        <span className="text-green-700">啟用中</span>
                      ) : (
                        <span className="text-gray-400">已停用</span>
                      )}
                    </td>
                    <td className="py-2">
                      <EventTypeRowActions
                        slug={et.slug}
                        active={et.active}
                        bookings={et._count.bookings}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold text-gray-900">
          建立新的 Event Type
        </h2>
        <EventTypeForm />
      </section>
    </main>
  );
}
