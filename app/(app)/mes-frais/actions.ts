"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFraisApplicablesPourEleve } from "@/lib/frais-data";
import { initierPaiementCinetPay } from "@/lib/cinetpay";
import { getTenantCinetPayConfig } from "@/lib/tenant-cinetpay";

export type InitierPaiementState = { error?: string; paymentUrl?: string };

/**
 * N'importe quel utilisateur authentifie peut initier un paiement, mais
 * uniquement pour lui-meme -- pas requireStaffFinances() ici, contrairement
 * a enregistrerPaiement (app/admin/paiements/actions.ts) qui reste le flux
 * staff manuel inchange. Le recoupement contre getFraisApplicablesPourEleve()
 * (deja utilise par /mes-frais) garantit que frais_id s'applique reellement
 * a l'appelant, en plus de la RLS sur paiements_frais_transactions.
 */
export async function initierPaiementEnLigne(
  _prevState: InitierPaiementState,
  formData: FormData,
): Promise<InitierPaiementState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const fraisId = String(formData.get("frais_id") ?? "");
  if (!fraisId) return { error: "Frais requis." };

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, nom, email, telephone")
    .eq("id", user.id)
    .single();
  if (!profile?.tenant_id) return { error: "Profil incomplet." };

  const admin = createAdminClient();
  const cinetpayConfig = await getTenantCinetPayConfig(admin, profile.tenant_id);
  if (!cinetpayConfig) {
    return { error: "Le paiement en ligne n'est pas encore disponible pour votre établissement." };
  }

  const fraisApplicables = await getFraisApplicablesPourEleve(supabase, user.id);
  const frais = fraisApplicables.find((f) => f.id === fraisId);
  if (!frais || frais.reste <= 0) {
    return { error: "Ce frais ne vous concerne pas ou est déjà soldé." };
  }

  const transactionId = `atlaslab-${randomUUID()}`;

  const { error: insertError } = await supabase.from("paiements_frais_transactions").insert({
    tenant_id: profile.tenant_id,
    frais_id: fraisId,
    user_id: user.id,
    montant: frais.reste,
    transaction_id: transactionId,
  });
  if (insertError) {
    return { error: "Impossible d'initier le paiement : " + insertError.message };
  }

  const result = await initierPaiementCinetPay({
    apiKey: cinetpayConfig.apiKey,
    siteId: cinetpayConfig.siteId,
    transactionId,
    montant: frais.reste,
    description: frais.libelle,
    customerName: profile.nom,
    customerEmail: profile.email,
    customerPhone: profile.telephone,
  });

  if (!result.ok) {
    // Autorise par paiements_transactions_update_self_cancel (RLS) : la
    // ligne est encore 'en_attente' et nous en sommes le proprietaire.
    await supabase
      .from("paiements_frais_transactions")
      .update({ statut: "echoue" })
      .eq("transaction_id", transactionId);
    return { error: result.error };
  }

  return { paymentUrl: result.paymentUrl };
}
