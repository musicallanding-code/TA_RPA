"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import MonthCalendar from "./MonthCalendar";

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

function splitMeridiem(slots: Slot[]): { am: Slot[]; pm: Slot[] } {
  const am: Slot[] = [];
  const pm: Slot[] = [];
  for (const s of slots) {
    (parseInt(s.label.slice(0, 2), 10) < 12 ? am : pm).push(s);
  }
  return { am, pm };
}

export default function BookingPanel({ slug }: { slug: string }) {
  const [tz, setTz] = useState<string>("Asia/Taipei");
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected(null);
    fetch(
      `/api/event-types/${encodeURIComponent(slug)}/availability?date=${date}&tz=${encodeURIComponent(tz)}`
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

  const { am, pm } = splitMeridiem(slots);
  const prettyDate = date
    ? DateTime.fromISO(date).setLocale("zh-TW").toFormat("M 月 d 日 (ccc)")
    : null;

  return (
    <div className="md:grid md:grid-cols-[1fr_minmax(0,260px)] md:gap-8">
      {/* Calendar */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">選擇日期與時間</h2>
        <MonthCalendar
          slug={slug}
          tz={tz}
          selectedDate={date}
          onSelect={setDate}
        />
        <label className="mt-4 block">
          <span className="block text-xs font-medium text-gray-500">時區</span>
          <select
            value={tz}
            onChange={(e) => {
              setTz(e.target.value);
              setDate(null);
            }}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {COMMON_TZS.map((z) => (
              <option key={z} value={z}>
                {z === "Asia/Taipei" ? "Taipei Time (Asia/Taipei)" : z}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Slots for the chosen day */}
      <div className="mt-6 md:mt-0">
        {!date && (
          <p className="text-sm text-gray-500">← 請先在左側選一個可預約日。</p>
        )}
        {date && (
          <>
            <p className="mb-3 text-sm font-medium text-gray-900">{prettyDate}</p>
            {loading && <p className="text-sm text-gray-500">讀取時段…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {!loading && !error && slots.length === 0 && (
              <p className="text-sm text-gray-500">這天沒有可預約的時段。</p>
            )}
            {!loading && !error && slots.length > 0 && (
              <div className="space-y-4">
                {am.length > 0 && (
                  <SlotGroup
                    title="上午"
                    slots={am}
                    selected={selected}
                    onSelect={setSelected}
                  />
                )}
                {pm.length > 0 && (
                  <SlotGroup
                    title="下午"
                    slots={pm}
                    selected={selected}
                    onSelect={setSelected}
                  />
                )}
              </div>
            )}
            {selected && (
              <div className="mt-5 rounded-md bg-gray-50 p-3 text-sm text-gray-700">
                已選擇 {selected.label}（{tz}）。
                <p className="mt-1 text-xs text-gray-500">
                  M1 僅展示時段選取；填表與建立預約於 M3 完成。
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SlotGroup({
  title,
  slots,
  selected,
  onSelect,
}: {
  title: string;
  slots: Slot[];
  selected: Slot | null;
  onSelect: (s: Slot) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((s) => (
          <button
            key={s.startUtc}
            onClick={() => onSelect(s)}
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
    </div>
  );
}
