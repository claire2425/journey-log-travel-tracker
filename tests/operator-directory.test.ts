import { describe, expect, it } from "vitest";
import {
  OPERATOR_DIRECTORY,
  identifyOperator,
  lookupOperator,
  normalizeServiceNumber,
} from "@/lib/operator-directory";

describe("operator directory", () => {
  it("identifies known flight and rail operators from common service number forms", () => {
    expect(identifyOperator("flight", " br-198 ")).toMatchObject({
      code: "BR",
      label: "EVA Air",
      label_zh: "長榮航空",
    });
    expect(identifyOperator("rail", "HSR 615")).toMatchObject({
      code: "THSR",
      label: "Taiwan High Speed Rail",
    });
    expect(identifyOperator("flight", "HSR 615")).toBeUndefined();
    expect(identifyOperator("cruise", "BR 198")).toBeUndefined();
  });

  it("looks up an operator by code or alias and normalizes a service number", () => {
    expect(lookupOperator(" cal ", "flight")).toMatchObject({ code: "CI" });
    expect(lookupOperator("hsr", "rail")).toMatchObject({ code: "THSR" });
    expect(lookupOperator("CI", "rail")).toBeUndefined();
    expect(normalizeServiceNumber(" BR — 198 ")).toBe("BR198");
  });

  it("contains local display marks rather than remote logo URLs", () => {
    expect(OPERATOR_DIRECTORY).not.toHaveLength(0);
    expect(OPERATOR_DIRECTORY.every((operator) => (
      /^#[0-9A-F]{6}$/.test(operator.brand_color)
      && operator.logo_text.length > 0
      && !Object.keys(operator).some((key) => key.toLowerCase().includes("url"))
    ))).toBe(true);
  });
});
