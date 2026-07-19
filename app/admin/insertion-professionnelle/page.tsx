import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDiplomesInsertions } from "@/lib/insertions-data";
import { INSERTION_STATUTS, INSERTION_STATUT_LABELS, NON_RENSEIGNE, NON_RENSEIGNE_LABEL } from "@/lib/insertions";
import InsertionRow from "./InsertionRow";

export default async function InsertionProfessionnellePage() {
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
    !["professeur", "admin_tenant", "super_admin"].includes(profile.role) ||
    !profile.tenant_id
  ) {
    redirect("/admin");
  }

  const diplomes = await getDiplomesInsertions(supabase);

  const counts = new Map<string, number>();
  for (const d of diplomes) counts.set(d.statut, (counts.get(d.statut) ?? 0) + 1);

  return (
    <main className="page">
      <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux comptes
      </Link>
      <h1 className="mt-2 mb-2 text-2xl font-semibold text-gray-900">Insertion professionnelle</h1>
      <p className="mb-6 text-sm text-gray-500">
        Devenir des élèves ayant terminé un cours à 100%, déclaré par l&apos;élève ou renseigné
        par le staff.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          Répartition ({diplomes.length} diplômé{diplomes.length > 1 ? "s" : ""})
        </h2>
        <div className="flex flex-wrap gap-3">
          {[...INSERTION_STATUTS, NON_RENSEIGNE].map((s) => {
            const n = counts.get(s) ?? 0;
            if (n === 0) return null;
            return (
              <div
                key={s}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-center"
              >
                <p className="text-xl font-semibold text-gray-900">{n}</p>
                <p className="text-xs text-gray-500">
                  {s === NON_RENSEIGNE ? NON_RENSEIGNE_LABEL : INSERTION_STATUT_LABELS[s]}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Diplômés</h2>
        {diplomes.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun élève n&apos;a encore terminé un cours à 100%.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {diplomes.map((d) => (
              <InsertionRow key={`${d.userId}::${d.courseId}`} diplome={d} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
