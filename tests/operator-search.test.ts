import { describe, expect, it } from "vitest";
import { searchOperators } from "@/lib/operator-search";

describe("operator search", () => {
  it("finds worldwide common airlines by code, English, and Traditional Chinese", () => {
    expect(searchOperators("flight", "DL")[0]).toMatchObject({ code: "DL", label: "Delta Air Lines" });
    expect(searchOperators("flight", "turkish")[0]).toMatchObject({ code: "TK" });
    expect(searchOperators("flight", "全日空")[0]).toMatchObject({ code: "NH" });
  });

  it("keeps rail and cruise suggestions isolated by the selected mode", () => {
    expect(searchOperators("rail", "Eurostar")[0]).toMatchObject({ mode: "rail", code: "EUROSTAR" });
    expect(searchOperators("cruise", "MSC")[0]).toMatchObject({ mode: "cruise", code: "MSC" });
    expect(searchOperators("rail", "MSC")).toHaveLength(0);
  });
});
