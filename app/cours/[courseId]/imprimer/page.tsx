import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./PrintButton";

type Lesson = {
  id: string;
  titre: string;
  ordre: number;
  type: string;
  contenu_markdown: string | null;
  labo_type: string | null;
  labo_config: { netlist?: string; embed_url?: string } | null;
  quiz_questions: { question: string; options: string[] }[] | null;
  piece_jointe_url: string | null;
  piece_jointe_nom: string | null;
};
type Module = { id: string; titre: string; ordre: number; lessons: Lesson[] | null };

const TYPE_LABEL: Record<string, string> = {
  contenu: "Contenu",
  labo: "Laboratoire",
  quiz: "Quiz",
  seance_directe: "Séance en direct",
};

export default async function ImprimerCoursPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("tenant_id").eq("id", user.id).single();

  const { data: tenant } = profile?.tenant_id
    ? await supabase
        .from("tenants")
        .select("nom, logo_url, couleur_primaire")
        .eq("id", profile.tenant_id)
        .single()
    : { data: null };

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, titre, filiere, modules(id, titre, ordre, lessons(id, titre, ordre, type, contenu_markdown, labo_type, labo_config, quiz_questions, piece_jointe_url, piece_jointe_nom))",
    )
    .eq("id", courseId)
    .single();

  if (!course) return notFound();

  const modules = [...((course.modules ?? []) as Module[])]
    .sort((a, b) => a.ordre - b.ordre)
    .map((m) => ({ ...m, lessons: [...(m.lessons ?? [])].sort((a, b) => a.ordre - b.ordre) }));

  const dateGeneration = new Date().toLocaleDateString("fr-FR", { dateStyle: "long" });

  return (
    <main
      className="page max-w-3xl print:max-w-none print:p-0"
      style={{ "--brand": tenant?.couleur_primaire || undefined } as React.CSSProperties}
    >
      <Link
        href={`/cours/${courseId}`}
        className="mb-6 inline-block text-sm text-gray-500 hover:text-gray-700 print:hidden"
      >
        ← Retour au cours
      </Link>

      <header className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          {tenant?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt={tenant.nom} className="mb-2 h-12 w-auto" />
          ) : null}
          <h1 className="text-2xl font-semibold text-gray-900">{course.titre}</h1>
          {course.filiere && <p className="text-sm text-gray-500">{course.filiere}</p>}
          <p className="mt-1 text-xs text-gray-400">
            {tenant?.nom ? `${tenant.nom} — ` : ""}Support généré le {dateGeneration}
          </p>
        </div>
        <PrintButton />
      </header>

      {modules.length === 0 ? (
        <p className="text-sm text-gray-500">Ce cours n&apos;a pas encore de contenu.</p>
      ) : (
        modules.map((module, mi) => (
          <section key={module.id} className="mb-10 break-inside-avoid-page">
            <h2 className="mb-3 text-lg font-semibold text-gray-900">
              Module {mi + 1} — {module.titre}
            </h2>
            <div className="flex flex-col gap-6">
              {module.lessons.map((lesson, li) => (
                <article key={lesson.id} className="break-inside-avoid-page">
                  <h3 className="font-medium text-gray-900">
                    {mi + 1}.{li + 1} {lesson.titre}
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      {TYPE_LABEL[lesson.type] ?? lesson.type}
                    </span>
                  </h3>

                  {lesson.contenu_markdown && (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                      {lesson.contenu_markdown}
                    </p>
                  )}

                  {lesson.type === "labo" && lesson.labo_type === "eecircuit" && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        Laboratoire de simulation électronique — netlist SPICE (à exécuter en ligne, dans
                        AtlasLab, pour voir les résultats) :
                      </p>
                      <pre className="mt-1 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-xs text-gray-700">
                        {lesson.labo_config?.netlist ?? ""}
                      </pre>
                    </div>
                  )}

                  {lesson.type === "labo" && lesson.labo_type === "circuitverse" && (
                    <p className="mt-1 text-xs text-gray-500">
                      Laboratoire de logique numérique interactif — à consulter en ligne dans AtlasLab.
                    </p>
                  )}

                  {lesson.type === "quiz" && lesson.quiz_questions && lesson.quiz_questions.length > 0 && (
                    <div className="mt-2 flex flex-col gap-2">
                      {lesson.quiz_questions.map((q, qi) => (
                        <div key={qi} className="text-sm">
                          <p className="font-medium text-gray-800">
                            {qi + 1}. {q.question}
                          </p>
                          <ul className="ml-4 list-disc text-gray-600">
                            {q.options.map((opt, oi) => (
                              <li key={oi}>{opt}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <p className="text-xs text-gray-400">
                        Quiz à faire en ligne dans AtlasLab pour connaître vos réponses.
                      </p>
                    </div>
                  )}

                  {lesson.piece_jointe_url && (
                    <p className="mt-2 text-sm">
                      📎 Document joint :{" "}
                      <a href={lesson.piece_jointe_url} className="text-indigo-600 hover:underline">
                        {lesson.piece_jointe_nom ?? "consulter en ligne"}
                      </a>
                    </p>
                  )}
                </article>
              ))}
            </div>
          </section>
        ))
      )}

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
        Support de cours généré automatiquement par AtlasLab — les laboratoires interactifs et les quiz
        auto-corrigés restent accessibles en ligne pour une expérience complète.
      </footer>
    </main>
  );
}
