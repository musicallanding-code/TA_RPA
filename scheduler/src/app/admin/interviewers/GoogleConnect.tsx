"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GoogleConnect({
  interviewerId,
  connected,
  enabled,
}: {
  interviewerId: string;
  connected: boolean;
  enabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!enabled) {
    return (
      <span className="text-xs text-gray-400">
        Google 整合未設定（需 OAuth 憑證 + 加密金鑰）
      </span>
    );
  }

  async function disconnect() {
    if (!confirm("中斷此面試官的 Google 連接？之後將不再讀取其行事曆忙碌時段。")) {
      return;
    }
    setBusy(true);
    try {
      await fetch(`/api/admin/interviewers/${interviewerId}/disconnect`, {
        method: "POST",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (connected) {
    return (
      <span className="flex items-center gap-2 text-sm">
        <span className="text-green-700">✅ 已連接 Google 行事曆</span>
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          className="text-xs text-gray-500 hover:text-red-600 hover:underline disabled:opacity-50"
        >
          中斷連接
        </button>
      </span>
    );
  }

  return (
    <a
      href={`/api/auth/google/start?interviewerId=${interviewerId}`}
      className="inline-flex items-center gap-1 rounded-md border border-brand/40 px-3 py-1 text-sm font-medium text-brand hover:border-brand"
    >
      連接 Google 帳號
    </a>
  );
}
