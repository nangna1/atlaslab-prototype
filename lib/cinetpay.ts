const CINETPAY_BASE_URL = "https://api-checkout.cinetpay.com/v2";

// Meme convention qu'AtlasLab utilise deja pour les autres liens en dur dans
// les emails/notifications (voir app/admin/**/actions.ts) -- pas de variable
// d'env dediee, CinetPay ne peut de toute facon pas atteindre localhost.
const APP_BASE_URL = "https://atlaslabedu.com";

// Pas de config globale ici : chaque etablissement a son propre compte
// marchand CinetPay (api_key/site_id), recupere via
// lib/tenant-cinetpay.ts::getTenantCinetPayConfig() et passe en parametre --
// la plateforme ne detient aucun identifiant partage, l'argent va toujours
// directement au compte marchand du tenant concerne.

type InitierPaiementParams = {
  apiKey: string;
  siteId: string;
  transactionId: string;
  montant: number;
  description: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
};

type InitierPaiementResult = { ok: true; paymentUrl: string } | { ok: false; error: string };

/**
 * Cree une transaction CinetPay et renvoie l'URL de paiement hebergee
 * (checkout.cinetpay.com) vers laquelle rediriger le payeur. Champs requis
 * par l'API v2/payment, y compris les champs d'adresse que CinetPay exige
 * meme si ce projet ne collecte pas cette info -- valeurs generiques CI.
 */
export async function initierPaiementCinetPay({
  apiKey,
  siteId,
  transactionId,
  montant,
  description,
  customerName,
  customerEmail,
  customerPhone,
}: InitierPaiementParams): Promise<InitierPaiementResult> {
  try {
    const res = await fetch(`${CINETPAY_BASE_URL}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        site_id: siteId,
        transaction_id: transactionId,
        amount: Math.round(montant),
        currency: "XOF",
        description,
        customer_name: customerName || "Client",
        customer_surname: "AtlasLab",
        customer_email: customerEmail || "client@atlaslabedu.com",
        customer_phone_number: customerPhone || "0000000000",
        customer_address: "N/A",
        customer_city: "Abidjan",
        customer_country: "CI",
        customer_state: "CI",
        customer_zip_code: "00225",
        notify_url: `${APP_BASE_URL}/api/paiements/webhook`,
        return_url: `${APP_BASE_URL}/mes-frais/retour-paiement?transaction_id=${transactionId}`,
        channels: "ALL",
        lang: "FR",
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      code?: string;
      message?: string;
      data?: { payment_url?: string };
    } | null;

    if (!res.ok || !body || body.code !== "201" || !body.data?.payment_url) {
      console.error("Échec initiation CinetPay :", res.status, body);
      return { ok: false, error: "Impossible de contacter la passerelle de paiement, réessayez plus tard." };
    }

    return { ok: true, paymentUrl: body.data.payment_url };
  } catch (err) {
    console.error("Échec initiation CinetPay :", err);
    return { ok: false, error: "Impossible de contacter la passerelle de paiement, réessayez plus tard." };
  }
}

type VerifierTransactionResult =
  | { ok: true; status: string; amount: number; rawPaymentMethod: string | null }
  | { ok: false };

/**
 * Seule source autoritaire du statut d'une transaction -- CinetPay
 * recommande explicitement de ne JAMAIS se fier au contenu du webhook seul
 * (voir docs.cinetpay.com/api/1.0-en/checkout/verification) : cet appel,
 * fait avec notre propre cle secrete, est ce qui declenche reellement le
 * credit (voir app/api/paiements/webhook/route.ts).
 */
export async function verifierTransactionCinetPay(
  transactionId: string,
  apiKey: string,
  siteId: string,
): Promise<VerifierTransactionResult> {
  try {
    const res = await fetch(`${CINETPAY_BASE_URL}/payment/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: apiKey,
        site_id: siteId,
        transaction_id: transactionId,
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      data?: { status?: string; amount?: string | number; payment_method?: string };
    } | null;

    if (!res.ok || !body?.data?.status) {
      console.error("Échec vérification CinetPay :", res.status, body);
      return { ok: false };
    }

    return {
      ok: true,
      status: body.data.status,
      amount: Number(body.data.amount ?? 0),
      rawPaymentMethod: body.data.payment_method ?? null,
    };
  } catch (err) {
    console.error("Échec vérification CinetPay :", err);
    return { ok: false };
  }
}

// TODO CONFIRMER : valeurs brutes exactes de payment_method observees en
// sandbox pour le marche ivoirien (OM/MOMO/WAVE/carte...) -- a ajuster des
// la premiere transaction de test reelle. Le fallback "paiement_en_ligne"
// garantit qu'un code non reconnu ne bloque jamais un paiement reel (la
// contrainte CHECK sur paiements_frais.moyen_paiement l'accepte).
const CHANNEL_MAP: Record<string, string> = {
  OM: "orange_money_ci",
  OMCI: "orange_money_ci",
  MOMO: "mtn_money_ci",
  MTNMONEY: "mtn_money_ci",
  MTN: "mtn_money_ci",
  MOOV: "moov_money",
  MOOVMONEY: "moov_money",
  FLOOZ: "moov_money",
  WAVE: "wave_ci",
  WAVECI: "wave_ci",
  VISA: "carte_bancaire",
  MASTERCARD: "carte_bancaire",
  CARD: "carte_bancaire",
};

export function mapCinetPayChannelToMoyenPaiement(raw: string | null): string {
  if (!raw) return "paiement_en_ligne";
  return CHANNEL_MAP[raw.toUpperCase()] ?? "paiement_en_ligne";
}
