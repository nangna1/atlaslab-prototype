import { verifyCertificateCode } from "@/lib/certificate-verification";
import { createAdminClient } from "@/lib/supabase/admin";

type Module = { lessons: { id: string }[] | null };

function InvalidCard() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div className="card w-full max-w-sm text-center">
        <p className="text-2xl">✕</p>
        <h1 className="mt-2 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Certificat introuvable
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
          Ce lien de vérification n&apos;est pas valide, ou le certificat associé n&apos;existe plus.
        </p>
      </div>
    </main>
  );
}

export default async function VerifierCertificatPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const decoded = verifyCertificateCode(code);
  if (!decoded) return <InvalidCard />;

  const admin = createAdminClient();

  const { data: course } = await admin
    .from("courses")
    .select("titre, tenant_id, modules(lessons(id))")
    .eq("id", decoded.courseId)
    .single();
  if (!course) return <InvalidCard />;

  const { data: tenant } = await admin
    .from("tenants")
    .select("nom, logo_url")
    .eq("id", course.tenant_id)
    .single();

  const { data: targetUser } = await admin
    .from("users")
    .select("nom")
    .eq("id", decoded.userId)
    .single();
  if (!targetUser) return <InvalidCard />;

  const lessonIds = ((course.modules ?? []) as Module[]).flatMap((m) => (m.lessons ?? []).map((l) => l.id));
  if (lessonIds.length === 0) return <InvalidCard />;

  const { data: progressRows } = await admin
    .from("progress")
    .select("lesson_id, updated_at")
    .eq("user_id", decoded.userId)
    .eq("statut", "termine")
    .in("lesson_id", lessonIds);

  const isComplete = (progressRows ?? []).length === lessonIds.length;
  if (!isComplete) return <InvalidCard />;

  const dateObtention = (progressRows ?? []).reduce(
    (max, row) => (row.updated_at > max ? row.updated_at : max),
    progressRows![0].updated_at,
  );
  const dateLabel = new Date(dateObtention).toLocaleDateString("fr-FR", { dateStyle: "long" });

  return (
    <main className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div className="card w-full max-w-sm text-center">
        <p className="text-2xl">✓</p>
        <h1 className="mt-2 text-lg font-semibold" style={{ color: "var(--ink)" }}>
          Certificat authentique
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--ink)" }}>
          <strong>{targetUser.nom}</strong> a terminé avec succès le cours
        </p>
        <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
          {course.titre}
        </p>
        <p className="mt-2 text-xs" style={{ color: "var(--ink-soft)" }}>
          Délivré le {dateLabel}
          {tenant?.nom ? ` par ${tenant.nom}` : ""}
        </p>
      </div>
    </main>
  );
}
