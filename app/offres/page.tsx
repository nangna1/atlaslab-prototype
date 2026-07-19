import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { matchesQuery } from "@/lib/search";

export default async function OffresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q: qRaw, type: typeFilter } = await searchParams;
  const q = (qRaw ?? "").trim();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let offresQuery = supabase
    .from("offres_emploi")
    .select("id, titre, entreprise, type, filiere, localisation, description, contact, created_at")
    .eq("statut", "ouverte")
    .order("created_at", { ascending: false });
  if (typeFilter === "stage" || typeFilter === "emploi") {
    offresQuery = offresQuery.eq("type", typeFilter);
  }
  const { data: allOffres } = await offresQuery;

  const offres = q
    ? (allOffres ?? []).filter(
        (o) =>
          matchesQuery(o.titre, q) || matchesQuery(o.entreprise, q) || matchesQuery(o.filiere, q),
      )
    : allOffres;

  return (
    <main className="page">
      <Link href="/cours" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour à mes cours
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-gray-900">Bourse aux stages/emplois</h1>

      <form method="get" className="mb-6 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher (titre, entreprise, filière)…"
          className="input max-w-sm"
        />
        <select name="type" defaultValue={typeFilter ?? ""} className="input w-auto">
          <option value="">Tous les types</option>
          <option value="stage">Stage</option>
          <option value="emploi">Emploi</option>
        </select>
        <button type="submit" className="btn-secondary shrink-0">
          Filtrer
        </button>
      </form>

      {(offres ?? []).length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          Aucune offre ne correspond à ces critères pour le moment.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {(offres ?? []).map((offre) => (
            <div key={offre.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold" style={{ color: "var(--ink)" }}>
                  {offre.titre}
                </h2>
                <span className={offre.type === "stage" ? "badge-muted" : "badge-success"}>
                  {offre.type === "stage" ? "Stage" : "Emploi"}
                </span>
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
                {offre.entreprise}
                {offre.localisation ? ` — ${offre.localisation}` : ""}
                {offre.filiere ? ` — ${offre.filiere}` : ""}
              </p>
              {offre.description && (
                <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: "var(--ink)" }}>
                  {offre.description}
                </p>
              )}
              {offre.contact && (
                <p className="mt-2 text-sm font-medium" style={{ color: "var(--ink)" }}>
                  Contact : {offre.contact}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
