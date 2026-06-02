/**
 * Signup gating mode (client-safe).
 *
 *  - "approval" (default): Brevo is asleep. New signups land in a pending
 *    state and an admin approves them from the Super Admin panel.
 *  - "email": the original flow — a Brevo verification link is emailed and
 *    the user self-verifies.
 *
 * Flip with NEXT_PUBLIC_SIGNUP_MODE=email once Brevo is wired up.
 */
export type SignupMode = "approval" | "email";

export function signupMode(): SignupMode {
  return (process.env.NEXT_PUBLIC_SIGNUP_MODE || "approval") === "email" ? "email" : "approval";
}

export const APPROVAL_MODE = signupMode() === "approval";
