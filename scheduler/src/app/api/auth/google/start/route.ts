import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUrl, googleEnabled, signState } from "@/lib/google";

// GET /api/auth/google/start?interviewerId=xxx
// Kicks off the OAuth consent flow to connect an interviewer's Google calendar.
export async function GET(req: NextRequest) {
  const interviewerId = req.nextUrl.searchParams.get("interviewerId");
  const back = new URL("/admin/interviewers", req.nextUrl.origin);

  if (!googleEnabled()) {
    back.searchParams.set("google_error", "Google 整合尚未設定（缺少憑證或加密金鑰）");
    return NextResponse.redirect(back);
  }
  if (!interviewerId) {
    back.searchParams.set("google_error", "缺少 interviewerId");
    return NextResponse.redirect(back);
  }

  const interviewer = await prisma.interviewer.findUnique({
    where: { id: interviewerId },
  });
  if (!interviewer) {
    back.searchParams.set("google_error", "找不到該面試官");
    return NextResponse.redirect(back);
  }

  const state = signState({ interviewerId, ts: Date.now() });
  return NextResponse.redirect(getAuthUrl(state));
}
