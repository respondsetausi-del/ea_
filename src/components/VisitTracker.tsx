"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/track";

/**
 * Fires a single "visit" event per page load. Drop into any page (e.g. the
 * homepage) to count website traffic in the Super Admin analytics.
 */
export default function VisitTracker() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track("visit", { path: typeof window !== "undefined" ? window.location.pathname : "/" });
  }, []);
  return null;
}
