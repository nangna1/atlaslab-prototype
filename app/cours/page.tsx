import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateCourseForm from "./CreateCourseForm";

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
    .select("role")
    .eq("id", user.id)
    .single();

  const isApprenant = profile?.role === "apprenant";
  const isStaff = ["professeur", "admin_tenant", "super_admin"].includes(profile?.role ?? "");

  const { data: courses } = await supabase
    .from("courses")
    .select("id, titre, filiere, tenants(nom), modules(id)");

  const tenantNom = (courses?.[0] as { tenants?: { nom?: string } } | undefined)?.tenants?.nom ?? "";

  return (
    <main className="page">
      <div className="mb-6 flex items-baseline justify-between">
        <p className="text-sm font-medium text-gray-500">{tenantNom}</p>
        <form action={signOut}>
          <button type="submit" className="btn-link text-gray-500 hover:text-gray-700">
            Se déconnecter
          </button>
        </form>
      </div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">
        {isApprenant ? "Cours auxquels je suis inscrit" : "Mes cours"}
      </h1>

      {isStaff && (
        <div className="mb-8">
          <CreateCourseForm />
        </div>
      )}

      {(courses ?? []).length === 0 && (
        <p className="text-sm text-gray-500">
          {isApprenant
            ? "Vous n'êtes inscrit à aucun cours pour le moment."
            : "Aucun cours pour le moment."}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {(courses ?? []).map((course) => (
          <Link key={course.id} href={`/cours/${course.id}`} className="card-link">
            <h2 className="text-lg font-semibold text-gray-900">{course.titre}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {course.filiere} · {course.modules?.length ?? 0} module(s)
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
