import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const eventTypes = await prisma.eventType.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold text-gray-900">面試預約系統</h1>
      <p className="mt-2 text-gray-600">
        自建 Calendly · M1（靜態時段，尚未串接 Google 行事曆）
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          可預約的面試關卡
        </h2>
        {eventTypes.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-gray-500">
            目前沒有啟用中的關卡。請到{" "}
            <Link href="/admin" className="text-brand underline">
              管理後台
            </Link>{" "}
            建立一個 Event Type。
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {eventTypes.map((et) => (
              <li
                key={et.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <Link
                  href={`/${et.slug}`}
                  className="text-lg font-medium text-brand hover:underline"
                >
                  {et.title}
                  {et.jiraKey ? ` (${et.jiraKey})` : ""}
                </Link>
                <p className="mt-1 text-sm text-gray-500">
                  {et.durationMin} 分鐘 · {locationLabel(et.locationType)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-12">
        <Link href="/admin" className="text-sm text-brand underline">
          → 管理後台
        </Link>
      </div>
    </main>
  );
}

function locationLabel(type: string): string {
  switch (type) {
    case "phone":
      return "電話";
    case "onsite":
      return "現場";
    default:
      return "視訊 (Google Meet)";
  }
}
