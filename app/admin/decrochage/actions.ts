"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { logAudit } from "@/lib/audit";

export type RelanceState = { error?: string; success?: boolean };

export async function relancerEleve(
  _prevState: RelanceState,
  formData: FormData,
): Promise<RelanceState> {
  const supabase = await createClient();
  const {
    data: { user: caller },
  } = await supabase.auth.getUser();
  if (!caller) return { error: "Non authentifié." };

  const { data: callerProfile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", caller.id)
    .single();

  if (
    !callerProfile ||
    !["professeur", "admin_tenant", "super_admin"].includes(callerProfile.role) ||
    !callerProfile.tenant_id
  ) {
    return { error: "Action réservée au staff." };
  }

  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) return { error: "Élève invalide." };

  const { data: target } = await supabase
    .from("users")
    .select("nom, email, telephone, tenant_id")
    .eq("id", targetId)
    .single();

  if (!target || target.tenant_id !== callerProfile.tenant_id) {
    return { error: "Élève introuvable." };
  }

  let sent = false;
  if (target.email) {
    await sendEmail({
      to: target.email,
      subject: "On vous attend sur AtlasLab !",
      html: `<p>Bonjour ${target.nom},</p><p>Cela fait un moment que nous ne vous avons pas vu sur AtlasLab. Vos cours vous attendent — reprenez où vous vous êtes arrêté(e) : <a href="https://atlaslabedu.com/cours">accéder à mes cours</a>.</p>`,
    });
    sent = true;
  }
  if (target.telephone) {
    // "_v2" : le nom d'origine (atlaslab_relance_decrochage) a ete supprime
    // par erreur cote Meta Business Manager (tentative de correction de
    // categorie Marketing -> Utilitaire) ; Meta bloque 4 semaines la
    // recreation d'un nom de template supprime, republie donc sous ce
    // nouveau nom en categorie Utilitaire des le depart.
    await sendWhatsAppTemplate({
      to: target.telephone,
      templateName: "atlaslab_relance_decrochage_v2",
      bodyParams: [target.nom],
    });
    sent = true;
  }

  if (!sent) return { error: "Cet élève n'a ni email ni téléphone renseigné." };

  await logAudit(supabase, {
    acteurId: caller.id,
    tenantId: callerProfile.tenant_id,
    action: "eleve_relance",
    cibleType: "compte",
    cibleId: targetId,
  });

  return { success: true };
}
