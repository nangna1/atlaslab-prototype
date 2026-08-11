import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLearnerCourses } from "@/lib/learner-dashboard-data";
import { matchesQuery } from "@/lib/search";

// Ecran "Catalogue" (redesign 2026-08-10, voir handoff design section 4).
// Decision produit validee : catalogue = les cours ou l'apprenant est deja
// inscrit (deja scope par RLS, voir supabase/migrations/
// 20260717040000_apprenant_enrollment_restriction.sql), pas un vrai
// parcours de "tous les cours de l'etablissement" - l'inscription se fait
// par le staff, pas en self-service, donc parcourir des cours non inscrits
// n'aurait aucune action possible derriere. Vue recherche/filtres sur le
// meme ensemble que le Tableau de bord (app/(app)/cours/page.tsx), pas un
// nouveau perimetre de donnees.
export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filiere?: string }>;
}) {
  const { q: qRaw, filiere: filiereFiltre } = await searchParams;
  const q = (qRaw ?? "").trim();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "apprenant") redirect("/cours");

  const courses = await getLearnerCourses(supabase, user.id);
  const filieres = [...new Set(courses.map((c) => c.filiere).filter((f): f is string => !!f))].sort();

  const filtered = courses.filter((c) => {
    if (filiereFiltre && filiereFiltre !== "Toutes" && c.filiere !== filiereFiltre) return false;
    if (q && !matchesQuery(c.titre, q) && !matchesQuery(c.filiere, q)) return false;
    return true;
  });

  function chipHref(f: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (f !== "Toutes") params.set("filiere", f);
    const qs = params.toString();
    return qs ? `/cours/catalogue?${qs}` : "/cours/catalogue";
  }

  const activeFiliere = filiereFiltre && filieres.includes(filiereFiltre) ? filiereFiltre : "Toutes";

  return (
    <div className="px-10 pt-9 pb-14">
      <h1 className="mb-2 text-[34px] font-extrabold tracking-[-0.03em]">Catalogue de cours</h1>
      <p className="mb-6 text-[15px]" style={{ color: "var(--text-muted)" }}>
        Vos cours, filtrables par filière.
      </p>

      <form method="get" className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher un cours, une filière…"
          className="input min-w-[260px] flex-1"
        />
        {filiereFiltre && filiereFiltre !== "Toutes" && <input type="hidden" name="filiere" value={filiereFiltre} />}
        {["Toutes", ...filieres].map((f) => {
          const active = f === activeFiliere;
          return (
            <Link
              key={f}
              href={chipHref(f)}
              className="rounded-full px-4 py-2 text-[13px] font-semibold"
              style={{
                background: active ? "var(--accent)" : "var(--chip-bg)",
                color: active ? "var(--on-accent)" : "var(--text-muted)",
              }}
            >
              {f}
            </Link>
          );
        })}
      </form>

      {filtered.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {q || activeFiliere !== "Toutes"
            ? "Aucun cours ne correspond à ces critères."
            : "Vous n'êtes inscrit à aucun cours pour le moment."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/cours/${c.id}`}
              className="block overflow-hidden rounded-2xl border transition-colors"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
            >
              <svg viewBox="0 0 400 130" className="block w-full" style={{ background: "var(--surface-2)" }}>
                <defs>
                  <pattern id={`hc-${c.id}`} width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="8" stroke="#18241f" strokeWidth="4" />
                  </pattern>
                </defs>
                <rect width="400" height="130" fill={`url(#hc-${c.id})`} />
                <text x="200" y="70" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="#5c7168" letterSpacing="1.2">
                  {c.code}
                </text>
              </svg>
              <span className="block px-5 py-[18px]">
                <span className="mb-2.5 flex items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11.5px] font-bold"
                    style={{ background: "var(--chip-bg)", color: "var(--accent)" }}
                  >
                    {c.filiere ?? "—"}
                  </span>
                </span>
                <span className="mb-1.5 block text-lg font-bold">{c.titre}</span>
                <span className="mb-4 block text-sm" style={{ color: "var(--text-muted)" }}>
                  {c.termine}/{c.totalLessons} leçon(s) terminée(s)
                </span>
                <span
                  className="flex justify-between border-t pt-3.5 text-[12.5px]"
                  style={{ borderColor: "var(--line)", color: "var(--text-faint)" }}
                >
                  <span>{c.totalModules} module(s)</span>
                  <span>{c.pct}% complété</span>
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
