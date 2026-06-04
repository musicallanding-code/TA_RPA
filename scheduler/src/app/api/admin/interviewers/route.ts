import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Always read live DB rows — never statically prerender this admin list.
export const dynamic = "force-dynamic";

// GET /api/admin/interviewers — interviewers with weekly availability,
// date overrides, and which event types they're assigned to.
export async function GET() {
  const interviewers = await prisma.interviewer.findMany({
    orderBy: { name: "asc" },
    include: {
      availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      dateOverrides: { orderBy: { date: "asc" } },
      eventTypes: { include: { eventType: { select: { slug: true, title: true } } } },
    },
  });
  return NextResponse.json({ interviewers });
}
