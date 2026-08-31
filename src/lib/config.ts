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

// Approval is a rule about who may sell on this platform, not a deployment
// setting. These were derived from NEXT_PUBLIC_SIGNUP_MODE, which defaults to
// "open" and is not set on the deployment — so every gate that read them was
// switched off in production and anyone who registered could sign in at once.
// The pending queue never held a single person.
//
// Hard-coded rather than defaulted, so no missing environment variable can
// quietly reopen the door. signupMode() is left in place for anything that
// still wants to know which flavour was configured.
export const APPROVAL_MODE = true;
export const REQUIRE_VERIFICATION = true;

