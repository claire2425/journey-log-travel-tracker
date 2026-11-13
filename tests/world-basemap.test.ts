import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Topology } from "topojson-specification";
import { basemapFromTopology, findBasemapCountry } from "@/lib/world-basemap";
import { displayCountryName } from "@/lib/country-names";

const topology = JSON.parse(readFileSync(new URL("../public/reference-data/world-countries-50m.json", import.meta.url), "utf8")) as Topology;
const basemap = basemapFromTopology(topology);

describe("bundled world basemap", () => {
  it("decodes Natural Earth countries into drawable rings", () => {
    expect(basemap.countries.length).toBeGreaterThan(200);
    const taiwan = basemap.countries.find((country) => country.name === "Taiwan");
    expect(taiwan?.rings.length).toBeGreaterThan(0);
  });

  it("finds the visited country from a stop's coordinate", () => {
    expect(findBasemapCountry(basemap, [121.517, 25.0478], "Taiwan")?.name).toBe("Taiwan");
    expect(findBasemapCountry(basemap, [2.3553, 48.8809], "France")?.name).toBe("France");
  });

  it("falls back to the recorded country name for an offshore airport", () => {
    // A point in the sea just off Osaka, as an artificial-island airport can be.
    expect(findBasemapCountry(basemap, [135.1, 34.3], "Japan")?.name).toBe("Japan");
    expect(findBasemapCountry(basemap, [-170, -10], "United States")?.name).toBe("United States of America");
  });

  it("shows Traditional-Chinese country names in the Chinese report", () => {
    expect(displayCountryName("United Kingdom", "zh")).toBe("英國");
    expect(displayCountryName("Atlantis", "zh")).toBe("Atlantis");
    expect(displayCountryName("Japan", "en")).toBe("Japan");
  });
});
