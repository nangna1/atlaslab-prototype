import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFraisApplicablesPourEleve } from "@/lib/frais-data";
import { formatMontantCFA } from "@/lib/format";

export default async function PortailParentEnfantPage({
  params,
}: {
  params: Promise<{ enfantId: string }>;
}) {
  const { enfantId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "parent") redirect("/cours");

  const { data: lien } = await supabase
    .from("parents_enfants")
    .select("id")
    .eq("parent_id", user.id)
    .eq("enfant_id", enfantId)
    .maybeSingle();
  if (!lien) return notFound();

  const { data: enfant } = await supabase.from("users").select("id, nom").eq("id", enfantId).single();
  if (!enfant) return notFound();

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id, courses(id, titre)")
    .eq("user_id", enfantId);

  const cours = (enrollments ?? [])
    .map((e) => e.courses as unknown as { id: string; titre: string } | null)
    .filter((c): c is { id: string; titre: string } => !!c);

  const { data: attendanceRows } = await supabase
    .from("attendance")
    .select("id, statut, live_sessions(date_heure, courses(titre))")
    .eq("user_id", enfantId)
    .order("id", { ascending: false })
    .limit(20);

  const absences = (attendanceRows ?? []).map((a) => {
    const session = a.live_sessions as unknown as { date_heure: string; courses: { titre: string } | null } | null;
    return {
      id: a.id,
      statut: a.statut,
      date: session?.date_heure ?? null,
      coursTitre: session?.courses?.titre ?? "",
    };
  });

  const fraisApplicables = await getFraisApplicablesPourEleve(supabase, enfantId);
  const solde = fraisApplicables.reduce((sum, f) => sum + f.reste, 0);

  return (
    <main className="page">
      <Link href="/portail-parent" className="mb-6 inline-block text-sm text-gray-500 hover:text-gray-700">
        ← Retour à mes enfants
      </Link>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">{enfant.nom}</h1>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Cours et notes</h2>
        {cours.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun cours pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {cours.map((c) => (
              <Link
                key={c.id}
                href={`/cours/${c.id}/bulletin/${enfantId}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">{c.titre}</span>
                <span className="text-sm text-indigo-600">Voir le bulletin →</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Absences récentes</h2>
        {absences.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune absence enregistrée.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {absences.map((a) => (
              <div key={a.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                {a.coursTitre}
                {a.date ? ` — ${new Date(a.date).toLocaleDateString("fr-FR")}` : ""} —{" "}
                <span
                  className={
                    a.statut === "absent"
                      ? "font-medium text-red-600"
                      : a.statut === "retard"
                        ? "font-medium text-amber-600"
                        : "font-medium text-green-700"
                  }
                >
                  {a.statut === "present" ? "Présent" : a.statut === "retard" ? "Retard" : "Absent"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Frais de scolarité</h2>
        <p className="mb-3 text-sm text-gray-500">
          Solde restant dû : <strong>{formatMontantCFA(solde)}</strong>
        </p>
        {fraisApplicables.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun frais applicable.</p>
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
    </main>
  );
}
