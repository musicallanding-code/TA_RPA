import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/admin/interviewers/:id/disconnect — unlink Google for an interviewer.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const interviewer = await prisma.interviewer.findUnique({
    where: { id: params.id },
  });
  if (!interviewer) {
    return NextResponse.json({ error: "interviewer not found" }, { status: 404 });
  }

  await prisma.googleCredential
    .delete({ where: { ownerId: interviewer.id } })
    .catch(() => null); // idempotent
  await prisma.interviewer.update({
    where: { id: interviewer.id },
    data: { googleAccountId: null },
  });

  await prisma.auditLog.create({
    data: {
      actor: "admin",
      action: "google.disconnect",
      entity: `Interviewer:${interviewer.id}`,
    },
  });

  return NextResponse.json({ ok: true });
}
