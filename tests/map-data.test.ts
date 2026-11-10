import { describe, expect, it } from "vitest";
import { createJourneyMapData } from "@/lib/map-data";
import { DEMO_TRIPS } from "@/lib/demo-trips";

describe("journey map data", () => {
  it("builds a route for every journey and deduplicates shared stops", () => {
    const data = createJourneyMapData([DEMO_TRIPS[0], DEMO_TRIPS[1]]);

    expect(data.routes.features).toHaveLength(2);
    expect(data.stops.features).toHaveLength(2);
    expect(data.coordinates.length).toBeGreaterThan(2);
    expect(data.routes.features[0]?.geometry.coordinates[0]).toEqual([135.244, 34.4347]);
  });
});
