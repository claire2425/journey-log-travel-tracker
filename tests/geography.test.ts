import { describe, expect, it } from "vitest";
import { getPlaceContinent, getTripContinents, getTripDistanceBand } from "@/lib/geography";
import type { Place, Trip } from "@/lib/types";

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: "place", name_zh: "地點", name_en: "Place", code: "PLC", kind: "custom",
    latitude: 0, longitude: 0, country: "Taiwan", time_zone: "Asia/Taipei",
    ...overrides,
  };
}

function trip(distance_km: number, origin = place(), destination = place({ id: "destination", country: "United Kingdom", time_zone: "Europe/London" })): Pick<Trip, "distance_km" | "origin" | "destination"> {
  return { distance_km, origin, destination };
}

describe("journey geography helpers", () => {
  it("uses an explicit continent before the limited country fallback", () => {
    expect(getPlaceContinent(place())).toBe("asia");
    expect(getPlaceContinent(place({ country: "United Kingdom" }))).toBe("europe");
    expect(getPlaceContinent(place({ country: "Unknown place" }))).toBeUndefined();
    expect(getPlaceContinent(place({ continent: "oceania" }))).toBe("oceania");
  });

  it("returns known continents from either endpoint only once", () => {
    expect(getTripContinents(trip(100))).toEqual(["asia", "europe"]);
    expect(getTripContinents(trip(100, place({ continent: "asia" }), place({ id: "same", continent: "asia" })))).toEqual(["asia"]);
  });

  it("uses inclusive thresholds consistently for journey length", () => {
    expect(getTripDistanceBand(trip(0))).toBe("short");
    expect(getTripDistanceBand(trip(799.999))).toBe("short");
    expect(getTripDistanceBand(trip(800))).toBe("medium");
    expect(getTripDistanceBand(trip(3499.999))).toBe("medium");
    expect(getTripDistanceBand(trip(3500))).toBe("long");
  });
});
