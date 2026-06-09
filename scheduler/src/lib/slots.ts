import type { Slot } from "@/lib/availability";

/** Group slots into morning / afternoon by their display-tz "HH:mm" label. */
export function groupByMeridiem(slots: Slot[]): {
  am: Slot[];
  pm: Slot[];
} {
  const am: Slot[] = [];
  const pm: Slot[] = [];
  for (const s of slots) {
    const hour = parseInt(s.label.slice(0, 2), 10);
    (hour < 12 ? am : pm).push(s);
  }
  return { am, pm };
}
