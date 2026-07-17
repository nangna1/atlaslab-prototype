import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LaboEEcircuit from "@/components/LaboEEcircuit";
import LaboCircuitVerse from "@/components/LaboCircuitVerse";

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

  const { data: course } = await supabase
    .from("courses")
    .select("id, titre")
    .eq("id", courseId)
    .single();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, titre, type, contenu_markdown, labo_type, labo_config")
    .eq("id", lessonId)
    .single();

  if (!course || !lesson) return notFound();

  const laboConfig = (lesson.labo_config ?? {}) as { netlist?: string; embed_url?: string };

  let statut: string | null = null;
  if (isApprenant) {
    const { data: progress } = await supabase
      .from("progress")
      .select("statut")
      .eq("user_id", user.id)
      .eq("lesson_id", lessonId)
      .maybeSingle();
    statut = progress?.statut ?? "non_commence";
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

      {isApprenant && (
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
