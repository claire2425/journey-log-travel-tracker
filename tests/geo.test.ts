import { describe, expect, it } from "vitest";
import { interpolateGreatCircle } from "@/lib/geo";

describe("great-circle interpolation", () => {
  it("keeps the supplied endpoints and creates intermediate points", () => {
    const points = interpolateGreatCircle([121.2342, 25.0797], [135.244, 34.4347], 8);

    expect(points).toHaveLength(9);
    expect(points[0]).toEqual([121.2342, 25.0797]);
    expect(points.at(-1)).toEqual([135.244, 34.4347]);
    expect(points[4]?.[1]).toBeGreaterThan(25.0797);
  });
});
