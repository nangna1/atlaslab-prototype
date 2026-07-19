import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./PrintButton";
import CertificateTemplate from "./CertificateTemplate";
import InsertionSelfForm from "./InsertionSelfForm";
import { isValidInsertionStatut } from "@/lib/insertions";

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
        .select(
          "nom, logo_url, couleur_primaire, adresse, numero_agrement, representant_legal, certificat_modele",
        )
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

  const isOwnCertificate = isApprenant && targetUserId === user.id;
  let currentInsertion: { statut: string; entreprise: string | null; poste: string | null } | null = null;
  if (isOwnCertificate) {
    const { data } = await supabase
      .from("insertions_professionnelles")
      .select("statut, entreprise, poste")
      .eq("user_id", targetUserId)
      .eq("course_id", courseId)
      .maybeSingle();
    currentInsertion = data;
  }

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

      <CertificateTemplate
        tenant={{
          nom: tenant?.nom ?? null,
          logo_url: tenant?.logo_url ?? null,
          couleur_primaire: tenant?.couleur_primaire ?? null,
          adresse: tenant?.adresse ?? null,
          numero_agrement: tenant?.numero_agrement ?? null,
          representant_legal: tenant?.representant_legal ?? null,
          certificat_modele: tenant?.certificat_modele ?? "classique",
        }}
        eleveNom={targetUser.nom}
        courseTitre={course.titre}
        dateObtention={dateObtention}
      />

      <div className="mt-6 flex justify-center">
        <PrintButton />
      </div>

      {isOwnCertificate && (
        <div className="flex justify-center">
          <InsertionSelfForm
            courseId={courseId}
            current={
              currentInsertion && isValidInsertionStatut(currentInsertion.statut)
                ? {
                    statut: currentInsertion.statut,
                    entreprise: currentInsertion.entreprise,
                    poste: currentInsertion.poste,
                  }
                : null
            }
          />
        </div>
      )}
    </main>
  );
}
