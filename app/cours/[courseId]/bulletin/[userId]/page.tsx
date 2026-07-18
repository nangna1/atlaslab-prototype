import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Lesson = { id: string; titre: string; type: string; module_titre: string };

export default async function BulletinPage({
  params,
}: {
  params: Promise<{ courseId: string; userId: string }>;
}) {
  const { courseId, userId } = await params;
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
  const isStaff = ["professeur", "admin_tenant", "super_admin"].includes(profile?.role ?? "");

  if (!isStaff && user.id !== userId) redirect(`/cours/${courseId}`);

  const { data: course } = await supabase
    .from("courses")
    .select("id, titre, filiere")
    .eq("id", courseId)
    .single();
  if (!course) return notFound();

  const { data: eleve } = await supabase
    .from("users")
    .select("id, nom, email")
    .eq("id", userId)
    .single();
  if (!eleve) return notFound();

  const { data: modules } = await supabase
    .from("courses")
    .select("modules(titre, ordre, lessons(id, titre, ordre, type))")
    .eq("id", courseId)
    .single();

  type ModuleRow = {
    titre: string;
    ordre: number;
    lessons: { id: string; titre: string; ordre: number; type: string }[] | null;
  };
  const lessons: Lesson[] = [...(((modules?.modules ?? []) as ModuleRow[]) ?? [])]
    .sort((a, b) => a.ordre - b.ordre)
    .flatMap((m) =>
      [...(m.lessons ?? [])]
        .sort((a, b) => a.ordre - b.ordre)
        .map((l) => ({ id: l.id, titre: l.titre, type: l.type, module_titre: m.titre })),
    );

  const lessonIds = lessons.map((l) => l.id);

  const { data: progressRows } =
    lessonIds.length > 0
      ? await supabase
          .from("progress")
          .select("lesson_id, statut, score")
          .eq("user_id", userId)
          .in("lesson_id", lessonIds)
      : { data: [] };
  const progressByLesson = new Map(
    (progressRows ?? []).map((p) => [p.lesson_id, { statut: p.statut, score: p.score as number | null }]),
  );

  const { data: assignmentRows } =
    lessonIds.length > 0
      ? await supabase
          .from("assignments")
          .select("id, titre, date_limite, lesson_id")
          .in("lesson_id", lessonIds)
      : { data: [] };
  const assignments = assignmentRows ?? [];
  const assignmentIds = assignments.map((a) => a.id);

  const { data: submissionRows } =
    assignmentIds.length > 0
      ? await supabase
          .from("submissions")
          .select("assignment_id, note, submitted_at")
          .eq("user_id", userId)
          .in("assignment_id", assignmentIds)
      : { data: [] };
  const submissionByAssignment = new Map((submissionRows ?? []).map((s) => [s.assignment_id, s]));

  const lessonTitreById = new Map(lessons.map((l) => [l.id, l.titre]));

  const quizLessons = lessons.filter((l) => l.type === "quiz");
  const quizScores = quizLessons
    .map((l) => progressByLesson.get(l.id)?.score)
    .filter((s): s is number => typeof s === "number");
  const moyenneQuiz =
    quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;

  const devoirsNotes = assignments
    .map((a) => submissionByAssignment.get(a.id)?.note)
    .filter((n): n is number => typeof n === "number");
  const moyenneDevoirs =
    devoirsNotes.length > 0
      ? Math.round((devoirsNotes.reduce((a, b) => a + b, 0) / devoirsNotes.length) * 10) / 10
      : null;

  const termines = lessons.filter((l) => progressByLesson.get(l.id)?.statut === "termine").length;

  return (
    <main className="page">
      <Link href={`/cours/${course.id}`} className="text-sm" style={{ color: "var(--ink-soft)" }}>
        ← Retour à {course.titre}
      </Link>
      <h1 className="mt-2 text-2xl font-bold" style={{ color: "var(--ink)" }}>
        Bulletin — {eleve.nom}
      </h1>
      <p
        className="mt-1 mb-6 text-sm"
        style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
      >
        {course.titre} {course.filiere ? `· ${course.filiere}` : ""}
      </p>

      <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs font-medium tracking-[0.06em] uppercase" style={{ color: "var(--ink-soft)" }}>
            Leçons terminées
          </p>
          <p className="mt-1 text-2xl font-bold" style={{ color: "var(--ink)" }}>
            {termines}/{lessons.length}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium tracking-[0.06em] uppercase" style={{ color: "var(--ink-soft)" }}>
            Moyenne quiz
          </p>
          <p className="mt-1 text-2xl font-bold" style={{ color: "var(--ink)" }}>
            {moyenneQuiz !== null ? `${moyenneQuiz}%` : "—"}
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-medium tracking-[0.06em] uppercase" style={{ color: "var(--ink-soft)" }}>
            Moyenne devoirs
          </p>
          <p className="mt-1 text-2xl font-bold" style={{ color: "var(--ink)" }}>
            {moyenneDevoirs !== null ? `${moyenneDevoirs}/20` : "—"}
          </p>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Quiz
        </h2>
        {quizLessons.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Aucun quiz dans ce cours.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: "var(--ink-soft)" }}>
                  <th className="pr-4 pb-2 font-medium">Leçon</th>
                  <th className="pb-2 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {quizLessons.map((l) => {
                  const p = progressByLesson.get(l.id);
                  return (
                    <tr key={l.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="py-1.5 pr-4">{l.titre}</td>
                      <td className="py-1.5" style={{ fontFamily: "var(--font-mono)" }}>
                        {p?.statut === "termine" && typeof p.score === "number" ? `${p.score}%` : "Non fait"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Devoirs
        </h2>
        {assignments.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Aucun devoir dans ce cours.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: "var(--ink-soft)" }}>
                  <th className="pr-4 pb-2 font-medium">Devoir</th>
                  <th className="pr-4 pb-2 font-medium">Leçon</th>
                  <th className="pb-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const submission = submissionByAssignment.get(a.id);
                  return (
                    <tr key={a.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="py-1.5 pr-4">{a.titre}</td>
                      <td className="py-1.5 pr-4" style={{ color: "var(--ink-soft)" }}>
                        {lessonTitreById.get(a.lesson_id) ?? "—"}
                      </td>
                      <td className="py-1.5" style={{ fontFamily: "var(--font-mono)" }}>
                        {submission
                          ? typeof submission.note === "number"
                            ? `${submission.note}/20`
                            : "Rendu, non noté"
                          : "Non rendu"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
