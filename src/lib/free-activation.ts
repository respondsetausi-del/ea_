import { SupabaseClient } from "@supabase/supabase-js";
import { isOwnerEmail, isSuperAdminEmail } from "./admin";

/**
 * Free Activation — the public, mentor-less licensing flow.
 *
 * A single flagship robot backs it (default name below). The owner just needs
 * one EA with this name in their account; free activation then issues licenses
 * for it. The target can also be pinned explicitly via FREE_ACTIVATION_MENTOR_ID
 * (the EA's mentor_id), which wins over name matching.
 */
export const FREE_ACTIVATION_EA_NAME = "EA ACCESS SCALPER";

export interface FreeActivationEA {
  id: string;
  name: string;
  mentor_id: string;
  distributor_id: string;
  is_active: boolean;
}

/**
 * Resolve which EA the Free Activation flow issues licenses for.
 *   1. An EA explicitly toggled on in Super Admin (is_free_activation = true).
 *   2. FREE_ACTIVATION_MENTOR_ID env → that exact EA (ops override).
 *   3. Otherwise an EA named "EA ACCESS SCALPER", preferring one that is active
 *      and owned by the owner / a super admin (zero-config fallback).
 * Returns null when nothing matches (feature effectively off).
 *
 * Every step is defensive: the is_free_activation column may not exist yet
 * (migration not run) — that just falls through to the env/name resolution.
 */
export async function resolveFreeActivationEA(supabase: SupabaseClient): Promise<FreeActivationEA | null> {
  const cols = "id, name, mentor_id, distributor_id, is_active";

  // 1. Explicit toggle (preferred). Tolerate a missing column pre-migration.
  const flagged = await supabase.from("eas").select(cols).eq("is_free_activation", true);
  if (!flagged.error && flagged.data && flagged.data.length > 0) {
    const list = flagged.data as FreeActivationEA[];
    return list.find(e => e.is_active) || list[0];
  }

  // 2. Explicit env override.
  const envMentor = process.env.FREE_ACTIVATION_MENTOR_ID?.trim();
  if (envMentor) {
    const { data } = await supabase.from("eas").select(cols).eq("mentor_id", envMentor).maybeSingle();
    if (data) return data as FreeActivationEA;
  }

  // 3. Name fallback.
  const { data: matches } = await supabase.from("eas").select(cols).ilike("name", FREE_ACTIVATION_EA_NAME);
  if (!matches || matches.length === 0) return null;

  // Prefer active + owner/super-admin-owned so a random distributor can't
  // hijack the public flow just by naming a bot the same thing.
  const distIds = Array.from(new Set(matches.map(m => m.distributor_id)));
  const { data: dists } = await supabase.from("distributors").select("id, email, is_super_admin").in("id", distIds);
  const distById = new Map((dists || []).map(d => [d.id, d]));

  const score = (m: FreeActivationEA): number => {
    const d = distById.get(m.distributor_id);
    let s = 0;
    if (m.is_active) s += 4;
    if (d && isOwnerEmail(d.email)) s += 2;
    else if (d && (d.is_super_admin || isSuperAdminEmail(d.email))) s += 1;
    return s;
  };

  const sorted = [...(matches as FreeActivationEA[])].sort((a, b) => score(b) - score(a));
  return sorted[0];
}
