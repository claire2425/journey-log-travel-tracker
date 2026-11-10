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

  it("exposes paired returns and unmatched one-way routes", () => {
    const returnByRail = { ...DEMO_TRIPS[0], id: "demo-return-by-rail", mode: "rail" as const };
    const data = createJourneyMapData([DEMO_TRIPS[1], returnByRail, DEMO_TRIPS[6]]);
    const routeProperties = Object.fromEntries(data.routes.features.map((feature) => [feature.properties.id, feature.properties]));

    expect(routeProperties[DEMO_TRIPS[1].id]?.route_pattern).toBe("paired_return");
    expect(routeProperties[returnByRail.id]?.route_pattern).toBe("paired_return");
    expect(routeProperties[DEMO_TRIPS[6].id]?.route_pattern).toBe("one_way");
  });

  it("uses the origin-local departure date for route popup data", () => {
    const taipeiNewYear = {
      ...DEMO_TRIPS[1],
      id: "taipei-new-year",
      departure: "2025-12-31T16:30:00.000Z",
      arrival: "2025-12-31T19:30:00.000Z",
    };

    const data = createJourneyMapData([taipeiNewYear]);

    expect(data.routes.features[0]?.properties.date).toBe("2026-01-01");
  });
});
