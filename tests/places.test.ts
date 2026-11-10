import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { JourneyDatabase } from "@/db/index";
import { listCustomPlaces, saveCustomPlace } from "@/db/places";

describe("custom place repository", () => {
  let database: JourneyDatabase;

  beforeEach(async () => {
    database = new JourneyDatabase(`places-${crypto.randomUUID()}`);
    await database.open();
  });

  it("normalizes and upserts a place by id without creating a duplicate", async () => {
    const saved = await saveCustomPlace({
      id: " taipei-main ",
      name_zh: " 台北車站 ",
      name_en: " Taipei Main Station ",
      code: " tpe-r ",
      kind: "station",
      latitude: 25.0478,
      longitude: 121.517,
      country: " Taiwan ",
      time_zone: " Asia/Taipei ",
    }, database);
    await saveCustomPlace({ ...saved, name_en: "Taipei Main" }, database);

    expect(saved).toMatchObject({
      id: "taipei-main",
      code: "TPE-R",
      name_zh: "台北車站",
      country: "Taiwan",
    });
    expect(await listCustomPlaces(database)).toEqual([
      expect.objectContaining({ id: "taipei-main", name_en: "Taipei Main", code: "TPE-R" }),
    ]);
  });

  it("rejects invalid input before IndexedDB is changed", async () => {
    await expect(saveCustomPlace({
      name_zh: "",
      name_en: "Broken",
      code: "BAD",
      kind: "custom",
      latitude: 25,
      longitude: 121,
      country: "Taiwan",
      time_zone: "Asia/Taipei",
    }, database)).rejects.toThrow();

    expect(await listCustomPlaces(database)).toEqual([]);
  });
});
