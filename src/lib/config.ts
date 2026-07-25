/**
 * Signup gating mode (client-safe).
 *
 *  - "open" (default): no gate — a new account can sign in and use the
 *    dashboard immediately after registering. No admin approval, no email
 *    verification.
 *  - "approval": new signups land in a pending state and an admin approves
 *    them from the Super Admin panel.
 *  - "email": a Brevo verification link is emailed and the user self-verifies.
 *
 * Control with NEXT_PUBLIC_SIGNUP_MODE = open | approval | email.
 */
export type SignupMode = "open" | "approval" | "email";

export function signupMode(): SignupMode {
  const m = (process.env.NEXT_PUBLIC_SIGNUP_MODE || "open").toLowerCase();
  if (m === "email") return "email";
  if (m === "approval") return "approval";
  return "open";
}

export const APPROVAL_MODE = signupMode() === "approval";

// When false, the verified/approval gate is skipped entirely — users sign in
// right after registering. Only "approval" and "email" modes require it.
export const REQUIRE_VERIFICATION = signupMode() !== "open";
