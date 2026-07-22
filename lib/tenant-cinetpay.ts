import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret, decryptSecret } from "./crypto-secrets";

export type CinetPayCredentials = { apiKey: string; siteId: string; secretKey: string };

// tenant_paiement_config n'a AUCUNE policy RLS (voir
// 20260806000000_tenant_paiement_config.sql) -- ces trois fonctions doivent
// TOUJOURS recevoir un client service-role (createAdminClient()), jamais le
// client par-requete d'un utilisateur authentifie, meme admin_tenant.

export async function getTenantCinetPayConfig(
  admin: SupabaseClient,
  tenantId: string,
): Promise<CinetPayCredentials | null> {
  const { data } = await admin
    .from("tenant_paiement_config")
    .select("site_id, api_key_chiffre, secret_key_chiffre")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  return {
    apiKey: decryptSecret(data.api_key_chiffre),
    siteId: data.site_id,
    secretKey: decryptSecret(data.secret_key_chiffre),
  };
}

export async function hasTenantCinetPayConfig(admin: SupabaseClient, tenantId: string): Promise<boolean> {
  const { data } = await admin
    .from("tenant_paiement_config")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return Boolean(data);
}

export async function saveTenantCinetPayConfig(
  admin: SupabaseClient,
  tenantId: string,
  creds: CinetPayCredentials,
): Promise<void> {
  await admin.from("tenant_paiement_config").upsert({
    tenant_id: tenantId,
    site_id: creds.siteId,
    api_key_chiffre: encryptSecret(creds.apiKey),
    secret_key_chiffre: encryptSecret(creds.secretKey),
    updated_at: new Date().toISOString(),
  });
}
