import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function CoursListPage() {
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("id, titre, filiere, tenants(nom), modules(id)");

  const tenantNom = (courses?.[0] as { tenants?: { nom?: string } } | undefined)?.tenants?.nom ?? "";

  return (
    <main style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <p style={{ color: "#666", marginBottom: 4 }}>{tenantNom}</p>
        <form action={signOut}>
          <button type="submit" style={{ fontSize: 14, color: "#666" }}>
            Se déconnecter
          </button>
        </form>
      </div>
      <h1 style={{ marginBottom: 24 }}>Mes cours</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {(courses ?? []).map((course) => (
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
              {course.filiere} · {course.modules?.length ?? 0} module(s)
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
