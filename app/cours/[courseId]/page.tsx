import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TYPE_LABEL: Record<string, string> = {
  contenu: "📄 Contenu",
  labo: "🔬 Laboratoire",
  quiz: "✅ Quiz",
  seance_directe: "🎥 Séance en direct",
};

type Lesson = { id: string; titre: string; ordre: number; type: string };
type Module = { id: string; titre: string; ordre: number; lessons: Lesson[] | null };

export default async function CoursDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, titre, filiere, modules(id, titre, ordre, lessons(id, titre, ordre, type))")
    .eq("id", courseId)
    .single();

  if (!course) return notFound();

  const modules = [...((course.modules ?? []) as Module[])]
    .sort((a, b) => a.ordre - b.ordre)
    .map((module) => ({
      ...module,
      lessons: [...(module.lessons ?? [])].sort((a, b) => a.ordre - b.ordre),
    }));

  return (
    <main style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <Link href="/cours" style={{ color: "#666" }}>
        ← Retour aux cours
      </Link>
      <h1>{course.titre}</h1>
      <p style={{ color: "#666" }}>{course.filiere}</p>

      {modules.map((module) => (
        <section key={module.id} style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, borderBottom: "1px solid #ddd", paddingBottom: 8 }}>
            {module.titre}
          </h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {module.lessons.map((lesson) => (
              <li key={lesson.id} style={{ marginBottom: 8 }}>
                <Link
                  href={`/cours/${course.id}/lecons/${lesson.id}`}
                  style={{
                    display: "block",
                    padding: 12,
                    border: "1px solid #eee",
                    borderRadius: 6,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  {TYPE_LABEL[lesson.type]} — {lesson.titre}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
