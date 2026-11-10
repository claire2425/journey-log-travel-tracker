import { describe, expect, it } from "vitest";
import { calculateJourneyStatistics, EARTH_EQUATORIAL_CIRCUMFERENCE_KM, earthLapsForDistance } from "@/lib/statistics";
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
    const cruise = { ...DEMO_TRIPS[0], id: "cruise-trip", distance_km: 50, duration_min: 30, mode: "cruise" as const };

    expect(calculateJourneyStatistics([flight, rail, cruise])).toEqual({
      totalTrips: 3,
      totalDistanceKm: 350,
      totalDurationMin: 210,
      countriesVisited: 3,
      modeCounts: { flight: 1, rail: 1, cruise: 1, other: 0 },
      modeDistanceKm: { flight: 100, rail: 200, cruise: 50, other: 0 },
    });
  });

  it("converts distance to an approximate number of Earth laps", () => {
    expect(earthLapsForDistance(0)).toBe(0);
    expect(earthLapsForDistance(EARTH_EQUATORIAL_CIRCUMFERENCE_KM)).toBeCloseTo(1);
  });
});
