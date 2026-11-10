import { describe, expect, it } from "vitest";
import { getLocalCalendarDate } from "@/lib/local-date";

describe("local calendar dates", () => {
  it("uses the browser-local calendar rather than UTC at midnight", () => {
    const instant = new Date("2025-12-31T16:30:00.000Z");
    expect(getLocalCalendarDate(instant, "Asia/Taipei")).toBe("2026-01-01");
  });

  it("can correctly fall back to the previous local calendar day", () => {
    const instant = new Date("2026-01-01T00:30:00.000Z");
    expect(getLocalCalendarDate(instant, "America/Los_Angeles")).toBe("2025-12-31");
  });
});
