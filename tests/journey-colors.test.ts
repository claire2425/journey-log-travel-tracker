import { describe, expect, it } from "vitest";
import { countryColor, modeColor } from "@/lib/journey-colors";

describe("journey colours", () => {
  it("uses one shared colour for each transport mode", () => {
    expect(modeColor("flight")).toBe("#4a6f8f");
    expect(modeColor("rail")).toBe("#6e8c5c");
    expect(modeColor("cruise")).toBe("#b06f4e");
    expect(modeColor("other")).toBe("#7e6c9a");
  });

  it("keeps each country's colour stable across calls and normalized names", () => {
    expect(countryColor("Taiwan")).toBe(countryColor(" taiwan "));
    expect(new Set(["Taiwan", "Japan", "United Kingdom", "France"].map(countryColor)).size).toBe(4);
    expect(countryColor("Brazil")).toMatch(/^#[0-9a-f]{6}$/i);
    expect(countryColor("Brazil")).toBe(countryColor("Brazil"));
  });
});
