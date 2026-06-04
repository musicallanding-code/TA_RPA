import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dateOverrideSchema } from "@/lib/validation";

// POST /api/admin/interviewers/:id/date-overrides
// Upsert a specific-day override (block a day off, or set a custom window).
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const parsed = dateOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const interviewer = await prisma.interviewer.findUnique({
    where: { id: params.id },
  });
  if (!interviewer) {
    return NextResponse.json({ error: "interviewer not found" }, { status: 404 });
  }

  const { date, available, startTime, endTime } = parsed.data;
  const override = await prisma.dateOverride.upsert({
    where: { interviewerId_date: { interviewerId: params.id, date } },
    create: {
      interviewerId: params.id,
      date,
      available,
      startTime: available ? startTime ?? null : null,
      endTime: available ? endTime ?? null : null,
    },
    update: {
      available,
      startTime: available ? startTime ?? null : null,
      endTime: available ? endTime ?? null : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actor: "admin",
      action: "date_override.upsert",
      entity: `Interviewer:${params.id}`,
      after: JSON.stringify(override),
    },
  });

  return NextResponse.json({ override });
}

// DELETE /api/admin/interviewers/:id/date-overrides?date=YYYY-MM-DD
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const date = new URL(req.url).searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date query param required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  await prisma.dateOverride
    .delete({
      where: { interviewerId_date: { interviewerId: params.id, date } },
    })
    .catch(() => null); // idempotent: deleting a missing override is fine

  await prisma.auditLog.create({
    data: {
      actor: "admin",
      action: "date_override.delete",
      entity: `Interviewer:${params.id}`,
      after: JSON.stringify({ date }),
    },
  });

  return NextResponse.json({ ok: true });
}
