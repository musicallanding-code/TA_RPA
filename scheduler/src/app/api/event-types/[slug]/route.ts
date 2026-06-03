import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public: event-type info for the booking page (SPEC §3.5).
export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const eventType = await prisma.eventType.findUnique({
    where: { slug: params.slug },
    include: { interviewers: { include: { interviewer: true } } },
  });

  if (!eventType || !eventType.active) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    eventType: {
      slug: eventType.slug,
      title: eventType.title,
      jiraKey: eventType.jiraKey,
      durationMin: eventType.durationMin,
      locationType: eventType.locationType,
      instructionsMd: eventType.instructionsMd,
      interviewers: eventType.interviewers.map((ei) => ({
        name: ei.interviewer.name,
      })),
    },
  });
}
