import { describe, expect, it } from "vitest";
import { REFERENCE_PLACES } from "@/lib/demo-trips";
import { searchPlaces } from "@/lib/place-search";

const airports = REFERENCE_PLACES.filter((place) => place.kind === "airport");
const stations = REFERENCE_PLACES.filter((place) => place.kind === "station");

describe("local place search", () => {
  it("matches airport codes as the user types, including full-width input", () => {
    expect(searchPlaces(airports, "t")[0]?.code).toBe("TPE");
    expect(searchPlaces(airports, "ＴＰＥ").map((place) => place.code)).toEqual(["TPE"]);
  });

  it("matches local names and cities", () => {
    expect(searchPlaces(stations, "台北").map((place) => place.code)).toContain("TPE-R");
    expect(searchPlaces(stations, "tokyo").map((place) => place.code)).toContain("TYO-R");
  });

  it("only returns the place kinds passed by the journey mode", () => {
    expect(searchPlaces(airports, "tai").map((place) => place.code)).toEqual(["TPE"]);
    expect(searchPlaces(stations, "tai").map((place) => place.code)).toEqual(expect.arrayContaining(["TPE-R", "TCG"]));
  });
});
