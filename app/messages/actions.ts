"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";

export type SendMessageState = { error?: string };

export async function sendMessage(
  _prevState: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, nom")
    .eq("id", user.id)
    .single();
  if (!profile?.tenant_id) return { error: "Compte non rattaché à un établissement." };

  const recipientId = String(formData.get("recipient_id") ?? "");
  const contenu = String(formData.get("contenu") ?? "").trim();
  if (!recipientId || !contenu) return { error: "Message vide." };

  const { error } = await supabase.from("messages").insert({
    tenant_id: profile.tenant_id,
    sender_id: user.id,
    recipient_id: recipientId,
    contenu,
  });

  if (error) {
    return { error: "Impossible d'envoyer ce message à ce destinataire." };
  }

  const { data: recipient } = await supabase
    .from("users")
    .select("telephone")
    .eq("id", recipientId)
    .single();
  if (recipient?.telephone) {
    await sendWhatsAppTemplate({
      to: recipient.telephone,
      templateName: "atlaslab_nouveau_message",
      bodyParams: [profile.nom ?? "Un utilisateur AtlasLab"],
    });
  }

  revalidatePath("/messages");
  revalidatePath(`/messages/${recipientId}`);
  redirect(`/messages/${recipientId}`);
}

export async function markThreadRead(otherUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("messages")
    .update({ lu: true })
    .eq("recipient_id", user.id)
    .eq("sender_id", otherUserId)
    .eq("lu", false);
}
