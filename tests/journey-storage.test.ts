import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { JourneyDatabase } from "@/db/index";
import { CustomPlaceInUseError, deleteCustomPlace, saveJourneyWithCustomPlaces, updateCustomPlaceAndJourneyReferences } from "@/db/journey-storage";
import type { Place, Trip } from "@/lib/types";

const tpe: Place = {
  id: "tpe",
  name_zh: "桃園國際機場",
  name_en: "Taiwan Taoyuan International Airport",
  code: "TPE",
  kind: "airport",
  latitude: 25.0797,
  longitude: 121.2342,
  country: "Taiwan",
  time_zone: "Asia/Taipei",
};

const lhr: Place = {
  id: "lhr",
  name_zh: "倫敦希斯洛機場",
  name_en: "London Heathrow Airport",
  code: "LHR",
  kind: "airport",
  latitude: 51.47,
  longitude: -0.4543,
  country: "United Kingdom",
  time_zone: "Europe/London",
};

const savedPlace: Place = {
  id: "saved-taipei-main",
  name_zh: "台北車站",
  name_en: "Taipei Main Station",
  code: "TPE-R",
  kind: "station",
  latitude: 25.0478,
  longitude: 121.517,
  country: "Taiwan",
  time_zone: "Asia/Taipei",
};

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    mode: "flight",
    origin: tpe,
    destination: lhr,
    departure: "2026-01-10T09:00:00+08:00",
    arrival: "2026-01-10T17:30:00+00:00",
    carrier: "Example Air",
    service_number: "EX101",
    seat_class: "Economy",
    seat: "21A",
    distance_km: 9788,
    distance_is_estimate: false,
    duration_min: 990,
    notes: "",
    tags: ["work"],
    is_demo: false,
    created_at: "2026-01-01T00:00:00+00:00",
    updated_at: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

describe("journey storage", () => {
  let database: JourneyDatabase;

  beforeEach(async () => {
    database = new JourneyDatabase(`journey-storage-${crypto.randomUUID()}`);
    await database.open();
  });

  it("persists locally saved places and a journey together", async () => {
    const id = await saveJourneyWithCustomPlaces({
      trip: trip({ origin: savedPlace }),
      customPlaces: [savedPlace],
    }, database);

    expect(id).toBe("trip-1");
    expect(await database.custom_places.get(savedPlace.id)).toMatchObject({
      id: savedPlace.id,
      code: "TPE-R",
    });
    expect(await database.trips.get("trip-1")).toMatchObject({
      id: "trip-1",
      origin: { id: savedPlace.id },
    });
  });

  it("rolls back saved places when the journey write fails", async () => {
    await database.trips.add(trip());
    const placeOnlyForFailedSave = { ...savedPlace, id: "place-that-must-roll-back" };

    await expect(saveJourneyWithCustomPlaces({
      trip: trip({ origin: placeOnlyForFailedSave }),
      customPlaces: [placeOnlyForFailedSave],
    }, database)).rejects.toThrow();

    expect(await database.custom_places.get(placeOnlyForFailedSave.id)).toBeUndefined();
    expect(await database.trips.get("trip-1")).toMatchObject({ origin: { id: "tpe" } });
  });

  it("deletes an unused saved place and reports a missing one", async () => {
    await database.custom_places.put(savedPlace);

    await expect(deleteCustomPlace(` ${savedPlace.id} `, database)).resolves.toBe("deleted");
    expect(await database.custom_places.get(savedPlace.id)).toBeUndefined();
    await expect(deleteCustomPlace(savedPlace.id, database)).resolves.toBe("not_found");
  });

  it("keeps a saved place when a journey still references it", async () => {
    await saveJourneyWithCustomPlaces({
      trip: trip({ destination: savedPlace }),
      customPlaces: [savedPlace],
    }, database);

    await expect(deleteCustomPlace(savedPlace.id, database)).rejects.toBeInstanceOf(CustomPlaceInUseError);
    expect(await database.custom_places.get(savedPlace.id)).toBeDefined();
    expect(await database.trips.get("trip-1")).toBeDefined();
  });

  it("updates a saved place and its embedded journey endpoints together", async () => {
    await saveJourneyWithCustomPlaces({
      trip: trip({ origin: savedPlace }),
      customPlaces: [savedPlace],
    }, database);

    await updateCustomPlaceAndJourneyReferences({ ...savedPlace, continent: "asia" }, database);

    expect(await database.custom_places.get(savedPlace.id)).toMatchObject({ continent: "asia" });
    expect(await database.trips.get("trip-1")).toMatchObject({ origin: { id: savedPlace.id, continent: "asia" } });
  });

  it("updates an existing journey atomically instead of adding another record", async () => {
    await saveJourneyWithCustomPlaces({ trip: trip() }, database);
    const updated = trip({ carrier: "Changed carrier", updated_at: "2026-01-02T00:00:00+00:00" });

    await saveJourneyWithCustomPlaces({ trip: updated, operation: "update" }, database);

    expect(await database.trips.count()).toBe(1);
    expect(await database.trips.get("trip-1")).toMatchObject({ carrier: "Changed carrier" });
  });
});
