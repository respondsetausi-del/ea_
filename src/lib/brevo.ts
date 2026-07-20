/**
 * Brevo (Sendinblue) transactional email helper.
 *
 * Requires the following env vars (set in .env.local — see .env.example):
 *   BREVO_API_KEY        - your Brevo API v3 key
 *   BREVO_SENDER_EMAIL   - a verified sender email in your Brevo account
 *   BREVO_SENDER_NAME    - display name for the sender (optional)
 *
 * If BREVO_API_KEY is missing, sends are skipped gracefully (logged, not thrown)
 * so signup/verify still work in local/dev without email configured.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export function isBrevoConfigured(): boolean {
  return !!(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

export interface SendEmailArgs {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
}

export interface SendEmailResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendEmail({ to, toName, subject, htmlContent }: SendEmailArgs): Promise<SendEmailResult> {
  if (!isBrevoConfigured()) {
    console.warn(`[brevo] Not configured — skipping email "${subject}" to ${to}`);
    return { sent: false, skipped: true };
  }

  try {
    const res = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY as string,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: process.env.BREVO_SENDER_EMAIL,
          name: process.env.BREVO_SENDER_NAME || "Free Robot",
        },
        to: [{ email: to, name: toName || to }],
        subject,
        htmlContent,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[brevo] Send failed (${res.status}):`, text);
      return { sent: false, error: `Brevo responded ${res.status}` };
    }

    return { sent: true };
  } catch (err) {
    console.error("[brevo] Send error:", err);
    return { sent: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Shared brand colors / wrapper for our emails. */
const ACCENT = "#FFB800";

function emailShell(title: string, bodyHtml: string): string {
  return `
  <div style="margin:0;padding:0;background:#0b0f0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
      <div style="text-align:center;margin-bottom:28px;">
        <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:1px;">FREE ROBOT</span>
      </div>
      <div style="background:#11161300;background-color:#121814;border:1px solid rgba(255,184,0,0.25);border-radius:18px;padding:32px 28px;">
        <h1 style="margin:0 0 14px;font-size:20px;color:#ffffff;font-weight:800;">${title}</h1>
        ${bodyHtml}
      </div>
      <p style="text-align:center;color:#5b635e;font-size:12px;margin-top:24px;">
        Your data is secure with EA Access.
      </p>
    </div>
  </div>`;
}

function ctaButton(href: string, label: string): string {
  return `
    <div style="text-align:center;margin:26px 0 8px;">
      <a href="${href}" style="display:inline-block;background:${ACCENT};color:#03210c;text-decoration:none;font-weight:800;font-size:15px;padding:14px 34px;border-radius:12px;">
        ${label}
      </a>
    </div>`;
}

/**
 * Reusable Quick Server promotional banner (doc item 1). Drop into any email
 * body with `${quickServerBanner()}`. The destination is configurable via the
 * QUICK_SERVER_URL env var so the link can change without a code edit.
 */
export function quickServerBanner(): string {
  const url = process.env.QUICK_SERVER_URL || "https://free-app-site.vercel.app";
  return `
    <div style="margin:24px 0 4px;background:linear-gradient(135deg,#1c2416,#121814);border:1px solid rgba(255,184,0,0.3);border-radius:16px;padding:22px 20px;text-align:center;">
      <div style="font-size:11px;font-weight:800;letter-spacing:2px;color:${ACCENT};text-transform:uppercase;margin-bottom:8px;">Quick Server</div>
      <div style="font-size:17px;font-weight:800;color:#ffffff;margin:0 0 8px;">Power Your Trading with Quick Server</div>
      <p style="font-size:13px;color:#c7cdd0;line-height:20px;margin:0 0 16px;">
        Experience fast execution, reliable connectivity, and an optimized trading environment designed for automated trading.
      </p>
      <a href="${url}" style="display:inline-block;background:${ACCENT};color:#03210c;text-decoration:none;font-weight:800;font-size:14px;padding:12px 28px;border-radius:10px;">
        Connect to Quick Server
      </a>
    </div>`;
}

/**
 * New-user welcome email (doc item 1). Sent immediately after a distributor
 * registers a new app user. Includes login instructions, a support prompt and
 * the Quick Server banner. It deliberately does NOT contain the access key —
 * that ships separately in the license email.
 */
