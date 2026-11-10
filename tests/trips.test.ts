import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { JourneyDatabase } from "@/db/index";
import { addTrip, clearDemoTrips, deleteTrip, getTrip, listTrips, loadDemoTrips, updateTrip } from "@/db/trips";
import { DEMO_TRIPS } from "@/lib/demo-trips";
import type { Place, Trip } from "@/lib/types";

const tpe: Place = { id: "tpe", name_zh: "桃園", name_en: "Taipei", code: "TPE", kind: "airport", latitude: 25.0797, longitude: 121.2342, country: "Taiwan", time_zone: "Asia/Taipei" };
const lhr: Place = { id: "lhr", name_zh: "倫敦希斯洛", name_en: "London Heathrow", code: "LHR", kind: "airport", latitude: 51.47, longitude: -0.4543, country: "United Kingdom", time_zone: "Europe/London" };

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1", mode: "flight", origin: tpe, destination: lhr,
    departure: "2026-01-10T09:00:00+08:00", arrival: "2026-01-10T17:30:00+00:00",
    carrier: "Example Air", service_number: "EX101", seat_class: "Economy", seat: "21A",
    distance_km: 9788, distance_is_estimate: false, duration_min: 990, notes: "", tags: ["work"],
    is_demo: false, created_at: "2026-01-01T00:00:00+00:00", updated_at: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

describe("trip repository", () => {
  let database: JourneyDatabase;

  beforeEach(async () => {
    database = new JourneyDatabase(`test-${crypto.randomUUID()}`);
    await database.open();
  });

  it("adds, gets, updates and deletes a trip", async () => {
    await addTrip(trip(), database);
    expect((await getTrip("trip-1", database))?.origin.code).toBe("TPE");
    await updateTrip(trip({ notes: "Window seat" }), database);
    expect((await getTrip("trip-1", database))?.notes).toBe("Window seat");
    await deleteTrip("trip-1", database);
    expect(await getTrip("trip-1", database)).toBeUndefined();
  });

  it("filters trips by mode, year and text", async () => {
    await addTrip(trip(), database);
    await addTrip(trip({ id: "trip-2", mode: "rail", departure: "2025-06-01T09:00:00+08:00", arrival: "2025-06-01T10:00:00+08:00", service_number: "THSR 805" }), database);
    expect(await listTrips({ mode: "rail" }, database)).toHaveLength(1);
    expect(await listTrips({ year: 2026 }, database)).toHaveLength(1);
    expect((await listTrips({ search: "london" }, database))[0]?.id).toBe("trip-1");
  });

  it("removes only demo trips", async () => {
    await addTrip(trip({ is_demo: true }), database);
    await addTrip(trip({ id: "real-trip" }), database);
    await clearDemoTrips(database);
    expect(await listTrips({}, database)).toHaveLength(1);
    expect(await getTrip("real-trip", database)).toBeDefined();
  });

  it("loads fixed demo data without duplicates and preserves real trips", async () => {
    await addTrip(trip({ id: "real-trip" }), database);
    expect(await loadDemoTrips(database)).toBe(DEMO_TRIPS.length);
    expect(await loadDemoTrips(database)).toBe(DEMO_TRIPS.length);
    expect(await listTrips({}, database)).toHaveLength(DEMO_TRIPS.length + 1);
    expect(await getTrip("real-trip", database)).toBeDefined();
  });
});
