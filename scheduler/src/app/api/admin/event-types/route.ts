import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEventTypeSchema } from "@/lib/validation";

// NOTE (M1): the admin API is not yet protected. M-later wires Google OAuth
// limited to the @cmoney.com.tw domain (SPEC §3.10). Do not expose publicly.

export async function GET() {
  const eventTypes = await prisma.eventType.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      interviewers: { include: { interviewer: true } },
      _count: { select: { bookings: true } },
    },
  });
  return NextResponse.json({ eventTypes });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = createEventTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  const existing = await prisma.eventType.findUnique({
    where: { slug: input.slug },
  });
  if (existing) {
    return NextResponse.json(
      { error: `slug "${input.slug}" 已存在` },
      { status: 409 }
    );
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const eventType = await tx.eventType.create({
        data: {
          slug: input.slug,
          title: input.title,
          jiraKey: input.jiraKey || null,
          durationMin: input.durationMin,
          locationType: input.locationType,
          instructionsMd: input.instructionsMd || null,
          bufferBeforeMin: input.bufferBeforeMin,
          bufferAfterMin: input.bufferAfterMin,
          minNoticeHours: input.minNoticeHours,
          maxPerDay: input.maxPerDay ?? null,
          bookingWindowDays: input.bookingWindowDays,
          assignment: input.assignment,
          active: input.active,
        },
      });

      for (const i of input.interviewers) {
        const interviewer = await tx.interviewer.upsert({
          where: { email: i.email },
          update: { name: i.name },
          create: { name: i.name, email: i.email },
        });
        await tx.eventTypeInterviewer.create({
          data: { eventTypeId: eventType.id, interviewerId: interviewer.id },
        });
        if (i.availability.length > 0) {
          // Replace this interviewer's weekly availability with the submitted set.
          await tx.availability.deleteMany({
            where: { interviewerId: interviewer.id },
          });
          await tx.availability.createMany({
            data: i.availability.map((w) => ({
              interviewerId: interviewer.id,
              dayOfWeek: w.dayOfWeek,
              startTime: w.startTime,
              endTime: w.endTime,
            })),
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actor: "admin",
          action: "event_type.create",
          entity: `EventType:${eventType.id}`,
          after: JSON.stringify({ slug: eventType.slug, title: eventType.title }),
        },
      });

      return eventType;
    });

    return NextResponse.json({ eventType: created }, { status: 201 });
  } catch (err) {
    console.error("create event type failed", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
