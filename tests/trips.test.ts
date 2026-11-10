import "fake-indexeddb/auto";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { JourneyDatabase } from "@/db/index";
import { addTrip, clearDemoTrips, deleteTrip, getTrip, listTrips, loadDemoTrips, updateTrip } from "@/db/trips";
import { DEMO_TRIPS } from "@/lib/demo-trips";
import { TripSchema, type Place, type Trip } from "@/lib/types";

const tpe: Place = { id: "tpe", name_zh: "桃園", name_en: "Taipei", code: "TPE", kind: "airport", latitude: 25.0797, longitude: 121.2342, country: "Taiwan", time_zone: "Asia/Taipei" };
const lhr: Place = { id: "lhr", name_zh: "倫敦希斯洛", name_en: "London Heathrow", code: "LHR", kind: "airport", latitude: 51.47, longitude: -0.4543, country: "United Kingdom", time_zone: "Europe/London" };
const nrt: Place = { id: "nrt", name_zh: "成田", name_en: "Narita", code: "NRT", kind: "airport", latitude: 35.772, longitude: 140.3929, country: "Japan", time_zone: "Asia/Tokyo" };
const cdg: Place = { id: "cdg", name_zh: "巴黎戴高樂", name_en: "Paris Charles de Gaulle", code: "CDG", kind: "airport", latitude: 49.0097, longitude: 2.5479, country: "France", time_zone: "Europe/Paris" };
const syd: Place = { id: "syd", name_zh: "雪梨", name_en: "Sydney", code: "SYD", kind: "airport", latitude: -33.9399, longitude: 151.1753, country: "Australia", continent: "oceania", time_zone: "Australia/Sydney" };

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
    await addTrip(trip({ id: "trip-3", mode: "cruise", departure: "2024-06-01T09:00:00+08:00", arrival: "2024-06-01T10:00:00+08:00", service_number: "SEA 805" }), database);
    expect(await listTrips({ mode: "rail" }, database)).toHaveLength(1);
    expect(await listTrips({ mode: "cruise" }, database)).toHaveLength(1);
    expect(await listTrips({ year: 2026 }, database)).toHaveLength(1);
    expect((await listTrips({ search: "london" }, database))[0]?.id).toBe("trip-1");
  });

  it("filters by the origin's local departure year across a UTC year boundary", async () => {
    await addTrip(trip({
      id: "taipei-new-year",
      departure: "2025-12-31T16:30:00.000Z",
      arrival: "2025-12-31T19:30:00.000Z",
    }), database);

    expect((await listTrips({ year: 2026 }, database)).map((item) => item.id)).toEqual(["taipei-new-year"]);
    expect(await listTrips({ year: 2025 }, database)).toHaveLength(0);
  });

  it("combines multi-select journey filters while preserving legacy mode and year filters", async () => {
    await addTrip(trip({ purpose: "business" }), database);
    await addTrip(trip({
      id: "trip-2", mode: "rail", origin: nrt, destination: nrt,
      departure: "2025-06-01T09:00:00+09:00", arrival: "2025-06-01T10:00:00+09:00",
      service_number: "SR 21", distance_km: 445, duration_min: 60, purpose: "leisure",
    }), database);
    await addTrip(trip({
      id: "trip-3", mode: "cruise", origin: lhr, destination: cdg,
      departure: "2024-06-01T09:00:00+01:00", arrival: "2024-06-01T12:00:00+02:00",
      service_number: "CR 1", distance_km: 800, duration_min: 120, purpose: "other",
    }), database);
    await addTrip(trip({
      id: "trip-4", mode: "other", origin: syd, destination: syd,
      departure: "2023-06-01T09:00:00+10:00", arrival: "2023-06-01T10:00:00+10:00",
      service_number: "", distance_km: 3500, duration_min: 60,
    }), database);

    expect((await listTrips({ modes: ["rail", "cruise"] }, database)).map((item) => item.id)).toEqual(["trip-2", "trip-3"]);
    expect((await listTrips({ mode: "flight", modes: ["rail"] }, database)).map((item) => item.id)).toEqual(["trip-1", "trip-2"]);
    expect((await listTrips({ years: [2025, 2023] }, database)).map((item) => item.id)).toEqual(["trip-2", "trip-4"]);
    expect((await listTrips({ year: 2026, years: [2024] }, database)).map((item) => item.id)).toEqual(["trip-1", "trip-3"]);

    // Taiwan and Japan have no stored continent, so this verifies the limited
    // country fallback. Europe matches either endpoint of trip-1 and both of trip-3.
    expect((await listTrips({ continents: ["asia"] }, database)).map((item) => item.id)).toEqual(["trip-1", "trip-2"]);
    expect((await listTrips({ continents: ["europe"] }, database)).map((item) => item.id)).toEqual(["trip-1", "trip-3"]);
    expect((await listTrips({ continents: ["oceania"] }, database)).map((item) => item.id)).toEqual(["trip-4"]);

    expect((await listTrips({ distance_bands: ["short"] }, database)).map((item) => item.id)).toEqual(["trip-2"]);
    expect((await listTrips({ distance_bands: ["medium"] }, database)).map((item) => item.id)).toEqual(["trip-3"]);
    expect((await listTrips({ distance_bands: ["long"] }, database)).map((item) => item.id)).toEqual(["trip-1", "trip-4"]);
    expect((await listTrips({ purposes: ["business", "unclassified"] }, database)).map((item) => item.id)).toEqual(["trip-1", "trip-4"]);

    expect((await listTrips({
      modes: ["flight", "rail"],
      continents: ["asia"],
      distance_bands: ["long"],
      purposes: ["business"],
    }, database)).map((item) => item.id)).toEqual(["trip-1"]);
  });

  it("normalizes an optional carrier code and accepts only http(s) logo URLs", async () => {
    await addTrip(trip({
      carrier_code: " br ",
      carrier_logo_url: " https://example.test/eva-air.svg ",
    }), database);

    expect(await getTrip("trip-1", database)).toMatchObject({
      carrier_code: "BR",
      carrier_logo_url: "https://example.test/eva-air.svg",
    });
    expect(() => TripSchema.parse(trip({ carrier_code: "not a code" }))).toThrow();
    expect(() => TripSchema.parse(trip({ carrier_logo_url: "ftp://example.test/logo.svg" }))).toThrow();
  });

  it("normalizes legacy high-speed rail records and preserves their details during the database upgrade", async () => {
    const legacyDatabaseName = `legacy-${crypto.randomUUID()}`;
    const legacyDatabase = new Dexie(legacyDatabaseName);
    legacyDatabase.version(2).stores({
      trips: "id, departure, mode, origin.code, destination.code, is_demo",
      custom_places: "id, code, kind",
      expense_entries: "id, date, paid_by, currency, category",
      expense_settings: "id",
    });
    await legacyDatabase.open();
    await legacyDatabase.table("trips").add({ ...trip({ id: "legacy-hsr" }), mode: "hsr" });
    legacyDatabase.close();

    const upgradedDatabase = new JourneyDatabase(legacyDatabaseName);
    await upgradedDatabase.open();

    expect((await upgradedDatabase.trips.get("legacy-hsr"))?.mode).toBe("rail");
    expect((await getTrip("legacy-hsr", upgradedDatabase))?.origin.code).toBe("TPE");
    expect(await listTrips({ mode: "rail" }, upgradedDatabase)).toHaveLength(1);
    upgradedDatabase.close();
  });

  it("accepts cruises and normalizes legacy high-speed rail input at the validation boundary", () => {
    expect(TripSchema.parse({ ...trip(), mode: "cruise" }).mode).toBe("cruise");
    expect(TripSchema.parse({ ...trip(), mode: "hsr" }).mode).toBe("rail");
    expect(TripSchema.parse(trip()).purpose).toBeUndefined();
    expect(TripSchema.parse({ ...trip(), purpose: " Business " }).purpose).toBe("business");
    expect(TripSchema.parse({ ...trip(), origin: { ...tpe, continent: "asia" } }).origin.continent).toBe("asia");
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
