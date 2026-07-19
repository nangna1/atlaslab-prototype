import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LaboEEcircuit from "@/components/LaboEEcircuit";
import LaboCircuitVerse from "@/components/LaboCircuitVerse";
import QuizPlayer from "./QuizPlayer";
import CreateAssignmentForm from "./CreateAssignmentForm";
import SubmissionForm from "./SubmissionForm";
import GradingList from "./GradingList";

type QuizQuestion = { question: string; options: string[]; correct: number };

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
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
    .select("id, titre")
    .eq("id", courseId)
    .single();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, titre, type, contenu_markdown, labo_type, labo_config, quiz_questions")
    .eq("id", lessonId)
    .single();

  if (!course || !lesson) return notFound();

  const laboConfig = (lesson.labo_config ?? {}) as { netlist?: string; embed_url?: string };
  const quizQuestions = (lesson.quiz_questions ?? []) as QuizQuestion[];

  let statut: string | null = null;
  let score: number | null = null;
  if (isApprenant) {
    const { data: progress } = await supabase
      .from("progress")
      .select("statut, score")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    statut = progress?.statut ?? "non_commence";
    score = progress?.score ?? null;
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, titre, date_limite")
    .eq("lesson_id", lessonId)
    .maybeSingle();

  let mySubmission: { contenu: string | null; fichier_url: string | null; note: number | null } | null = null;
  let submissions: {
    id: string;
    user_id: string;
    nom: string;
    contenu: string | null;
    fichier_url: string | null;
    note: number | null;
    submitted_at: string;
  }[] = [];

  if (assignment) {
    if (isApprenant) {
      const { data } = await supabase
        .from("submissions")
        .select("contenu, fichier_url, note")
        .eq("assignment_id", assignment.id)
        .eq("user_id", user.id)
        .maybeSingle();
      mySubmission = data;
    }
    if (isStaff) {
      const { data } = await supabase
        .from("submissions")
        .select("id, user_id, contenu, fichier_url, note, submitted_at, users(nom)")
        .eq("assignment_id", assignment.id)
        .order("submitted_at");
      submissions = ((data ?? []) as unknown as {
        id: string;
        user_id: string;
        contenu: string | null;
        fichier_url: string | null;
        note: number | null;
        submitted_at: string;
        users: { nom: string } | null;
      }[]).map((s) => ({
        id: s.id,
        user_id: s.user_id,
        nom: s.users?.nom ?? "—",
        contenu: s.contenu,
        fichier_url: s.fichier_url,
        note: s.note,
        submitted_at: s.submitted_at,
      }));
    }
  }

  async function markComplete() {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    await supabase
      .from("progress")
      .upsert(
        { user_id: user.id, lesson_id: lessonId, statut: "termine" },
        { onConflict: "user_id,lesson_id" },
      );

    revalidatePath(`/cours/${courseId}/lecons/${lessonId}`);
  }

  async function submitQuiz(formData: FormData) {
    "use server";
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    let correct = 0;
    quizQuestions.forEach((q, i) => {
      const answer = formData.get(`answer-${i}`);
      if (answer !== null && Number(answer) === q.correct) correct++;
    });
    const computedScore = quizQuestions.length > 0 ? Math.round((correct / quizQuestions.length) * 100) : 0;

    await supabase
      .from("progress")
      .upsert(
        { user_id: user.id, lesson_id: lessonId, statut: "termine", score: computedScore },
        { onConflict: "user_id,lesson_id" },
      );

    revalidatePath(`/cours/${courseId}/lecons/${lessonId}`);
  }

  return (
    <main className="page max-w-3xl">
      <Link href={`/cours/${course.id}`} className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour à {course.titre}
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold text-gray-900">{lesson.titre}</h1>

      {lesson.contenu_markdown && (
        <p className="mb-4 whitespace-pre-wrap leading-relaxed text-gray-700">
          {lesson.contenu_markdown}
        </p>
      )}

      {lesson.type === "labo" && lesson.labo_type === "eecircuit" && (
        <>
          <p className="mb-2 text-xs" style={{ color: "var(--ink-soft)" }}>
            📴 Disponible hors-ligne dès cette première visite (simulation calculée dans le
            navigateur).
          </p>
          <LaboEEcircuit netlist={laboConfig.netlist ?? ""} />
        </>
      )}

      {lesson.type === "labo" && lesson.labo_type === "circuitverse" && (
        <>
          <p className="mb-2 text-xs" style={{ color: "var(--ink-soft)" }}>
            🌐 Nécessite une connexion internet (laboratoire hébergé sur circuitverse.org).
          </p>
          <LaboCircuitVerse embedUrl={laboConfig.embed_url ?? ""} />
        </>
      )}

      {lesson.type === "quiz" && isApprenant && (
        <QuizPlayer
          questions={quizQuestions}
          action={submitQuiz}
          resultScore={statut === "termine" ? score : null}
        />
      )}

      {lesson.type === "quiz" && isStaff && (
        <div className="flex flex-col gap-4">
          {quizQuestions.map((q, i) => (
            <fieldset key={i} className="card">
              <legend className="px-1 font-medium text-gray-900">{q.question}</legend>
              {q.options.map((opt, j) => (
                <p key={j} className={`m-1 text-sm ${j === q.correct ? "font-medium text-green-700" : "text-gray-600"}`}>
                  {j === q.correct ? "✓ " : ""}
                  {opt}
                </p>
              ))}
            </fieldset>
          ))}
        </div>
      )}

      {isApprenant && lesson.type !== "quiz" && (
        <div className="mt-6 border-t border-gray-200 pt-4">
          {statut === "termine" ? (
            <p className="font-medium text-green-700">✓ Leçon terminée</p>
          ) : (
            <form action={markComplete}>
              <button type="submit" className="btn-primary">
                Marquer comme terminé
              </button>
            </form>
          )}
        </div>
      )}

      <section className="mt-10 border-t border-gray-200 pt-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Devoir</h2>
        {!assignment && isStaff && (
          <CreateAssignmentForm courseId={course.id} lessonId={lesson.id} />
        )}
        {!assignment && isApprenant && (
          <p className="text-sm text-gray-500">Aucun devoir pour cette leçon.</p>
        )}
        {assignment && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-medium text-gray-900">{assignment.titre}</p>
              {assignment.date_limite && (
                <p className="text-sm text-gray-500">
                  À rendre avant le{" "}
                  {new Date(assignment.date_limite).toLocaleString("fr-FR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
            </div>
            {isApprenant && (
              <SubmissionForm
                courseId={course.id}
                lessonId={lesson.id}
                assignmentId={assignment.id}
                submission={mySubmission}
              />
            )}
            {isStaff && (
              <GradingList courseId={course.id} lessonId={lesson.id} submissions={submissions} />
            )}
          </div>
        )}
      </section>
    </main>
  );
}
