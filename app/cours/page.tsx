import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateCourseForm from "./CreateCourseForm";
import ImportCourseForm from "./ImportCourseForm";
import NotificationBell from "./NotificationBell";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function CoursListPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user.id)
    .single();

  const isApprenant = profile?.role === "apprenant";
  const isStaff = ["professeur", "admin_tenant", "super_admin"].includes(profile?.role ?? "");

  const { data: tenant } = profile?.tenant_id
    ? await supabase
        .from("tenants")
        .select("nom, logo_url, couleur_primaire")
        .eq("id", profile.tenant_id)
        .single()
    : { data: null };

  const { data: courses } = await supabase
    .from("courses")
    .select("id, titre, filiere, modules(id)");

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, titre, message, lien, lu, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main
      className="page"
      style={{ "--brand": tenant?.couleur_primaire || undefined } as React.CSSProperties}
    >
      <div className="mb-6 flex items-center justify-between">
        {tenant?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo_url} alt={tenant.nom} className="h-10 w-auto" />
        ) : (
          <p
            className="text-sm font-medium"
            style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
          >
            {tenant?.nom}
          </p>
        )}
        <div className="flex items-center gap-4">
          <NotificationBell notifications={notifications ?? []} />
          <form action={signOut}>
            <button
              type="submit"
              className="btn-link"
              style={{ color: "var(--ink-soft)" }}
            >
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
      <h1 className="mb-6 text-2xl font-bold" style={{ color: "var(--ink)" }}>
        {isApprenant ? "Cours auxquels je suis inscrit" : "Mes cours"}
      </h1>

      {isStaff && (
        <div className="mb-8 flex flex-col gap-4">
          <CreateCourseForm />
          <ImportCourseForm />
        </div>
      )}

      {(courses ?? []).length === 0 && (
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          {isApprenant
            ? "Vous n'êtes inscrit à aucun cours pour le moment."
            : "Aucun cours pour le moment."}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {(courses ?? []).map((course) => (
          <Link key={course.id} href={`/cours/${course.id}`} className="card-link">
            <p
              className="text-xs font-medium tracking-[0.06em] uppercase"
              style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
            >
              {course.filiere} · {course.modules?.length ?? 0} module(s)
            </p>
            <h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--ink)" }}>
              {course.titre}
            </h2>
          </Link>
        ))}
      </div>
    </main>
  );
}
