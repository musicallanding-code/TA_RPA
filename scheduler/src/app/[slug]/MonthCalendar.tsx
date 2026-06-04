"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

interface MonthCalendarProps {
  slug: string;
  tz: string;
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

export default function MonthCalendar({
  slug,
  tz,
  selectedDate,
  onSelect,
}: MonthCalendarProps) {
  // First day of the currently displayed month (in the company calendar sense).
  const [viewMonth, setViewMonth] = useState<DateTime>(() =>
    DateTime.now().setZone(tz).startOf("month")
  );
  const [availableDays, setAvailableDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const monthKey = viewMonth.toFormat("yyyy-MM");
  const todayIso = DateTime.now().setZone(tz).toISODate()!;
  const thisMonthStart = DateTime.now().setZone(tz).startOf("month");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/event-types/${encodeURIComponent(slug)}/availability-days?month=${monthKey}&tz=${encodeURIComponent(tz)}`
    )
      .then((res) => (res.ok ? res.json() : { days: [] }))
      .then((data) => {
        if (!cancelled) setAvailableDays(new Set<string>(data.days ?? []));
      })
      .catch(() => {
        if (!cancelled) setAvailableDays(new Set());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, monthKey, tz]);

  // Build the calendar grid: leading blanks + each day of the month.
  const cells = useMemo(() => {
    const daysInMonth = viewMonth.daysInMonth ?? 31;
    const leading = viewMonth.weekday % 7; // Luxon Mon=1..Sun=7 -> 0..6 (Sun=0)
    const out: (DateTime | null)[] = [];
    for (let i = 0; i < leading; i++) out.push(null);
    for (let d = 0; d < daysInMonth; d++) out.push(viewMonth.plus({ days: d }));
    return out;
  }, [viewMonth]);

  const canGoPrev = viewMonth > thisMonthStart;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => canGoPrev && setViewMonth(viewMonth.minus({ months: 1 }))}
          disabled={!canGoPrev}
          aria-label="上個月"
          className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-gray-900">
          {viewMonth.toFormat("yyyy 年 M 月")}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth(viewMonth.plus({ months: 1 }))}
          aria-label="下個月"
          className="rounded p-1 text-gray-500 hover:bg-gray-100"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`b${i}`} />;
          const iso = cell.toISODate()!;
          const isPast = iso < todayIso;
          const hasSlots = availableDays.has(iso);
          const isSelected = iso === selectedDate;
          const clickable = !isPast && hasSlots;
          return (
            <button
              key={iso}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelect(iso)}
              className={[
                "aspect-square rounded-full text-sm transition",
                isSelected
                  ? "bg-brand font-semibold text-white"
                  : clickable
                    ? "font-medium text-brand hover:bg-brand/10"
                    : "text-gray-300",
              ].join(" ")}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="mt-2 text-center text-xs text-gray-400">讀取可預約日…</p>
      )}
    </div>
  );
}
