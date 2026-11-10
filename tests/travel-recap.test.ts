import { describe, expect, it } from "vitest";
import { DEMO_TRIPS } from "@/lib/demo-trips";
import { calculateJourneyStatistics } from "@/lib/statistics";
import { buildTravelRecap } from "@/lib/travel-recap";

describe("travel recap", () => {
  it("uses only the journeys supplied to it, so a filtered recap stays in scope", () => {
    const selectedTrips = [
      { ...DEMO_TRIPS[0], id: "later", departure: "2026-05-10T03:00:00+09:00" },
      { ...DEMO_TRIPS[2], id: "earlier", departure: "2025-03-03T08:00:00+00:00" },
    ];
    const recap = buildTravelRecap(selectedTrips);

    expect(recap.total_journeys).toBe(2);
    expect(recap.statistics).toEqual(calculateJourneyStatistics(selectedTrips));
    expect(recap.modes.map((mode) => mode.mode)).toEqual(["flight", "rail", "cruise", "other"]);
    expect(recap.recent_journeys.map((trip) => trip.id)).toEqual(["later", "earlier"]);
    expect(recap.annual_visits.map((entry) => entry.year)).toEqual([2026, 2025]);
  });

  it("retains a zero-valued row for every transport mode for stable report layout", () => {
    const recap = buildTravelRecap([]);

    expect(recap.total_journeys).toBe(0);
    expect(recap.modes).toEqual([
      { mode: "flight", journeys: 0, distance_km: 0 },
      { mode: "rail", journeys: 0, distance_km: 0 },
      { mode: "cruise", journeys: 0, distance_km: 0 },
      { mode: "other", journeys: 0, distance_km: 0 },
    ]);
  });
});
