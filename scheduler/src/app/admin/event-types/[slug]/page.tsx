import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EditEventTypeForm from "./EditEventTypeForm";

export const dynamic = "force-dynamic";

export default async function EditEventTypePage({
  params,
}: {
  params: { slug: string };
}) {
  const eventType = await prisma.eventType.findUnique({
    where: { slug: params.slug },
    include: {
      interviewers: { include: { interviewer: true } },
      _count: { select: { bookings: true } },
    },
  });

  if (!eventType) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          編輯：{eventType.title}
        </h1>
        <Link href="/admin" className="text-sm text-brand underline">
          ← 回管理後台
        </Link>
      </header>

      <p className="mt-1 text-sm text-gray-500">
        slug：<code>{eventType.slug}</code> · 預約數：{eventType._count.bookings} ·
        指派面試官：
        {eventType.interviewers.map((ei) => ei.interviewer.name).join("、") ||
          "—"}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        指派面試官與每週時段請至「
        <Link href="/admin/interviewers" className="underline">
          面試官與特定日設定
        </Link>
        」。
      </p>

      <EditEventTypeForm
        slug={eventType.slug}
        initial={{
          title: eventType.title,
          jiraKey: eventType.jiraKey ?? "",
          durationMin: eventType.durationMin,
          locationType: eventType.locationType,
          instructionsMd: eventType.instructionsMd ?? "",
          bufferBeforeMin: eventType.bufferBeforeMin,
          bufferAfterMin: eventType.bufferAfterMin,
          minNoticeHours: eventType.minNoticeHours,
          maxPerDay: eventType.maxPerDay,
          bookingWindowDays: eventType.bookingWindowDays,
          assignment: eventType.assignment,
          active: eventType.active,
        }}
      />
    </main>
  );
}
