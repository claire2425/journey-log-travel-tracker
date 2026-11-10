import { describe, expect, it } from "vitest";
import { DEMO_TRIPS } from "@/lib/demo-trips";
import { getJourneyDepartureLocalDate, getJourneyDepartureLocalYear, getLocalDateTimeInputValue } from "@/lib/journey-date";

describe("journey departure calendar date", () => {
  it("uses the departure place's calendar when UTC falls in the previous year", () => {
    const taipeiNewYear = {
      ...DEMO_TRIPS[1],
      departure: "2025-12-31T16:30:00.000Z",
    };

    expect(getJourneyDepartureLocalDate(taipeiNewYear)).toBe("2026-01-01");
    expect(getJourneyDepartureLocalYear(taipeiNewYear)).toBe(2026);
  });

  it("can correctly move a UTC date back to the previous local calendar day", () => {
    const losAngelesDeparture = {
      ...DEMO_TRIPS[1],
      departure: "2026-01-01T00:30:00.000Z",
      origin: { ...DEMO_TRIPS[1].origin, time_zone: "America/Los_Angeles" },
    };

    expect(getJourneyDepartureLocalDate(losAngelesDeparture)).toBe("2025-12-31");
    expect(getJourneyDepartureLocalYear(losAngelesDeparture)).toBe(2025);
  });

  it("formats stored instants as the endpoint's wall-clock time for editing", () => {
    expect(getLocalDateTimeInputValue("2025-12-31T16:30:00.000Z", "Asia/Taipei")).toBe("2026-01-01T00:30");
    expect(getLocalDateTimeInputValue("2026-01-01T00:30:00.000Z", "America/Los_Angeles")).toBe("2025-12-31T16:30");
  });
});
