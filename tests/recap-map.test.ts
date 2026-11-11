import { describe, expect, it } from "vitest";
import {
  createSchematicJourneyMap,
  projectSchematicWorldCoordinate,
  splitPathAtDateLine,
} from "@/lib/recap-map";
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
