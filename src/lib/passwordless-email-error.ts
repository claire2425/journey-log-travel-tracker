export type PasswordlessEmailErrorKind =
  | "rate_limited"
  | "email_not_authorized"
  | "redirect_not_allowed"
  | "invalid_email"
  | "network"
  | "unknown";

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
};

function asErrorLike(value: unknown): ErrorLike | undefined {
  return value && typeof value === "object" ? value as ErrorLike : undefined;
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

/**
 * Supabase returns stable Auth error codes, but network failures arrive as
 * browser exceptions. Keeping the classification independent from React makes
 * the sign-in screen explain a recoverable delivery problem accurately.
 */
export function classifyPasswordlessEmailError(error: unknown): PasswordlessEmailErrorKind {
  const details = asErrorLike(error);
  const code = stringField(details?.code);
  const message = stringField(details?.message);
  const name = stringField(details?.name);
  const status = Number(details?.status);

  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || status === 429) {
    return "rate_limited";
  }
  if (code === "email_address_not_authorized") return "email_not_authorized";
  if (code === "redirect_to_not_allowed" || code === "redirect_to_not_authorized") return "redirect_not_allowed";
  if (code === "email_address_invalid") return "invalid_email";
  if (name === "typeerror" || /failed to fetch|networkerror|network request failed/.test(message)) {
    return "network";
  }
  return "unknown";
}
