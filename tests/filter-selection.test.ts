import { describe, expect, it } from "vitest";
import { hasAllSelections, toggleAllSelections, toggleSelection } from "@/lib/filter-selection";

describe("multi-select filter helpers", () => {
  const modes = ["flight", "rail", "cruise", "other"] as const;

  it("toggles an individual option without leaving an empty array behind", () => {
    expect(toggleSelection(["flight"], "rail")).toEqual(["flight", "rail"]);
    expect(toggleSelection(["flight"], "flight")).toBeUndefined();
  });

  it("selects every current option then clears only that group", () => {
    expect(hasAllSelections(["flight", "rail"], modes)).toBe(false);
    expect(toggleAllSelections(["flight"], modes)).toEqual(modes);
    expect(hasAllSelections(modes, modes)).toBe(true);
    expect(toggleAllSelections(modes, modes)).toBeUndefined();
  });
});
