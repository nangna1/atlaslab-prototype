import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LaboEEcircuit from "@/components/LaboEEcircuit";
import LaboCircuitVerse from "@/components/LaboCircuitVerse";
import QuizPlayer from "./QuizPlayer";

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
    <main style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <Link href={`/cours/${course.id}`} style={{ color: "#666" }}>
        ← Retour à {course.titre}
      </Link>
      <h1>{lesson.titre}</h1>

      {lesson.contenu_markdown && (
        <p style={{ lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{lesson.contenu_markdown}</p>
      )}

      {lesson.type === "labo" && lesson.labo_type === "eecircuit" && (
        <LaboEEcircuit netlist={laboConfig.netlist ?? ""} />
      )}

      {lesson.type === "labo" && lesson.labo_type === "circuitverse" && (
        <LaboCircuitVerse embedUrl={laboConfig.embed_url ?? ""} />
      )}

      {lesson.type === "quiz" && isApprenant && (
        <QuizPlayer
          questions={quizQuestions}
          action={submitQuiz}
          resultScore={statut === "termine" ? score : null}
        />
      )}

      {lesson.type === "quiz" && isStaff && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {quizQuestions.map((q, i) => (
            <fieldset key={i} style={{ border: "1px solid #eee", borderRadius: 6, padding: 12 }}>
              <legend>{q.question}</legend>
              {q.options.map((opt, j) => (
                <p key={j} style={{ margin: 4, color: j === q.correct ? "#080" : undefined }}>
                  {j === q.correct ? "✓ " : ""}
                  {opt}
                </p>
              ))}
            </fieldset>
          ))}
        </div>
      )}

      {isApprenant && lesson.type !== "quiz" && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee" }}>
          {statut === "termine" ? (
            <p style={{ color: "#080" }}>✓ Leçon terminée</p>
          ) : (
            <form action={markComplete}>
              <button type="submit" style={{ padding: 10 }}>
                Marquer comme terminé
              </button>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
