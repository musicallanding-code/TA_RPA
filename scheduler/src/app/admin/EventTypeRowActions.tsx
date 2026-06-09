"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EventTypeRowActions({
  slug,
  active,
  bookings,
}: {
  slug: string;
  active: boolean;
  bookings: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "更新失敗");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新失敗");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`確定要刪除「${slug}」？此動作無法復原。`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types/${slug}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error || "刪除失敗");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "刪除失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <a href={`/admin/event-types/${slug}`} className="text-brand hover:underline">
        編輯
      </a>
      <button
        type="button"
        onClick={toggleActive}
        disabled={busy}
        className="text-gray-600 hover:underline disabled:opacity-50"
      >
        {active ? "停用" : "啟用"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy || bookings > 0}
        title={bookings > 0 ? "已有預約，請改用停用" : "刪除"}
        className="text-red-600 hover:underline disabled:opacity-30"
      >
        刪除
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
