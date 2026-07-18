import type { SupabaseClient } from "@supabase/supabase-js";

export async function logAudit(
  supabase: SupabaseClient,
  params: {
    acteurId: string;
    tenantId: string | null;
    action: string;
    cibleType: string;
    cibleId?: string | null;
    details?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("audit_log").insert({
    tenant_id: params.tenantId,
    acteur_id: params.acteurId,
    action: params.action,
    cible_type: params.cibleType,
    cible_id: params.cibleId ?? null,
    details: params.details ?? null,
  });
  if (error) console.error("Échec de journalisation d'audit :", error.message);
}
