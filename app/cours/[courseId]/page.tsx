import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EnrollForm from "./EnrollForm";
import AddModuleForm from "./AddModuleForm";
import AddLessonForm from "./AddLessonForm";
import ModuleHeader from "./ModuleHeader";
import LessonRow from "./LessonRow";
import CourseHeader from "../CourseHeader";
import SeanceForm from "./SeanceForm";
import SeanceItem from "./SeanceItem";

const TYPE_LABEL: Record<string, string> = {
  contenu: "📄 Contenu",
  labo: "🔬 Laboratoire",
  quiz: "✅ Quiz",
  seance_directe: "🎥 Séance en direct",
};

type Lesson = {
  id: string;
  titre: string;
  ordre: number;
  type: string;
  contenu_markdown: string | null;
  labo_type: string | null;
  labo_config: { netlist?: string; embed_url?: string } | null;
  quiz_questions: { question: string; options: string[]; correct: number }[] | null;
};
type Module = { id: string; titre: string; ordre: number; lessons: Lesson[] | null };

export default async function CoursDetailPage({
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

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  const isApprenant = profile?.role === "apprenant";
  const isStaff = ["professeur", "admin_tenant", "super_admin"].includes(profile?.role ?? "");

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, titre, filiere, modules(id, titre, ordre, lessons(id, titre, ordre, type, contenu_markdown, labo_type, labo_config, quiz_questions))",
    )
    .eq("id", courseId)
    .single();

  if (!course) return notFound();

  const modules = [...((course.modules ?? []) as Module[])]
    .sort((a, b) => a.ordre - b.ordre)
    .map((module) => ({
      ...module,
      lessons: [...(module.lessons ?? [])].sort((a, b) => a.ordre - b.ordre),
    }));

  let termineeIds = new Set<string>();
  if (isApprenant) {
    const { data: progress } = await supabase
      .from("progress")
      .select("lesson_id")
      .eq("user_id", user.id)
      .eq("statut", "termine");
    termineeIds = new Set((progress ?? []).map((p) => p.lesson_id));
  }

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);

  type Eleve = { user_id: string; nom: string; email: string | null; termine: number };
  let eleves: Eleve[] = [];
  let candidats: { id: string; nom: string; email: string | null }[] = [];
  if (isStaff) {
    const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

    const { data: inscriptions } = await supabase
      .from("enrollments")
      .select("user_id, users(nom, email)")
      .eq("course_id", courseId);

    const { data: progressRows } =
      allLessonIds.length > 0
        ? await supabase
            .from("progress")
            .select("user_id, lesson_id")
            .eq("statut", "termine")
            .in("lesson_id", allLessonIds)
        : { data: [] };

    const termineParEleve = new Map<string, number>();
    for (const row of progressRows ?? []) {
      termineParEleve.set(row.user_id, (termineParEleve.get(row.user_id) ?? 0) + 1);
    }

    eleves = ((inscriptions ?? []) as unknown as { user_id: string; users: { nom: string; email: string | null } | null }[]).map(
      (inscription) => ({
        user_id: inscription.user_id,
        nom: inscription.users?.nom ?? "—",
        email: inscription.users?.email ?? null,
        termine: termineParEleve.get(inscription.user_id) ?? 0,
      }),
    );

    const inscritIds = new Set(eleves.map((e) => e.user_id));
    const { data: apprenants } = await supabase
      .from("users")
      .select("id, nom, email")
      .eq("role", "apprenant");
    candidats = (apprenants ?? []).filter((a) => !inscritIds.has(a.id));
  }

  const { data: seances } = await supabase
    .from("live_sessions")
    .select("id, date_heure, lien_visio")
    .eq("course_id", courseId)
    .order("date_heure");

  return (
    <main className="page">
      <Link href="/cours" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux cours
      </Link>
      <div className="mt-2">
        {isStaff ? (
          <CourseHeader courseId={course.id} titre={course.titre} filiere={course.filiere} />
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-gray-900">{course.titre}</h1>
            <p className="mt-1 mb-6 text-sm text-gray-500">{course.filiere}</p>
          </>
        )}
      </div>
      {isApprenant && (
        <p className="mb-6 text-sm font-medium text-gray-500">
          {termineeIds.size}/{totalLessons} leçon(s) terminée(s)
        </p>
      )}

      {modules.map((module) => (
        <section key={module.id} className="mt-8">
          {isStaff ? (
            <ModuleHeader courseId={course.id} moduleId={module.id} titre={module.titre} />
          ) : (
            <h2 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
              {module.titre}
            </h2>
          )}
          <ul className="flex list-none flex-col gap-2 p-0">
            {module.lessons.map((lesson) =>
              isStaff ? (
                <LessonRow key={lesson.id} courseId={course.id} lesson={lesson} />
              ) : (
                <li key={lesson.id}>
                  <Link href={`/cours/${course.id}/lecons/${lesson.id}`} className="card-link">
                    {isApprenant && (termineeIds.has(lesson.id) ? "✓ " : "")}
                    {TYPE_LABEL[lesson.type]} — {lesson.titre}
                  </Link>
                </li>
              ),
            )}
          </ul>
          {isStaff && <AddLessonForm courseId={course.id} moduleId={module.id} />}
        </section>
      ))}

      {isStaff && (
        <div className="mt-6">
          <AddModuleForm courseId={course.id} />
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
          Séances en direct
        </h2>
        {(seances ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Aucune séance programmée.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(seances ?? []).map((seance) => (
              <SeanceItem key={seance.id} courseId={course.id} seance={seance} isStaff={isStaff} />
            ))}
          </div>
        )}
        {isStaff && (
          <div className="mt-3">
            <SeanceForm courseId={course.id} />
          </div>
        )}
      </section>

      {isStaff && (
        <section className="mt-10">
          <h2 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
            Élèves inscrits
          </h2>
          {eleves.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun élève inscrit.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {eleves.map((eleve) => (
                <div
                  key={eleve.user_id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                >
                  <span className="text-gray-900">{eleve.nom}</span>
                  <span className="text-sm text-gray-500">{eleve.email ?? "—"}</span>
                  <span className="text-sm text-gray-500">
                    {eleve.termine}/{totalLessons} terminé(s)
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3">
            <EnrollForm courseId={course.id} candidats={candidats} />
          </div>
        </section>
      )}
    </main>
  );
}
