import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";

type Step = { label: string; description: string; href: string; done: boolean };

// Chaque etape se deduit de l'etat reel des donnees (aucun indicateur "termine"
// a maintenir a part) : la checklist disparait d'elle-meme une fois les 5
// etapes remplies, et reste correcte meme si une action a ete faite ailleurs
// que depuis cette page.
export default async function OnboardingChecklist({
  supabase,
  tenantId,
}: {
  supabase: SupabaseClient;
  tenantId: string;
}) {
  const [{ data: tenant }, { data: courses }, { count: elevesCount }, { count: enrollCount }] = await Promise.all([
    supabase.from("tenants").select("logo_url").eq("id", tenantId).single(),
    supabase.from("courses").select("id, modules(lessons(id))").eq("tenant_id", tenantId),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("role", "apprenant"),
    supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);

  const coursesCount = (courses ?? []).length;
  const lessonsCount = (courses ?? []).reduce(
    (sum, c) =>
      sum + ((c.modules ?? []) as { lessons: { id: string }[] | null }[]).reduce((s, m) => s + (m.lessons?.length ?? 0), 0),
    0,
  );

  const steps: Step[] = [
    {
      label: "Personnaliser votre établissement",
      description: "Ajoutez votre logo et votre couleur de marque.",
      href: "/admin/etablissement",
      done: !!tenant?.logo_url,
    },
    {
      label: "Créer votre premier cours",
      description: "Un cours regroupe modules et leçons pour une filière.",
      href: "/cours",
      done: coursesCount > 0,
    },
    {
      label: "Ajouter du contenu",
      description: "Au moins une leçon dans un de vos cours.",
      href: "/cours",
      done: lessonsCount > 0,
    },
    {
      label: "Ajouter vos premiers élèves",
      description: "Un par un, ou en une fois via l'import CSV.",
      href: "/admin",
      done: (elevesCount ?? 0) > 0,
    },
    {
      label: "Inscrire un élève à un cours",
      description: "Depuis la page du cours, bouton « Inscrire ».",
      href: "/cours",
      done: (enrollCount ?? 0) > 0,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <section className="card-dashed mb-10 flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          🚀 Démarrage de votre établissement — {doneCount}/{steps.length} étapes
        </p>
        <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
          Cette liste disparaît une fois toutes les étapes complétées.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {steps.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex items-center gap-3 rounded-md p-2 text-sm hover:bg-gray-50"
          >
            <span aria-hidden="true">{s.done ? "✅" : "⬜"}</span>
            <span>
              <span className={s.done ? "text-gray-500 line-through" : "font-medium text-gray-900"}>
                {s.label}
              </span>
              <span className="block text-xs text-gray-500">{s.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
