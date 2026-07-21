import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFraisApplicablesPourEleve } from "@/lib/frais-data";
import { formatMontantCFA } from "@/lib/format";
import EnregistrerPaiementForm from "../EnregistrerPaiementForm";

export default async function PaiementsElevePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !["admin_tenant", "super_admin"].includes(profile.role) ||
    !profile.tenant_id
  ) {
    redirect("/admin");
  }

  const { data: eleve } = await supabase.from("users").select("id, nom").eq("id", userId).single();
  if (!eleve) return notFound();

  const fraisApplicables = await getFraisApplicablesPourEleve(supabase, userId);
  const solde = fraisApplicables.reduce((sum, f) => sum + f.reste, 0);

  const { data: historique } = await supabase
    .from("paiements_frais")
    .select("id, montant, moyen_paiement, reference, created_at, frais_scolarite(libelle)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (
    <main className="page">
      <Link href="/admin/paiements" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux paiements
      </Link>
      <h1 className="mt-2 mb-2 text-2xl font-semibold text-gray-900">{eleve.nom}</h1>
      <p className="mb-6 text-sm text-gray-500">
        Solde restant dû : <strong>{formatMontantCFA(solde)}</strong>
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Enregistrer un paiement</h2>
        <EnregistrerPaiementForm
          eleveId={userId}
          fraisOptions={fraisApplicables.filter((f) => f.reste > 0).map((f) => ({ id: f.id, libelle: f.libelle, reste: f.reste }))}
        />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Frais applicables</h2>
        {fraisApplicables.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun frais applicable à cet élève.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {fraisApplicables.map((f) => (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
              >
                <span className="font-medium text-gray-900">{f.libelle}</span>
                <span className="text-sm text-gray-600">
                  {formatMontantCFA(f.paye)} payé / {formatMontantCFA(f.montant)}
                  {f.reste > 0 ? ` — reste ${formatMontantCFA(f.reste)}` : " — soldé"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Historique des paiements</h2>
        {(historique ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Aucun paiement enregistré pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(historique ?? []).map((p) => (
              <div key={p.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                {formatMontantCFA(p.montant)} —{" "}
                {(p.frais_scolarite as unknown as { libelle: string } | null)?.libelle ?? "frais supprimé"} —{" "}
                {p.moyen_paiement} — {new Date(p.created_at).toLocaleDateString("fr-FR")}
                {p.reference ? ` — réf. ${p.reference}` : ""}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
