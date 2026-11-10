import { describe, expect, it } from "vitest";
import { DEMO_TRIPS } from "@/lib/demo-trips";
import { classifyDisplayedTripLegs } from "@/lib/route-patterns";

describe("displayed route patterns", () => {
  it("pairs reverse legs once, including journeys using different transport modes", () => {
    const outbound = DEMO_TRIPS[1];
    const returnByRail = { ...DEMO_TRIPS[0], id: "return-by-rail", mode: "rail" as const };
    const extraOutbound = {
      ...outbound,
      id: "unmatched-outbound",
      departure: "2026-10-20T09:10:00+08:00",
      arrival: "2026-10-20T12:45:00+09:00",
    };

    const patterns = classifyDisplayedTripLegs([extraOutbound, returnByRail, outbound]);

    expect(patterns.get(outbound.id)).toBe("paired_return");
    expect(patterns.get(returnByRail.id)).toBe("paired_return");
    expect(patterns.get(extraOutbound.id)).toBe("one_way");
  });

  it("does not pair overlapping legs or same-stop journeys", () => {
    const outbound = DEMO_TRIPS[1];
    const overlappingReturn = {
      ...DEMO_TRIPS[0],
      id: "overlapping-return",
      departure: "2026-10-14T11:00:00+09:00",
      arrival: "2026-10-14T13:00:00+08:00",
    };
    const sameStop = {
      ...outbound,
      id: "same-stop",
      origin: outbound.origin,
      destination: outbound.origin,
      departure: "2026-10-21T09:10:00+08:00",
      arrival: "2026-10-21T10:10:00+08:00",
    };

    const patterns = classifyDisplayedTripLegs([outbound, overlappingReturn, sameStop]);

    expect(patterns.get(outbound.id)).toBe("one_way");
    expect(patterns.get(overlappingReturn.id)).toBe("one_way");
    expect(patterns.get(sameStop.id)).toBe("one_way");
  });
});
