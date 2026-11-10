import { describe, expect, it } from "vitest";
import { displayPlaceCode, isReferenceStationIdentifier } from "@/lib/place-display";
import type { Place } from "@/lib/types";

const station: Place = {
  id: "station:geonames:1850146",
  code: "STN-1850146",
  kind: "station",
  name_zh: "東京站",
  name_en: "Tokyo Station",
  latitude: 35.681236,
  longitude: 139.767125,
  country: "Japan",
  city: "Tokyo",
  continent: "asia",
  time_zone: "Asia/Tokyo",
};

describe("place display labels", () => {
  it("does not present a source record ID as an international station code", () => {
    expect(isReferenceStationIdentifier(station)).toBe(true);
    expect(displayPlaceCode(station)).toBeUndefined();
    expect(displayPlaceCode({ ...station, code: "HND", kind: "airport" })).toBe("HND");
  });
});
