/**
 * Options shared by both supported email sign-in formats. A Supabase project
 * can send either its default magic link or a custom email OTP; the app must
 * request a safe return URL for the former without preventing the latter.
 */
export function passwordlessEmailOptions(origin: string) {
  return {
    shouldCreateUser: true,
    emailRedirectTo: origin,
  };
}
