import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifierTransactionCinetPay, mapCinetPayChannelToMoyenPaiement } from "@/lib/cinetpay";
import { getTenantCinetPayConfig } from "@/lib/tenant-cinetpay";
import { logAudit } from "@/lib/audit";

// Contrairement au webhook WhatsApp (app/api/whatsapp-devoirs/webhook/route.ts,
// qui rejette purement sur signature HMAC invalide), on ne rejette pas ici
// uniquement sur signature absente/invalide : le format exact de signature
// CinetPay n'est pas confirme au moment d'ecrire ceci. La protection vient a
// la place du fait qu'on n'agit JAMAIS que sur un transaction_id qu'on a
// nous-meme genere ET qui est encore 'en_attente' dans
// paiements_frais_transactions -- et que le credit reel ne se produit
// qu'apres un appel /v2/payment/check fait avec NOTRE cle secrete (voir
// lib/cinetpay.ts). Pire cas si un tiers pouvait forger cet appel : une
// verification /check supplementaire et inutile pour une transaction deja
// suivie -- jamais un credit force.
//
// Meme discipline "toujours repondre 200" que le webhook WhatsApp : CinetPay
// desactiverait un notify_url qui ne repond pas de facon fiable.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  try {
    const transactionId = extractTransactionId(rawBody);
    if (transactionId) await handleNotification(transactionId);
  } catch (err) {
    console.error("Erreur traitement webhook CinetPay :", err);
  }

  return NextResponse.json({ ok: true });
}

function extractTransactionId(rawBody: string): string | null {
  // CinetPay notifie historiquement en x-www-form-urlencoded avec le champ
  // cpm_trans_id (correspondant au transaction_id qu'on a fourni a
  // l'initiation) -- on tente aussi le JSON par prudence.
  try {
    const params = new URLSearchParams(rawBody);
    const fromForm = params.get("cpm_trans_id");
    if (fromForm) return fromForm;
  } catch {
    // pas du form-encoded, on tente JSON ci-dessous
  }
  try {
    const json = JSON.parse(rawBody) as { cpm_trans_id?: string; transaction_id?: string };
    return json.cpm_trans_id ?? json.transaction_id ?? null;
  } catch {
    return null;
  }
}

async function handleNotification(transactionId: string) {
  const admin = createAdminClient();

  const { data: txn } = await admin
    .from("paiements_frais_transactions")
    .select("id, tenant_id, frais_id, user_id, montant, statut")
    .eq("transaction_id", transactionId)
    .maybeSingle();
  if (!txn || txn.statut !== "en_attente") return; // inconnu, ou deja traite (idempotence)

  // Chaque tenant a son propre compte marchand CinetPay (voir
  // lib/tenant-cinetpay.ts) -- si la config a ete supprimee entre l'initiation
  // et la notification (cas limite), on ne peut pas verifier authoritairement
  // la transaction : on sort silencieusement plutot que de crediter a l'aveugle.
  const cinetpayConfig = await getTenantCinetPayConfig(admin, txn.tenant_id);
  if (!cinetpayConfig) {
    console.error("Config CinetPay introuvable pour le tenant de la transaction", transactionId);
    return;
  }

  const statusResult = await verifierTransactionCinetPay(transactionId, cinetpayConfig.apiKey, cinetpayConfig.siteId);
  if (!statusResult.ok) return; // erreur transitoire cote CinetPay -- ils reessaieront le webhook

  if (statusResult.status !== "ACCEPTED") {
    await admin
      .from("paiements_frais_transactions")
      .update({ statut: "echoue", canal_paiement: statusResult.rawPaymentMethod })
      .eq("transaction_id", transactionId)
      .eq("statut", "en_attente");
    return;
  }

  // Le montant fait foi depuis l'appel /check (autoritaire), jamais depuis le
  // payload webhook -- on le recoupe quand meme avec ce qu'on a nous-meme
  // initie, en defense en profondeur contre une transaction detournee.
  if (Number(statusResult.amount) !== Number(txn.montant)) {
    console.error("Montant CinetPay incohérent pour la transaction", transactionId);
    await admin
      .from("paiements_frais_transactions")
      .update({ statut: "echoue" })
      .eq("transaction_id", transactionId)
      .eq("statut", "en_attente");
    return;
  }

  const moyenPaiement = mapCinetPayChannelToMoyenPaiement(statusResult.rawPaymentMethod);

  const { data: paiementId } = await admin.rpc("confirmer_paiement_en_ligne", {
    p_transaction_id: transactionId,
    p_moyen_paiement: moyenPaiement,
  });
  if (!paiementId) return; // deja credite par une livraison webhook concurrente -- no-op

  await logAudit(admin, {
    acteurId: txn.user_id,
    tenantId: txn.tenant_id,
    action: "paiement_en_ligne_confirme",
    cibleType: "paiements_frais",
    cibleId: txn.user_id,
    details: { fraisId: txn.frais_id, montant: txn.montant, moyenPaiement, transactionId },
  });
}
