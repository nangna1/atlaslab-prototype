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
import OfflineBadge from "./OfflineBadge";

type QuizQuestion = { question: string; options: string[]; correct: number };
type LessonListItem = { id: string; titre: string; ordre: number; moduleOrdre: number };

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
    .select("id, titre, modules(id, ordre, lessons(id, titre, ordre))")
    .eq("id", courseId)
    .single();

  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, titre, type, contenu_markdown, labo_type, labo_config, quiz_questions, piece_jointe_url, piece_jointe_nom, piece_jointe_telechargeable",
    )
    .eq("id", lessonId)
    .single();

  if (!course || !lesson) return notFound();

  // Liste plate ordonnee de toutes les lecons du cours (tous modules
  // confondus, ordre module puis ordre lecon) - sidebar de navigation +
  // "Lecon N sur TOTAL" + bouton "Lecon precedente" (redesign 2026-08-10,
  // aucun equivalent n'existait avant : le lecteur n'avait aucune vue
  // d'ensemble des lecons soeurs).
  type ModuleWithLessons = { ordre: number; lessons: { id: string; titre: string; ordre: number }[] | null };
  const flatLessons: LessonListItem[] = [...((course.modules ?? []) as ModuleWithLessons[])]
    .sort((a, b) => a.ordre - b.ordre)
    .flatMap((m) =>
      [...(m.lessons ?? [])].sort((a, b) => a.ordre - b.ordre).map((l) => ({ ...l, moduleOrdre: m.ordre })),
    );
  const currentIndex = flatLessons.findIndex((l) => l.id === lessonId);
  const previousLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;

  const laboConfig = (lesson.labo_config ?? {}) as { netlist?: string; embed_url?: string };
  const quizQuestions = (lesson.quiz_questions ?? []) as QuizQuestion[];

  let statut: string | null = null;
  let score: number | null = null;
  const termineIds = new Set<string>();
  if (isApprenant) {
    const allIds = flatLessons.map((l) => l.id);
    const { data: progressRows } =
      allIds.length > 0
        ? await supabase.from("progress").select("lesson_id, statut").eq("user_id", user.id).in("lesson_id", allIds)
        : { data: [] };
    for (const row of progressRows ?? []) {
      if (row.statut === "termine") termineIds.add(row.lesson_id);
    }
    statut = termineIds.has(lessonId) ? "termine" : "non_commence";
    if (statut === "termine") {
      const { data: p } = await supabase
        .from("progress")
        .select("score")
        .eq("user_id", user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle();
      score = p?.score ?? null;
    }
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
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[270px_1fr]">
      <div className="border-r px-4 py-6" style={{ borderColor: "var(--line)", background: "var(--bg-panel)" }}>
        <Link href={`/cours/${course.id}`} className="mb-4.5 inline-block px-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          ← {course.titre}
        </Link>
        {flatLessons.length > 0 && (
          <div className="mb-4 px-2 pb-4">
            <div className="h-[5px] overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
              <div
                className="h-full"
                style={{
                  width: `${Math.round(((currentIndex + 1) / flatLessons.length) * 100)}%`,
                  background: "linear-gradient(90deg,var(--accent-deep),var(--accent))",
                }}
              />
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
              Leçon {currentIndex + 1} sur {flatLessons.length}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          {flatLessons.map((l, i) => {
            const isCurrent = l.id === lessonId;
            const isDone = termineIds.has(l.id);
            return (
              <Link
                key={l.id}
                href={`/cours/${course.id}/lecons/${l.id}`}
                className="flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[13.5px]"
                style={{
                  background: isCurrent ? "var(--line)" : "transparent",
                  color: isCurrent ? "var(--text)" : isDone ? "var(--text-muted)" : "var(--text-faint)",
                  fontWeight: isCurrent ? 700 : 500,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: isCurrent ? "var(--accent)" : isDone ? "var(--accent-deep)" : "var(--inactive-dot)" }}
                />
                {i + 1} — {l.titre}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="min-w-0">
        <div
          className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-5 border-b px-5 py-4 backdrop-blur-md lg:px-8"
          style={{ borderColor: "var(--line)", background: "#ffffffeb" }}
        >
          <div className="flex items-center gap-3">
            <OfflineBadge />
            <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              {course.titre}
            </span>
          </div>
          <div className="flex gap-2.5">
            {previousLesson && (
              <Link href={`/cours/${course.id}/lecons/${previousLesson.id}`} className="btn-secondary btn-sm">
                Leçon précédente
              </Link>
            )}
            {isApprenant && lesson.type !== "quiz" && (
              <>
                {statut === "termine" ? (
                  <span className="rounded-[9px] px-4 py-2 text-[13px] font-bold" style={{ color: "var(--accent)" }}>
                    ✓ Terminée
                  </span>
                ) : (
                  <form action={markComplete}>
                    <button type="submit" className="btn-primary btn-sm">
                      Marquer comme terminée
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        <div className="max-w-[900px] px-5 py-6 lg:px-8 lg:py-9">
          <h1 className="mb-4.5 text-[34px] font-extrabold tracking-[-0.03em]">{lesson.titre}</h1>

          {lesson.contenu_markdown && (
            <p className="mb-4 leading-[1.7] whitespace-pre-wrap" style={{ color: "var(--text-2)", fontSize: "16.5px" }}>
              {lesson.contenu_markdown}
            </p>
          )}

          {/* Masque a l'apprenant si le professeur a decoche l'autorisation
              (voir LessonRow.tsx) - toujours visible au staff, qui gere le
              document. Rappel (voir la migration) : ce n'est pas une vraie
              protection technique, le bucket de stockage est public - juste
              un controle d'affichage cote application. */}
          {lesson.piece_jointe_url && (isStaff || lesson.piece_jointe_telechargeable) && (
            <a
              href={lesson.piece_jointe_url}
              target="_blank"
              rel="noreferrer"
              className="card mb-4 flex items-center gap-2 text-sm font-medium"
              style={{ color: "var(--accent)" }}
            >
              📎 {lesson.piece_jointe_nom ?? "Document de la leçon"} — télécharger
            </a>
          )}

          {lesson.type === "labo" && lesson.labo_type === "eecircuit" && (
            <>
              <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
                📴 Disponible hors-ligne dès cette première visite (simulation calculée dans le
                navigateur).
              </p>
              <LaboEEcircuit netlist={laboConfig.netlist ?? ""} />
            </>
          )}

          {lesson.type === "labo" && lesson.labo_type === "circuitverse" && (
            <>
              <p className="mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
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
                  <legend className="px-1 font-medium">{q.question}</legend>
                  {q.options.map((opt, j) => (
                    <p
                      key={j}
                      className="m-1 text-sm"
                      style={{ color: j === q.correct ? "var(--ok-fg)" : "var(--text-muted)", fontWeight: j === q.correct ? 600 : 400 }}
                    >
                      {j === q.correct ? "✓ " : ""}
                      {opt}
                    </p>
                  ))}
                </fieldset>
              ))}
            </div>
          )}

          <section className="mt-10 border-t pt-6" style={{ borderColor: "var(--line)" }}>
            <h2 className="mb-3 text-lg font-semibold">Devoir</h2>
            {!assignment && isStaff && (
              <CreateAssignmentForm courseId={course.id} lessonId={lesson.id} />
            )}
            {!assignment && isApprenant && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Aucun devoir pour cette leçon.
              </p>
            )}
            {assignment && (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="font-medium">{assignment.titre}</p>
                  {assignment.date_limite && (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>
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
        </div>
      </div>
    </div>
  );
}
