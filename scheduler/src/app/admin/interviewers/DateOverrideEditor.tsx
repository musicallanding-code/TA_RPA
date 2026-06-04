"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Override {
  id: string;
  date: string;
  available: boolean;
  startTime: string | null;
  endTime: string | null;
}

export default function DateOverrideEditor({
  interviewerId,
  overrides,
}: {
  interviewerId: string;
  overrides: Override[];
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [available, setAvailable] = useState(false);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/interviewers/${interviewerId}/date-overrides`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            available,
            startTime: available ? startTime : null,
            endTime: available ? endTime : null,
          }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).error || "新增失敗");
      setDate("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "新增失敗");
    } finally {
      setBusy(false);
    }
  }

  async function remove(d: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/interviewers/${interviewerId}/date-overrides?date=${d}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error((await res.json()).error || "刪除失敗");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        特定日覆寫 (DateOverride)
      </p>

      {overrides.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
          {overrides.map((o) => (
            <li key={o.id} className="flex items-center gap-2">
              <span className="font-medium text-gray-800">{o.date}</span>
              {o.available ? (
                <span className="text-green-700">
                  可面試{" "}
                  {o.startTime && o.endTime
                    ? `${o.startTime}–${o.endTime}`
                    : "（沿用每週時段）"}
                </span>
              ) : (
                <span className="text-red-600">休假（封鎖整天）</span>
              )}
              <button
                type="button"
                onClick={() => remove(o.date)}
                disabled={busy}
                className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
              >
                刪除
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-400">尚無覆寫。</p>
      )}

      <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <label className="flex items-center gap-1 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          可面試
        </label>
        {available && (
          <>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
            <span className="text-gray-400">–</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-brand px-3 py-1 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {available ? "新增可面試日" : "新增休假日"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </form>
      <p className="mt-1 text-xs text-gray-400">
        不勾「可面試」= 封鎖整天；勾選但留空時間 = 沿用每週時段。
      </p>
    </div>
  );
}
