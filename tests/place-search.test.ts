import { describe, expect, it } from "vitest";
import { REFERENCE_PLACES } from "@/lib/demo-trips";
import { searchPlaces } from "@/lib/place-search";
import type { SearchablePlace } from "@/lib/place-search";

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

  it("searches alternate airport codes and multilingual aliases", () => {
    const songshan: SearchablePlace = {
      id: "airport:ourairports:RCSS",
      name_zh: "臺北松山機場",
      name_en: "Taipei Songshan International Airport",
      code: "TSA",
      aliases: ["RCSS", "台北松山機場"],
      kind: "airport",
      latitude: 25.067244,
      longitude: 121.552822,
      country: "Taiwan",
      city: "Taipei",
      continent: "asia",
      time_zone: "Asia/Taipei",
      scheduled_service: true,
    };
    expect(searchPlaces([songshan], "RCSS")[0]?.code).toBe("TSA");
    expect(searchPlaces([songshan], "台北松山")[0]?.name_zh).toBe("臺北松山機場");
  });
});
