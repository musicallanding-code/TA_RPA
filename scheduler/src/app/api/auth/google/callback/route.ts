import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/crypto";
import {
  exchangeCode,
  fetchGoogleEmail,
  googleEnabled,
  verifyState,
} from "@/lib/google";

// GET /api/auth/google/callback?code=...&state=...
// Completes OAuth: stores the (encrypted) refresh token and links it to the
// interviewer, so free/busy can be read for their calendar.
export async function GET(req: NextRequest) {
  const back = new URL("/admin/interviewers", req.nextUrl.origin);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    back.searchParams.set("google_error", `Google 授權被拒：${oauthError}`);
    return NextResponse.redirect(back);
  }
  if (!googleEnabled() || !code || !state) {
    back.searchParams.set("google_error", "授權回呼缺少參數或未設定");
    return NextResponse.redirect(back);
  }

  const parsed = verifyState<{ interviewerId: string }>(state);
  if (!parsed?.interviewerId) {
    back.searchParams.set("google_error", "state 驗證失敗");
    return NextResponse.redirect(back);
  }

  const interviewer = await prisma.interviewer.findUnique({
    where: { id: parsed.interviewerId },
  });
  if (!interviewer) {
    back.searchParams.set("google_error", "找不到該面試官");
    return NextResponse.redirect(back);
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refreshToken) {
      // Without a refresh token we can't read free/busy later.
      back.searchParams.set(
        "google_error",
        "未取得 refresh token，請在 Google 帳號移除本應用授權後重試"
      );
      return NextResponse.redirect(back);
    }

    const connectedEmail =
      (tokens.accessToken && (await fetchGoogleEmail(tokens.accessToken))) ||
      interviewer.email;

    const credential = await prisma.googleCredential.upsert({
      where: { ownerId: interviewer.id },
      create: {
        ownerId: interviewer.id,
        accessToken: tokens.accessToken,
        refreshToken: encryptSecret(tokens.refreshToken),
        expiry: tokens.expiryDate ? new Date(tokens.expiryDate) : null,
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: encryptSecret(tokens.refreshToken),
        expiry: tokens.expiryDate ? new Date(tokens.expiryDate) : null,
      },
    });

    await prisma.interviewer.update({
      where: { id: interviewer.id },
      data: { googleAccountId: credential.id },
    });

    await prisma.auditLog.create({
      data: {
        actor: "admin",
        action: "google.connect",
        entity: `Interviewer:${interviewer.id}`,
        after: JSON.stringify({ connectedEmail }),
      },
    });

    back.searchParams.set("google_connected", connectedEmail);
    return NextResponse.redirect(back);
  } catch (err) {
    console.error("google callback failed", err);
    back.searchParams.set("google_error", "授權交換失敗，請重試");
    return NextResponse.redirect(back);
  }
}
