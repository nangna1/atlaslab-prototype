import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFraisApplicablesPourEleve } from "@/lib/frais-data";
import { formatMontantCFA } from "@/lib/format";
import { hasTenantCinetPayConfig } from "@/lib/tenant-cinetpay";
import PaierEnLigneButton from "./PaierEnLigneButton";

export default async function MesFraisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("tenant_id").eq("id", user.id).single();
  const paiementEnLigneDisponible = profile?.tenant_id
    ? await hasTenantCinetPayConfig(createAdminClient(), profile.tenant_id)
    : false;
  const fraisApplicables = await getFraisApplicablesPourEleve(supabase, user.id);
  const solde = fraisApplicables.reduce((sum, f) => sum + f.reste, 0);

  const { data: historique } = await supabase
    .from("paiements_frais")
    .select("id, montant, created_at, frais_scolarite(libelle)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <main className="page">
      <Link href="/cours" className="mb-6 inline-block text-sm text-gray-500 hover:text-gray-700">
        ← Retour à mes cours
      </Link>
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">Mes frais de scolarité</h1>
      <p className="mb-6 text-sm text-gray-500">
        Solde restant dû : <strong>{formatMontantCFA(solde)}</strong>
        {solde === 0 && fraisApplicables.length > 0 ? " — vous êtes à jour ✅" : ""}
      </p>

      {fraisApplicables.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun frais applicable à votre profil pour le moment.</p>
      ) : (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Détail</h2>
          <div className="flex flex-col gap-2">
            {fraisApplicables.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <span className="font-medium text-gray-900">{f.libelle}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">
                    {formatMontantCFA(f.paye)} payé / {formatMontantCFA(f.montant)}
                    {f.reste > 0 ? ` — reste ${formatMontantCFA(f.reste)}` : " — soldé"}
                  </span>
                  {f.reste > 0 && paiementEnLigneDisponible && <PaierEnLigneButton fraisId={f.id} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Historique de mes paiements</h2>
        {(historique ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Aucun paiement enregistré pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(historique ?? []).map((p) => (
              <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                {formatMontantCFA(p.montant)} —{" "}
                {(p.frais_scolarite as unknown as { libelle: string } | null)?.libelle ?? "frais supprimé"} —{" "}
                {new Date(p.created_at).toLocaleDateString("fr-FR")}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
