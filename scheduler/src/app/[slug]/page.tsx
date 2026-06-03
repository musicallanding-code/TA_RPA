import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BookingPanel from "./BookingPanel";

export const dynamic = "force-dynamic";

const locationLabel: Record<string, string> = {
  phone: "電話",
  meet: "視訊 (Google Meet)",
  onsite: "現場",
};

export default async function EventTypePage({
  params,
}: {
  params: { slug: string };
}) {
  const eventType = await prisma.eventType.findUnique({
    where: { slug: params.slug },
    include: { interviewers: { include: { interviewer: true } } },
  });

  if (!eventType || !eventType.active) notFound();

  const interviewers = eventType.interviewers.map((ei) => ei.interviewer.name);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:grid md:grid-cols-[minmax(0,360px)_1fr]">
        {/* Left column — event details (SPEC §3.9) */}
        <aside className="border-b border-gray-200 p-8 md:border-b-0 md:border-r">
          <p className="text-sm text-gray-500">CMoney 招募</p>
          <h1 className="mt-1 text-xl font-bold text-gray-900">
            {eventType.title}
            {eventType.jiraKey ? ` (${eventType.jiraKey})` : ""}
          </h1>

          <ul className="mt-5 space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span aria-hidden>🕒</span>
              {eventType.durationMin} 分鐘
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden>
                {eventType.locationType === "phone"
                  ? "📞"
                  : eventType.locationType === "onsite"
                    ? "📍"
                    : "🎥"}
              </span>
              {locationLabel[eventType.locationType] ?? eventType.locationType}
            </li>
            {interviewers.length > 0 && (
              <li className="flex items-center gap-2">
                <span aria-hidden>👤</span>
                Interviewer：{interviewers.join("、")}
              </li>
            )}
          </ul>

          {eventType.instructionsMd && (
            <div className="mt-6 whitespace-pre-wrap border-t border-gray-100 pt-5 text-sm leading-relaxed text-gray-700">
              {eventType.instructionsMd}
            </div>
          )}
        </aside>

        {/* Right column — date + slot picker */}
        <section className="p-8">
          <BookingPanel slug={eventType.slug} />
        </section>
      </div>
    </main>
  );
}
