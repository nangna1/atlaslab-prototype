import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Page protegee normale (pas besoin de figurer dans PUBLIC_ROUTES) : c'est la
// session navigateur deja authentifiee du parent/apprenant qui revient de
// CinetPay, pas un appel serveur-a-serveur. Lecture seule et NON autoritaire
// -- ne credite jamais rien elle-meme, seul le webhook (voir
// app/api/paiements/webhook/route.ts) fait foi.
export default async function RetourPaiementPage({
  searchParams,
}: {
  searchParams: Promise<{ transaction_id?: string }>;
}) {
  const { transaction_id: transactionId } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: txn } = transactionId
    ? await supabase
        .from("paiements_frais_transactions")
        .select("statut")
        .eq("transaction_id", transactionId)
        .maybeSingle()
    : { data: null };

  let message = "Paiement en cours de confirmation, actualisez dans un instant.";
  if (txn?.statut === "reussi") message = "Paiement confirmé, merci !";
  else if (txn?.statut === "echoue" || txn?.statut === "annule") {
    message = "Le paiement n'a pas abouti, réessayez depuis Mes frais.";
  }

  return (
    <main className="page">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">Paiement</h1>
      <p className="mb-6 text-sm text-gray-700">{message}</p>
      <Link href="/mes-frais" className="btn-primary inline-block">
        Retour à mes frais
      </Link>
    </main>
  );
}
