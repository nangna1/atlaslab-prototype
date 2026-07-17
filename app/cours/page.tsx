import Link from "next/link";
import { MOCK_COURSES, MOCK_TENANT } from "@/lib/data/mock";

export default function CoursListPage() {
  return (
    <main style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <p style={{ color: "#666", marginBottom: 4 }}>{MOCK_TENANT.nom}</p>
      <h1 style={{ marginBottom: 24 }}>Mes cours</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {MOCK_COURSES.map((course) => (
          <Link
            key={course.id}
            href={`/cours/${course.id}`}
            style={{
              display: "block",
              padding: 20,
              border: "1px solid #ddd",
              borderRadius: 8,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20 }}>{course.titre}</h2>
            <p style={{ margin: "4px 0 0", color: "#666" }}>
              {course.filiere} · {course.modules.length} module(s)
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
