"use client";

import { useEffect, useState } from "react";

interface Slot {
  startUtc: string;
  endUtc: string;
  label: string;
  interviewerIds: string[];
}

const COMMON_TZS = [
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Singapore",
  "America/Los_Angeles",
  "UTC",
];

function todayLocalIso(): string {
  const d = new Date();
  // local date in YYYY-MM-DD
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function BookingPanel({ slug }: { slug: string }) {
  const [date, setDate] = useState<string>(todayLocalIso());
  const [tz, setTz] = useState<string>("Asia/Taipei");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected(null);
    fetch(
      `/api/event-types/${encodeURIComponent(slug)}/availability?date=${date}&tz=${encodeURIComponent(
        tz
      )}`
    )
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || "讀取失敗");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, date, tz]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">選擇日期與時間</h2>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-xs font-medium text-gray-500">日期</span>
          <input
            type="date"
            value={date}
            min={todayLocalIso()}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-gray-500">時區</span>
          <select
            value={tz}
            onChange={(e) => setTz(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {COMMON_TZS.map((z) => (
              <option key={z} value={z}>
                {z === "Asia/Taipei" ? "Taipei Time (Asia/Taipei)" : z}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6">
        {loading && <p className="text-sm text-gray-500">讀取可預約時段…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && slots.length === 0 && (
          <p className="text-sm text-gray-500">這天沒有可預約的時段。</p>
        )}
        {!loading && !error && slots.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {slots.map((s) => (
              <button
                key={s.startUtc}
                onClick={() => setSelected(s)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
                  selected?.startUtc === s.startUtc
                    ? "border-brand bg-brand text-white"
                    : "border-brand/40 text-brand hover:border-brand"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="mt-6 rounded-md bg-gray-50 p-4 text-sm text-gray-700">
          已選擇 <strong>{date}</strong> {selected.label}（{tz}）。
          <p className="mt-1 text-xs text-gray-500">
            M1 僅展示時段選取；填表與建立預約於 M3 完成。
          </p>
        </div>
      )}
    </div>
  );
}
