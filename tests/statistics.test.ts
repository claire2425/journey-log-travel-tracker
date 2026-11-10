import { describe, expect, it } from "vitest";
import { calculateJourneyStatistics } from "@/lib/statistics";
import { DEMO_TRIPS } from "@/lib/demo-trips";

describe("journey statistics", () => {
  it("sums distance, duration, countries, and travel modes", () => {
    const flight = { ...DEMO_TRIPS[0], distance_km: 100, duration_min: 60, mode: "flight" as const };
    const rail = {
      ...DEMO_TRIPS[2],
      origin: { ...DEMO_TRIPS[2].origin, country: "Japan" },
      destination: { ...DEMO_TRIPS[2].destination, country: "United Kingdom" },
      distance_km: 200,
      duration_min: 120,
      mode: "rail" as const,
    };

    expect(calculateJourneyStatistics([flight, rail])).toEqual({
      totalTrips: 2,
      totalDistanceKm: 300,
      totalDurationMin: 180,
      countriesVisited: 3,
      modeCounts: { flight: 1, hsr: 0, rail: 1, other: 0 },
    });
  });
});
