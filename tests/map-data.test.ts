import { describe, expect, it } from "vitest";
import { countryColor } from "@/lib/journey-colors";
import { createJourneyMapData } from "@/lib/map-data";
import { DEMO_TRIPS } from "@/lib/demo-trips";

describe("journey map data", () => {
  it("builds a route for every journey and deduplicates shared stops", () => {
    const cruise = { ...DEMO_TRIPS[0], id: "demo-cruise", mode: "cruise" as const };
    const data = createJourneyMapData([DEMO_TRIPS[0], DEMO_TRIPS[1], cruise]);

    expect(data.routes.features).toHaveLength(3);
    expect(data.stops.features).toHaveLength(2);
    expect(data.coordinates.length).toBeGreaterThan(2);
    expect(data.routes.features[0]?.geometry.coordinates[0]).toEqual([135.244, 34.4347]);
    expect(data.routes.features[2]?.properties.mode).toBe("cruise");
    expect(data.stops.features[0]?.properties).toMatchObject({
      country: "Japan",
      country_color: countryColor("Japan"),
    });
    expect(data.countryLegend).toEqual([
      { country: "Japan", color: countryColor("Japan") },
      { country: "Taiwan", color: countryColor("Taiwan") },
    ]);
  });
});
