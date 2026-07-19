const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

export function normalizePhone(telephone: string): string {
  return telephone.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

/**
 * Envoie une notification WhatsApp via un modèle (template) Meta Cloud API.
 *
 * Contrairement à ArtiBot BTP (où l'utilisateur écrit d'abord au bot), ces notifications
 * sont émises à l'initiative d'AtlasLab sans message entrant récent — la fenêtre de
 * conversation gratuite de 24h est donc presque toujours fermée. WhatsApp exige alors un
 * message *modèle*, pré-approuvé dans le Meta Business Manager, plutôt qu'un texte libre
 * (qui échouerait silencieusement en dehors de cette fenêtre). `templateName` doit
 * correspondre exactement au nom d'un modèle approuvé pour le numéro `WHATSAPP_PHONE_ID`.
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  languageCode = "fr",
  bodyParams = [],
}: {
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
}) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.warn("WHATSAPP_TOKEN/WHATSAPP_PHONE_ID non configurés — notification WhatsApp ignorée :", templateName, "->", to);
    return;
  }

  const phone = normalizePhone(to);
  if (!phone) return;

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components:
            bodyParams.length > 0
              ? [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }]
              : undefined,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Échec envoi WhatsApp :", res.status, body, "->", phone);
    }
  } catch (err) {
    console.error("Échec envoi WhatsApp :", err);
  }
}

/**
 * Réponse en texte libre — valide uniquement dans les 24h suivant un message
 * entrant de ce numéro (fenêtre de conversation gratuite ouverte par
 * l'utilisateur lui-même). Contrairement à sendWhatsAppTemplate, jamais utilisé
 * pour une notification à froid.
 */
export async function sendWhatsAppText({ to, text }: { to: string; text: string }) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.warn("WHATSAPP_TOKEN/WHATSAPP_PHONE_ID non configurés — réponse WhatsApp ignorée ->", to);
    return;
  }

  const phone = normalizePhone(to);
  if (!phone) return;

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "text",
        text: { body: text },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Échec envoi WhatsApp (texte) :", res.status, body, "->", phone);
    }
  } catch (err) {
    console.error("Échec envoi WhatsApp (texte) :", err);
  }
}

/** Télécharge un media entrant (photo) depuis l'API Cloud WhatsApp. */
export async function downloadWhatsAppMedia(
  mediaId: string,
): Promise<{ bytes: ArrayBuffer; mimeType: string } | null> {
  if (!WHATSAPP_TOKEN) return null;

  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;

    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });
    if (!fileRes.ok) return null;

    return { bytes: await fileRes.arrayBuffer(), mimeType: meta.mime_type ?? "image/jpeg" };
  } catch (err) {
    console.error("Échec téléchargement media WhatsApp :", err);
    return null;
  }
}
