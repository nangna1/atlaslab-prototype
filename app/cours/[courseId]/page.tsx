import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse } from "@/lib/data/mock";

const TYPE_LABEL: Record<string, string> = {
  contenu: "📄 Contenu",
  labo: "🔬 Laboratoire",
  quiz: "✅ Quiz",
  seance_directe: "🎥 Séance en direct",
};

export default async function CoursDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = getCourse(courseId);
  if (!course) return notFound();

  return (
    <main style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <Link href="/cours" style={{ color: "#666" }}>
        ← Retour aux cours
      </Link>
      <h1>{course.titre}</h1>
      <p style={{ color: "#666" }}>{course.filiere}</p>

      {course.modules.map((module) => (
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
