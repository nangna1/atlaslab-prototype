import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFraisStats } from "@/lib/frais-data";
import { formatMontantCFA } from "@/lib/format";
import RelanceButton from "./RelanceButton";

export default async function PaiementsPage() {
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

  const stats = (await getFraisStats(supabase)).sort((a, b) => b.solde - a.solde);

  return (
    <main className="page">
      <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux comptes
      </Link>
      <h1 className="mt-2 mb-2 text-2xl font-semibold text-gray-900">Paiements</h1>
      <p className="mb-6 text-sm text-gray-500">
        Solde restant dû par élève (recalculé en direct). Cliquez sur un élève pour enregistrer un
        paiement.{" "}
        <Link href="/admin/frais-scolarite" className="text-indigo-600 hover:underline">
          Gérer les frais
        </Link>
        .
      </p>

      {stats.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun élève dans cet établissement.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {stats.map((e) => (
            <div
              key={e.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${
                e.solde > 0 ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
              }`}
            >
              <Link href={`/admin/paiements/${e.id}`} className="font-medium text-gray-900 hover:underline">
                {e.nom}
              </Link>
              <span className="text-sm text-gray-600">
                {e.solde > 0 ? `Solde dû : ${formatMontantCFA(e.solde)}` : "À jour"}
              </span>
              {e.solde > 0 && <RelanceButton userId={e.id} solde={e.solde} />}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
