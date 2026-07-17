import { notFound } from "next/navigation";
import Link from "next/link";
import { getLesson } from "@/lib/data/mock";
import LaboEEcircuit from "@/components/LaboEEcircuit";
import LaboCircuitVerse from "@/components/LaboCircuitVerse";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const found = getLesson(courseId, lessonId);
  if (!found) return notFound();
  const { course, lesson } = found;

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
        <LaboEEcircuit netlist={lesson.labo_config?.netlist ?? ""} />
      )}

      {lesson.type === "labo" && lesson.labo_type === "circuitverse" && (
        <LaboCircuitVerse embedUrl={lesson.labo_config?.embed_url ?? ""} />
      )}
    </main>
  );
}
