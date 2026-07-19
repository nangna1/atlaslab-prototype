import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/dashboard-data";
import { getDiplomesInsertions } from "@/lib/insertions-data";
import { INSERTION_STATUTS, INSERTION_STATUT_LABELS, NON_RENSEIGNE, NON_RENSEIGNE_LABEL } from "@/lib/insertions";
import PrintButton from "./PrintButton";

const STATUTS_INSERES = new Set(["emploi", "stage", "entrepreneuriat"]);

export default async function RapportImpactPage() {
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

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nom, logo_url")
    .eq("id", profile.tenant_id)
    .single();

  const { eleveStats, profStats } = await getDashboardStats(supabase);
  const diplomes = await getDiplomesInsertions(supabase);

  const { count: totalCours } = await supabase.from("courses").select("id", { count: "exact", head: true });

  const totalLeconsTerminees = eleveStats.reduce((sum, e) => sum + e.leconsTerminees, 0);
  const totalDevoirsRendus = eleveStats.reduce((sum, e) => sum + e.devoirsRendus, 0);
  const totalSeancesProgrammees = profStats.reduce((sum, p) => sum + p.seancesProgrammees, 0);

  const counts = new Map<string, number>();
  for (const d of diplomes) counts.set(d.statut, (counts.get(d.statut) ?? 0) + 1);
  const diplomesRenseignes = diplomes.filter((d) => d.statut !== NON_RENSEIGNE).length;
  const diplomesInseres = diplomes.filter((d) => STATUTS_INSERES.has(d.statut)).length;
  const tauxInsertion = diplomesRenseignes > 0 ? Math.round((diplomesInseres / diplomesRenseignes) * 100) : null;

  const dateGeneration = new Date().toLocaleDateString("fr-FR", { dateStyle: "long" });

  return (
    <main className="page max-w-3xl print:max-w-none print:p-0">
      <Link
        href="/admin"
        className="mb-6 inline-block text-sm text-gray-500 hover:text-gray-700 print:hidden"
      >
        ← Retour aux comptes
      </Link>

      <header className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          {tenant?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt={tenant.nom} className="mb-2 h-12 w-auto" />
          ) : null}
          <h1 className="text-2xl font-semibold text-gray-900">Rapport d&apos;impact — {tenant?.nom}</h1>
          <p className="text-sm text-gray-500">Généré le {dateGeneration}</p>
        </div>
        <PrintButton />
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Activité pédagogique (cumulée)</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            ["Élèves", eleveStats.length],
            ["Professeurs", profStats.length],
            ["Cours", totalCours ?? 0],
            ["Leçons terminées", totalLeconsTerminees],
            ["Devoirs rendus", totalDevoirsRendus],
            ["Séances programmées", totalSeancesProgrammees],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-semibold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Insertion professionnelle</h2>
        <p className="mb-3 text-sm text-gray-500">
          {diplomes.length} diplômé{diplomes.length > 1 ? "s" : ""} (cours terminés à 100%)
          {tauxInsertion !== null && (
            <>
              {" "}
              — <strong className="text-gray-900">{tauxInsertion}% en emploi, stage ou entrepreneuriat</strong>{" "}
              (sur {diplomesRenseignes} ayant renseigné leur situation)
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          {[...INSERTION_STATUTS, NON_RENSEIGNE].map((s) => {
            const n = counts.get(s) ?? 0;
            if (n === 0) return null;
            return (
              <div key={s} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-center">
                <p className="text-xl font-semibold text-gray-900">{n}</p>
                <p className="text-xs text-gray-500">
                  {s === NON_RENSEIGNE ? NON_RENSEIGNE_LABEL : INSERTION_STATUT_LABELS[s]}
                </p>
              </div>
            );
          })}
          {diplomes.length === 0 && <p className="text-sm text-gray-500">Aucun diplômé pour le moment.</p>}
        </div>
      </section>

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
        Rapport généré automatiquement par AtlasLab.
      </footer>
    </main>
  );
}
