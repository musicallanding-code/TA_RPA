import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateEventTypeSchema } from "@/lib/validation";

// NOTE (M1): admin endpoints are not yet auth-protected (SPEC §3.10, M-later).

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const eventType = await prisma.eventType.findUnique({
    where: { slug: params.slug },
    include: {
      interviewers: { include: { interviewer: true } },
      _count: { select: { bookings: true } },
    },
  });
  if (!eventType) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ eventType });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = updateEventTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.eventType.findUnique({
    where: { slug: params.slug },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const data = parsed.data;
  const updated = await prisma.eventType.update({
    where: { slug: params.slug },
    data: {
      ...data,
      jiraKey: data.jiraKey === undefined ? undefined : data.jiraKey || null,
      instructionsMd:
        data.instructionsMd === undefined ? undefined : data.instructionsMd || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actor: "admin",
      action: "event_type.update",
      entity: `EventType:${existing.id}`,
      before: JSON.stringify(existing),
      after: JSON.stringify(updated),
    },
  });

  return NextResponse.json({ eventType: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const existing = await prisma.eventType.findUnique({
    where: { slug: params.slug },
    include: { _count: { select: { bookings: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (existing._count.bookings > 0) {
    return NextResponse.json(
      { error: "此關卡已有預約，請改為停用 (active=false) 而非刪除" },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.eventTypeInterviewer.deleteMany({
      where: { eventTypeId: existing.id },
    }),
    prisma.eventType.delete({ where: { id: existing.id } }),
    prisma.auditLog.create({
      data: {
        actor: "admin",
        action: "event_type.delete",
        entity: `EventType:${existing.id}`,
        before: JSON.stringify(existing),
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
