import { notFound } from "next/navigation";
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
    </main>
  );
}
