import { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

// Unambiguous alphabet (no 0/O/1/I) → easier for users to type.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeLicenseKey(): string {
  const bytes = randomBytes(15);
  let out = "";
  for (let i = 0; i < 15; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out; // e.g. AB3CDEF7GHJK9LM
}

/**
 * Generate a license key that isn't already in use. Retries a handful of times
 * on the (astronomically unlikely) collision, then falls back to a longer key.
 */
export async function generateUniqueKey(supabase: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const key = makeLicenseKey();
    const { data } = await supabase.from("app_users").select("id").eq("license_key", key).maybeSingle();
    if (!data) return key;
  }
  return makeLicenseKey() + randomBytes(3).toString("hex").toUpperCase();
}
