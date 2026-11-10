import { describe, expect, it } from "vitest";
import { DEMO_TRIPS } from "@/lib/demo-trips";
import { calculateAnnualVisitStatistics } from "@/lib/visit-statistics";

describe("annual visit statistics", () => {
  it("counts continents, countries, and cities independently by departure-local year", () => {
    const results = calculateAnnualVisitStatistics([
      DEMO_TRIPS[0],
      DEMO_TRIPS[1],
      DEMO_TRIPS[2],
    ]);

    expect(results).toEqual([
      { year: 2026, continents: 1, countries: 2, cities: 2 },
      { year: 2025, continents: 1, countries: 1, cities: 2 },
    ]);
  });

  it("falls back to an endpoint name when legacy places do not have a city", () => {
    const legacyPlace = { ...DEMO_TRIPS[0].origin, city: undefined };
    const results = calculateAnnualVisitStatistics([{ ...DEMO_TRIPS[0], origin: legacyPlace }]);

    expect(results[0]).toMatchObject({ year: 2026, cities: 2 });
  });
});
