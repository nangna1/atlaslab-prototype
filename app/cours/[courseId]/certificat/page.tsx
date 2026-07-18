import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./PrintButton";

type Module = { lessons: { id: string }[] | null };

export default async function CertificatPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { courseId } = await params;
  const { eleve: eleveParam } = await searchParams;
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

  let targetUserId: string;
  if (isApprenant) {
    targetUserId = user.id;
  } else if (isStaff && typeof eleveParam === "string" && eleveParam) {
    targetUserId = eleveParam;
  } else {
    return notFound();
  }

  const { data: tenant } = profile?.tenant_id
    ? await supabase
        .from("tenants")
        .select("nom, logo_url, couleur_primaire")
        .eq("id", profile.tenant_id)
        .single()
    : { data: null };

  const { data: course } = await supabase
    .from("courses")
    .select("id, titre, modules(lessons(id))")
    .eq("id", courseId)
    .single();

  if (!course) return notFound();

  const { data: targetUser } = await supabase
    .from("users")
    .select("nom")
    .eq("id", targetUserId)
    .single();

  if (!targetUser) return notFound();

  const allLessonIds = ((course.modules ?? []) as Module[]).flatMap(
    (m) => (m.lessons ?? []).map((l) => l.id),
  );
  const totalLessons = allLessonIds.length;

  const { data: progressRows } =
    totalLessons > 0
      ? await supabase
          .from("progress")
          .select("lesson_id, updated_at")
          .eq("user_id", targetUserId)
          .eq("statut", "termine")
          .in("lesson_id", allLessonIds)
      : { data: [] };

  const completedCount = progressRows?.length ?? 0;
  const isComplete = totalLessons > 0 && completedCount === totalLessons;

  if (!isComplete) {
    return (
      <main className="page">
        <Link href={`/cours/${courseId}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Retour à {course.titre}
        </Link>
        <p className="mt-6 text-sm text-gray-500">
          {isApprenant
            ? "Ce cours n'est pas encore terminé à 100%."
            : "Cet élève n'a pas encore terminé ce cours."}
        </p>
      </main>
    );
  }

  const dateObtention = (progressRows ?? []).reduce(
    (max, row) => (row.updated_at > max ? row.updated_at : max),
    (progressRows ?? [])[0].updated_at,
  );

  return (
    <main
      className="page print:max-w-none print:p-0"
      style={{ "--brand": tenant?.couleur_primaire || undefined } as React.CSSProperties}
    >
      <Link
        href={`/cours/${courseId}`}
        className="mb-6 inline-block text-sm text-gray-500 hover:text-gray-700 print:hidden"
      >
        ← Retour à {course.titre}
      </Link>

      <div
        className="flex flex-col items-center gap-4 rounded-lg border-4 p-12 text-center print:border-0"
        style={{ borderColor: "var(--brand)" }}
      >
        {tenant?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo_url} alt={tenant.nom} className="h-16 w-auto" />
        ) : (
          <p className="text-sm font-medium text-gray-500">{tenant?.nom}</p>
        )}

        <p className="text-sm tracking-widest text-gray-500 uppercase">Certificat de réussite</p>
        <p className="text-sm text-gray-600">Ce certificat est décerné à</p>
        <h1 className="text-3xl font-semibold text-gray-900">{targetUser.nom}</h1>
        <p className="text-sm text-gray-600">
          pour avoir complété avec succès le cours
        </p>
        <h2 className="text-xl font-medium text-gray-900">{course.titre}</h2>
        <p className="mt-4 text-sm text-gray-500">
          Délivré le{" "}
          {new Date(dateObtention).toLocaleDateString("fr-FR", { dateStyle: "long" })}
        </p>
        {tenant?.nom && <p className="text-sm text-gray-500">{tenant.nom}</p>}
      </div>

      <div className="mt-6 flex justify-center">
        <PrintButton />
      </div>
    </main>
  );
}
