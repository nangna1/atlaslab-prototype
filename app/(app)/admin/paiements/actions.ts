"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { formatMontantCFA } from "@/lib/format";

// Meme restriction que app/admin/frais-scolarite/actions.ts : donnees
// financieres reservees a admin_tenant/super_admin, professeur exclu.
async function requireStaffFinances() {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { supabase, caller: null, tenantId: null, error: "Non authentifié." } as const;

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", caller.id)
    .single();

  if (
    !callerProfile ||
    !["admin_tenant", "super_admin"].includes(callerProfile.role) ||
    !callerProfile.tenant_id
  ) {
    return { supabase, caller, tenantId: null, error: "Action réservée à l'administration de l'établissement." } as const;
  }

  return { supabase, caller, tenantId: callerProfile.tenant_id as string, error: null } as const;
}

export type EnregistrerPaiementState = { error?: string; success?: boolean };

export async function enregistrerPaiement(
  _prevState: EnregistrerPaiementState,
  formData: FormData,
): Promise<EnregistrerPaiementState> {
  const { supabase, caller, tenantId, error: authError } = await requireStaffFinances();
  if (authError) return { error: authError };

  const eleveId = String(formData.get("eleve_id") ?? "");
  const fraisId = String(formData.get("frais_id") ?? "");
  const montantRaw = String(formData.get("montant") ?? "").trim();
  const moyenPaiement = String(formData.get("moyen_paiement") ?? "");
  const reference = String(formData.get("reference") ?? "").trim();

  const montant = Number(montantRaw.replace(",", "."));
  const MOYENS = ["especes", "virement", "mobile_money", "cheque", "autre"];
  if (!eleveId || !fraisId || !Number.isFinite(montant) || montant <= 0 || !MOYENS.includes(moyenPaiement)) {
    return { error: "Élève, frais, montant (positif) et moyen de paiement sont requis." };
  }

  const { error } = await supabase.from("paiements_frais").insert({
    tenant_id: tenantId,
    frais_id: fraisId,
    user_id: eleveId,
    montant,
    moyen_paiement: moyenPaiement,
    reference: reference || null,
    enregistre_par: caller!.id,
  });

  if (error) return { error: error.message };

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "paiement_enregistre",
    cibleType: "paiements_frais",
    cibleId: eleveId,
    details: { fraisId, montant, moyenPaiement },
  });

  revalidatePath(`/admin/paiements/${eleveId}`);
  revalidatePath("/admin/paiements");
  revalidatePath("/mes-frais");
  return { success: true };
}

export type RelancePaiementState = { error?: string; success?: boolean };

export async function relancerPaiement(
  _prevState: RelancePaiementState,
  formData: FormData,
): Promise<RelancePaiementState> {
  const { supabase, caller, tenantId, error: authError } = await requireStaffFinances();
  if (authError) return { error: authError };

  const targetId = String(formData.get("target_id") ?? "");
  const solde = Number(formData.get("solde") ?? "0");
  if (!targetId || !Number.isFinite(solde) || solde <= 0) return { error: "Élève ou solde invalide." };

  const { data: target } = await supabase
    .from("users")
    .select("nom, email, telephone, tenant_id")
    .eq("id", targetId)
    .single();

  if (!target || target.tenant_id !== tenantId) return { error: "Élève introuvable." };

  const soldeFormate = formatMontantCFA(solde);
  let sent = false;

  if (target.email) {
    await sendEmail({
      to: target.email,
      subject: "Frais de scolarité en attente",
      html: `<p>Bonjour ${target.nom},</p><p>Il vous reste <strong>${soldeFormate}</strong> à régler pour vos frais de scolarité. Merci de régulariser votre situation auprès de l'administration.</p>`,
    });
    sent = true;
  }
  if (target.telephone) {
    await sendWhatsAppTemplate({
      to: target.telephone,
      templateName: "atlaslab_relance_paiement",
      bodyParams: [target.nom, soldeFormate, "vos frais de scolarité"],
    });
    sent = true;
  }

  if (!sent) return { error: "Cet élève n'a ni email ni téléphone renseigné." };

  await supabase.from("notifications").insert({
    user_id: targetId,
    type: "paiement_relance",
    titre: "Frais de scolarité en attente",
    message: `Il vous reste ${soldeFormate} à régler.`,
    lien: "/mes-frais",
  });

  await logAudit(supabase, {
    acteurId: caller!.id,
    tenantId,
    action: "paiement_relance",
    cibleType: "compte",
    cibleId: targetId,
    details: { solde },
  });

  return { success: true };
}
