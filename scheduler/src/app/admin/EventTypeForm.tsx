"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

interface AvailabilityRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export default function EventTypeForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [jiraKey, setJiraKey] = useState("");
  const [durationMin, setDurationMin] = useState(60);
  const [locationType, setLocationType] = useState("meet");
  const [instructionsMd, setInstructionsMd] = useState("");
  const [assignment, setAssignment] = useState("single");
  const [interviewerName, setInterviewerName] = useState("");
  const [interviewerEmail, setInterviewerEmail] = useState("");
  const [rows, setRows] = useState<AvailabilityRow[]>([
    { dayOfWeek: 1, startTime: "10:00", endTime: "12:00" },
    { dayOfWeek: 3, startTime: "14:00", endTime: "17:00" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateRow(idx: number, patch: Partial<AvailabilityRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    );
  }
  function addRow() {
    setRows((prev) => [
      ...prev,
      { dayOfWeek: 2, startTime: "10:00", endTime: "12:00" },
    ]);
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    const interviewers =
      interviewerName && interviewerEmail
        ? [
            {
              name: interviewerName,
              email: interviewerEmail,
              availability: rows,
            },
          ]
        : [];

    try {
      const res = await fetch("/api/admin/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title,
          jiraKey: jiraKey || null,
          durationMin: Number(durationMin),
          locationType,
          instructionsMd: instructionsMd || null,
          assignment,
          interviewers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error +
            (data.details ? `: ${JSON.stringify(data.details.fieldErrors)}` : "")
        );
      }
      setMessage(`已建立：${data.eventType.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立失敗");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

  return (
    <form
      onSubmit={submit}
      className="mt-4 space-y-5 rounded-lg border border-gray-200 bg-white p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-gray-700">slug *</span>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="senior-recruiter-jira690"
            required
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">標題 *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="職能：資深人才招募專員"
            required
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">JIRA 編號</span>
          <input
            value={jiraKey}
            onChange={(e) => setJiraKey(e.target.value)}
            placeholder="JIRA690"
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">時長 (分鐘)</span>
          <input
            type="number"
            min={5}
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            className={inputCls}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-gray-700">地點類型</span>
          <select
            value={locationType}
            onChange={(e) => setLocationType(e.target.value)}
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
            value={assignment}
            onChange={(e) => setAssignment(e.target.value)}
            className={inputCls}
          >
            <option value="single">single</option>
            <option value="collective">collective（全員皆空）</option>
            <option value="round_robin">round_robin</option>
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-gray-700">說明 (Markdown)</span>
        <textarea
          value={instructionsMd}
          onChange={(e) => setInstructionsMd(e.target.value)}
          rows={4}
          placeholder={"預約面試請填中文姓名\nEmail 請與 104 履歷一致\n此關卡會致電進行"}
          className={inputCls}
        />
      </label>

      <fieldset className="rounded-md border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">
          面試官與每週可面試時段
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-gray-700">姓名</span>
            <input
              value={interviewerName}
              onChange={(e) => setInterviewerName(e.target.value)}
              placeholder="黃琬心"
              className={inputCls}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Email</span>
            <input
              type="email"
              value={interviewerEmail}
              onChange={(e) => setInterviewerEmail(e.target.value)}
              placeholder="interviewer@cmoney.com.tw"
              className={inputCls}
            />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <select
                value={row.dayOfWeek}
                onChange={(e) =>
                  updateRow(idx, { dayOfWeek: Number(e.target.value) })
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                {DAY_LABELS.map((d, i) => (
                  <option key={i} value={i}>
                    週{d}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={row.startTime}
                onChange={(e) => updateRow(idx, { startTime: e.target.value })}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
              <span className="text-gray-400">–</span>
              <input
                type="time"
                value={row.endTime}
                onChange={(e) => updateRow(idx, { endTime: e.target.value })}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeRow(idx)}
                className="text-xs text-red-600 hover:underline"
              >
                刪除
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="text-sm text-brand hover:underline"
          >
            + 新增時段
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          留空面試官姓名 / Email 則只建立關卡，稍後再指派。
        </p>
      </fieldset>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? "建立中…" : "建立 Event Type"}
        </button>
        {message && <span className="text-sm text-green-700">{message}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
