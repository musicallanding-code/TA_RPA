import { z } from "zod";

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時間需為 HH:mm 格式");

export const availabilityWindowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: hhmm,
    endTime: hhmm,
  })
  .refine((w) => w.startTime < w.endTime, {
    message: "startTime 必須早於 endTime",
  });

export const createEventTypeSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug 僅能包含小寫英數與連字號"),
  title: z.string().min(1, "請輸入標題"),
  jiraKey: z.string().optional().nullable(),
  durationMin: z.number().int().positive().default(60),
  locationType: z.enum(["phone", "meet", "onsite"]).default("meet"),
  instructionsMd: z.string().optional().nullable(),
  bufferBeforeMin: z.number().int().min(0).default(0),
  bufferAfterMin: z.number().int().min(0).default(0),
  minNoticeHours: z.number().int().min(0).default(12),
  maxPerDay: z.number().int().positive().optional().nullable(),
  bookingWindowDays: z.number().int().positive().default(30),
  assignment: z
    .enum(["single", "collective", "round_robin"])
    .default("single"),
  active: z.boolean().default(true),
  // Interviewers to attach: existing emails are linked/created on the fly.
  interviewers: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        availability: z.array(availabilityWindowSchema).default([]),
      })
    )
    .default([]),
});

export type CreateEventTypeInput = z.infer<typeof createEventTypeSchema>;
