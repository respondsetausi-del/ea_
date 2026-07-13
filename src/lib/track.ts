"use client";

/**
 * Client-side site-traffic tracking (doc item 3). Best-effort, fire-and-forget —
 * never blocks or throws into the UI. A persistent visitor id (localStorage)
 * lets the dashboard count unique vs returning visitors without any PII.
 */

const VISITOR_KEY = "ea_visitor_id";

function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function track(eventType: "visit" | "login", extra?: { email?: string; path?: string }): void {
  if (typeof window === "undefined") return;
  try {
    fetch("/api/v1/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ event_type: eventType, visitor_id: getVisitorId(), ...extra }),
    }).catch(() => {});
  } catch {
    // ignore — analytics must never break the page
  }
}
