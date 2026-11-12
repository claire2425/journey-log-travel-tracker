import { describe, expect, it } from "vitest";
import { classifyPasswordlessEmailError } from "@/lib/passwordless-email-error";

describe("passwordless email errors", () => {
  it("identifies Supabase's project-wide email sending limit", () => {
    expect(classifyPasswordlessEmailError({ code: "over_email_send_rate_limit", status: 429 })).toBe("rate_limited");
  });

  it("identifies delivery, redirect, and input configuration problems", () => {
    expect(classifyPasswordlessEmailError({ code: "email_address_not_authorized" })).toBe("email_not_authorized");
    expect(classifyPasswordlessEmailError({ code: "redirect_to_not_allowed" })).toBe("redirect_not_allowed");
    expect(classifyPasswordlessEmailError({ code: "email_address_invalid" })).toBe("invalid_email");
  });

  it("identifies browser network failures without exposing a raw error", () => {
    expect(classifyPasswordlessEmailError(new TypeError("Failed to fetch"))).toBe("network");
  });

  it("falls back safely for an unknown response", () => {
    expect(classifyPasswordlessEmailError({ code: "something_new" })).toBe("unknown");
  });
});
