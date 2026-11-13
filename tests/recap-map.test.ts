import { describe, expect, it } from "vitest";
import {
  chooseCentralLongitude,
  clusterStops,
  createSchematicJourneyMap,
  fitMercatorView,
  kilometresPerPixel,
  planFootprintRegions,
  projectMercator,
  projectMercatorPath,
  projectSchematicWorldCoordinate,
  splitPathAtDateLine,
} from "@/lib/recap-map";
import type { Coordinate } from "@/lib/geo";
import { DEMO_TRIPS } from "@/lib/demo-trips";

describe("PNG footprint-map data", () => {
  it("splits a Pacific route at the date line instead of drawing it across the map", () => {
    expect(splitPathAtDateLine([[170, 10], [-170, 20]])).toEqual([
      [[170, 10], [180, 15]],
      [[-180, 15], [-170, 20]],
    ]);
  });

  it("uses the full report frame for the equirectangular drawing", () => {
    const frame = { x: 10, y: 20, width: 360, height: 170 };
    expect(projectSchematicWorldCoordinate([-180, 85], frame)).toEqual({ x: 10, y: 20 });
    expect(projectSchematicWorldCoordinate([180, -85], frame)).toEqual({ x: 370, y: 190 });
  });

  it("collapses a paired return into one thicker visual route", () => {
    const map = createSchematicJourneyMap([DEMO_TRIPS[0]!, DEMO_TRIPS[1]!]);

    expect(map.routes).toHaveLength(1);
    expect(map.routes[0]).toMatchObject({ mode: "flight", route_pattern: "paired_return" });
    expect(map.stops).toHaveLength(2);
  });

  it("keeps the return styling when an extra one-way record shares that route", () => {
    const duplicate = { ...DEMO_TRIPS[0]!, id: "extra-one-way-on-return" };
    const map = createSchematicJourneyMap([DEMO_TRIPS[0]!, DEMO_TRIPS[1]!, duplicate]);

    expect(map.routes).toHaveLength(1);
    expect(map.routes[0]?.route_pattern).toBe("paired_return");
  });

  it("does not draw exact duplicate one-way records more than once", () => {
    const original = DEMO_TRIPS[0]!;
    const duplicate = { ...original, id: "duplicate-one-way" };
    const map = createSchematicJourneyMap([original, duplicate]);

    expect(map.routes).toHaveLength(1);
    expect(map.routes[0]?.route_pattern).toBe("one_way");
  });
});

describe("fitted footprint map", () => {
  const frame = { x: 0, y: 0, width: 1000, height: 500 };

  it("centres the map across the Pacific when that is where the journeys are", () => {
    const centre = chooseCentralLongitude([121, 140, -158, -118]);
    // Taipei → Los Angeles spans the Pacific, so the centre must lie in it.
    expect(centre > 140 || centre < -158).toBe(true);
  });

  it("keeps a Pacific route continuous instead of splitting it at the date line", () => {
    const view = fitMercatorView([[140, 35], [-118, 34]], frame);
    const points = projectMercatorPath([[140, 35], [179, 40], [-179, 40], [-118, 34]], view);
    // Heading east the whole way: x must keep increasing, with no jump back across the map.
    for (let index = 1; index < points.length; index += 1) {
      expect(points[index]!.x).toBeGreaterThan(points[index - 1]!.x);
    }
    expect(points.every((point) => point.x >= 0 && point.x <= frame.width)).toBe(true);
  });

  it("zooms in on short domestic journeys and keeps every stop inside the frame", () => {
    const stops: Coordinate[] = [[121.517, 25.0478], [120.308, 22.687], [121.6116, 23.9923]];
    const view = fitMercatorView(stops, frame, { padding: 40 });
    const projected = stops.map((stop) => projectMercator(stop, view));
    for (const point of projected) {
      expect(point.x).toBeGreaterThanOrEqual(40 - 0.001);
      expect(point.x).toBeLessThanOrEqual(960 + 0.001);
      expect(point.y).toBeGreaterThanOrEqual(40 - 0.001);
      expect(point.y).toBeLessThanOrEqual(460 + 0.001);
    }
    // Roughly 280 km of Taiwan should fill a large part of the frame height.
    const height = Math.max(...projected.map((p) => p.y)) - Math.min(...projected.map((p) => p.y));
    expect(height).toBeGreaterThan(300);
  });

  it("groups nearby stops and leaves distant ones in separate regions", () => {
    const map = createSchematicJourneyMap(DEMO_TRIPS);
    const clusters = clusterStops(map.stops, 1000);
    const sorted = clusters.map((cluster) => cluster.map((stop) => stop.country).sort()).sort();
    expect(clusters).toHaveLength(3);
    expect(sorted.some((countries) => countries.every((country) => country === "Taiwan"))).toBe(true);
    expect(sorted.some((countries) => countries.includes("France") && countries.includes("United Kingdom"))).toBe(true);
  });

  it("adds enlarged panels for regions that would be cramped on a long-haul overview", () => {
    const map = createSchematicJourneyMap(DEMO_TRIPS);
    const coordinates = [...map.stops.map((stop) => stop.coordinate), ...map.routes.flatMap((route) => route.coordinates)];
    const overview = fitMercatorView(coordinates, { x: 0, y: 0, width: 1376, height: 600 });
    const regions = planFootprintRegions(map, overview);
    expect(regions).toHaveLength(3);
    // Ordered west to east, matching the numbered boxes on the overview.
    expect(regions[0]!.countries).toEqual(expect.arrayContaining(["United Kingdom", "France"]));
    expect(regions.every((region) => region.stops.length >= 2)).toBe(true);
  });

  it("does not add enlarged panels when every stop is already in one region", () => {
    const taiwanOnly = DEMO_TRIPS.filter((trip) => trip.origin.country === "Taiwan" && trip.destination.country === "Taiwan");
    const map = createSchematicJourneyMap(taiwanOnly);
    const overview = fitMercatorView(map.stops.map((stop) => stop.coordinate), { x: 0, y: 0, width: 1376, height: 680 });
    expect(planFootprintRegions(map, overview)).toEqual([]);
  });

  it("reports a sensible map scale", () => {
    const view = fitMercatorView([[0, 0], [10, 0]], { x: 0, y: 0, width: 1110, height: 500 }, { padding: 0 });
    // 10° of longitude at the equator is about 1,112 km across 1,110 px.
    expect(kilometresPerPixel(view, 0)).toBeCloseTo(1.002, 2);
  });
});
