"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface EventTypeValues {
  title: string;
  jiraKey: string;
  durationMin: number;
  locationType: string;
  instructionsMd: string;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeHours: number;
  maxPerDay: number | null;
  bookingWindowDays: number;
  assignment: string;
  active: boolean;
}

export default function EditEventTypeForm({
  slug,
  initial,
}: {
  slug: string;
  initial: EventTypeValues;
}) {
  const router = useRouter();
  const [v, setV] = useState<EventTypeValues>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof EventTypeValues>(key: K, value: EventTypeValues[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/event-types/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...v,
          jiraKey: v.jiraKey || null,
          instructionsMd: v.instructionsMd || null,
          maxPerDay: v.maxPerDay ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          (data.error || "更新失敗") +
            (data.details
              ? `: ${JSON.stringify(data.details.fieldErrors)}`
              : "")
        );
      }
      setMessage("已儲存");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

  return (
    <form
      onSubmit={save}
      className="mt-6 space-y-5 rounded-lg border border-gray-200 bg-white p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">標題 *</span>
          <input
            value={v.title}
            onChange={(e) => set("title", e.target.value)}
            required
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">JIRA 編號</span>
          <input
            value={v.jiraKey}
            onChange={(e) => set("jiraKey", e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">時長 (分鐘)</span>
          <input
            type="number"
            min={5}
            value={v.durationMin}
            onChange={(e) => set("durationMin", Number(e.target.value))}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">地點類型</span>
          <select
            value={v.locationType}
            onChange={(e) => set("locationType", e.target.value)}
            className={inputCls}
          >
            <option value="meet">視訊 (Google Meet)</option>
            <option value="phone">電話</option>
            <option value="onsite">現場</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">指派策略</span>
          <select
            value={v.assignment}
            onChange={(e) => set("assignment", e.target.value)}
            className={inputCls}
          >
            <option value="single">single</option>
            <option value="collective">collective（全員皆空）</option>
            <option value="round_robin">round_robin</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">每日上限 (maxPerDay)</span>
          <input
            type="number"
            min={1}
            value={v.maxPerDay ?? ""}
            placeholder="不限"
            onChange={(e) =>
              set("maxPerDay", e.target.value ? Number(e.target.value) : null)
            }
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">前置緩衝 (分)</span>
          <input
            type="number"
            min={0}
            value={v.bufferBeforeMin}
            onChange={(e) => set("bufferBeforeMin", Number(e.target.value))}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">後置緩衝 (分)</span>
          <input
            type="number"
            min={0}
            value={v.bufferAfterMin}
            onChange={(e) => set("bufferAfterMin", Number(e.target.value))}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">最少提前 (小時)</span>
          <input
            type="number"
            min={0}
            value={v.minNoticeHours}
            onChange={(e) => set("minNoticeHours", Number(e.target.value))}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">可預約天數窗口</span>
          <input
            type="number"
            min={1}
            value={v.bookingWindowDays}
            onChange={(e) => set("bookingWindowDays", Number(e.target.value))}
            className={inputCls}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-gray-700">說明 (Markdown)</span>
        <textarea
          value={v.instructionsMd}
          onChange={(e) => set("instructionsMd", e.target.value)}
          rows={4}
          className={inputCls}
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={v.active}
          onChange={(e) => set("active", e.target.checked)}
        />
        <span className="text-gray-700">啟用（公開頁可見）</span>
      </label>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {saving ? "儲存中…" : "儲存變更"}
        </button>
        {message && <span className="text-sm text-green-700">{message}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
