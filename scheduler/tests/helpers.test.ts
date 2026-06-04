import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";
import { groupByMeridiem } from "@/lib/slots";
import type { Slot } from "@/lib/availability";

describe("slugify", () => {
  it("lowercases, hyphenates whitespace/underscore, strips invalid chars", () => {
    expect(slugify("Senior Recruiter JIRA690")).toBe("senior-recruiter-jira690");
    expect(slugify("  phone_screen  ")).toBe("phone-screen");
    expect(slugify("Hello!!! World")).toBe("hello-world");
  });

  it("collapses repeated and trims edge hyphens", () => {
    expect(slugify("a---b")).toBe("a-b");
    expect(slugify("-edge-")).toBe("edge");
  });

  it("returns empty for purely non-latin titles (caller falls back)", () => {
    expect(slugify("資深人才招募專員")).toBe("");
  });
});

function slot(label: string): Slot {
  return { startUtc: "", endUtc: "", label, interviewerIds: [] };
}

describe("groupByMeridiem", () => {
  it("splits slots into AM (<12:00) and PM (>=12:00)", () => {
    const { am, pm } = groupByMeridiem([
      slot("09:00"),
      slot("11:30"),
      slot("12:00"),
      slot("14:00"),
    ]);
    expect(am.map((s) => s.label)).toEqual(["09:00", "11:30"]);
    expect(pm.map((s) => s.label)).toEqual(["12:00", "14:00"]);
  });
});