export function welcomeEmail(appName: string, loginUrl?: string): { subject: string; htmlContent: string } {
  const app = appName || "EA Access";
  const subject = `Welcome to ${app} 🎉`;
  const htmlContent = emailShell(
    `Welcome to ${app}`,
    `
    <p style="color:#c7cdd0;font-size:14px;line-height:22px;margin:0 0 12px;">
      Your ${app} account has been registered &mdash; you're all set to start automated trading from your phone.
    </p>
    <p style="color:#c7cdd0;font-size:14px;line-height:22px;margin:0 0 4px;">
      <b style="color:#ffffff;">How to log in:</b> open the ${app} app, enter this email address, then enter the access key we send you in a separate email.
    </p>
    <p style="color:#8a8f92;font-size:13px;line-height:20px;margin:12px 0 0;">
      Need a hand? Just reply to this email and our support team will help.
    </p>
    ${quickServerBanner()}${loginUrl ? ctaButton(loginUrl, `Open ${app}`) : ""}`
  );
  return { subject, htmlContent };
}

export function verificationEmail(name: string, verifyUrl: string): { subject: string; htmlContent: string } {
  const subject = "Verify your Free Robot distributor account";
  const htmlContent = emailShell(
    "Confirm your email",
    `
    <p style="color:#c7cdd0;font-size:14px;line-height:22px;margin:0 0 6px;">
      Hi ${name || "there"},
    </p>
    <p style="color:#c7cdd0;font-size:14px;line-height:22px;margin:0;">
      Thanks for signing up as a Free Robot distributor. Confirm your email to activate your account and unlock dashboard access.
    </p>
    ${ctaButton(verifyUrl, "Verify & Activate")}
    <p style="color:#8a8f92;font-size:12px;line-height:18px;margin:18px 0 0;">
      If the button doesn't work, paste this link into your browser:<br/>
      <a href="${verifyUrl}" style="color:${ACCENT};word-break:break-all;">${verifyUrl}</a>
    </p>`
  );
  return { subject, htmlContent };
}

export function licenseEmail(appName: string, licenseKey: string): { subject: string; htmlContent: string } {
  const app = appName || "Free Robot";
  const subject = `Your ${app} access key`;
  const htmlContent = emailShell(
    "Your access key is ready",
    `
    <p style="color:#c7cdd0;font-size:14px;line-height:22px;margin:0 0 16px;">
      Use the access key below to log into the ${app} app. Enter your email and this key on the login screen.
    </p>
    <div style="text-align:center;margin:8px 0 20px;">
      <div style="display:inline-block;background:#0b0f0c;border:1px dashed ${ACCENT};border-radius:12px;padding:16px 24px;">
        <span style="font-family:'Courier New',monospace;font-size:20px;font-weight:800;letter-spacing:2px;color:${ACCENT};">${licenseKey}</span>
      </div>
    </div>
    <p style="color:#8a8f92;font-size:12px;line-height:18px;margin:0;">
      Keep this key private — it's tied to your email and grants access to your bot. If you didn't request this, you can ignore this email.
    </p>
    ${quickServerBanner()}`
  );
  return { subject, htmlContent };
}

export function passwordResetEmail(name: string, resetUrl: string): { subject: string; htmlContent: string } {
  const subject = "Reset your Free Robot password";
  const htmlContent = emailShell(
    "Reset your password",
    `
    <p style="color:#c7cdd0;font-size:14px;line-height:22px;margin:0 0 6px;">
      Hi ${name || "there"},
    </p>
    <p style="color:#c7cdd0;font-size:14px;line-height:22px;margin:0;">
      We received a request to reset your distributor account password. Click the
      button below to choose a new one. This link expires in 1 hour.
    </p>
    ${ctaButton(resetUrl, "Reset Password")}
    <p style="color:#8a8f92;font-size:12px;line-height:18px;margin:18px 0 0;">
      If the button doesn't work, paste this link into your browser:<br/>
      <a href="${resetUrl}" style="color:${ACCENT};word-break:break-all;">${resetUrl}</a>
    </p>
    <p style="color:#8a8f92;font-size:12px;line-height:18px;margin:14px 0 0;">
      Didn't request this? You can safely ignore this email — your password won't change.
    </p>`
  );
  return { subject, htmlContent };
}

export function accessGrantedEmail(name: string, loginUrl: string): { subject: string; htmlContent: string } {
  const subject = "Your Free Robot account is approved 🎉";
  const htmlContent = emailShell(
    "You're approved!",
    `
    <p style="color:#c7cdd0;font-size:14px;line-height:22px;margin:0 0 6px;">
      Hi ${name || "there"},
    </p>
    <p style="color:#c7cdd0;font-size:14px;line-height:22px;margin:0;">
      Your email is verified and your distributor account is now active. You can sign in and start setting up your bots and branding.
    </p>
    ${ctaButton(loginUrl, "Sign In to Dashboard")}`
  );
  return { subject, htmlContent };
}
