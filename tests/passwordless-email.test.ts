import { describe, expect, it } from "vitest";
import { passwordlessEmailOptions } from "@/lib/passwordless-email";

describe("passwordless email options", () => {
  it("allows a magic link to return to the exact browser origin", () => {
    expect(passwordlessEmailOptions("https://journey-log.example.com")).toEqual({
      shouldCreateUser: true,
      emailRedirectTo: "https://journey-log.example.com",
    });
  });
});
