import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/dashboard-data";
import ActivityChart, { type ActivityBucket } from "./ActivityChart";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mondayKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return dayKey(date);
}

function bucketCounts(dates: Date[], bucketKeys: string[], keyFn: (d: Date) => string): number[] {
  const counts = new Map(bucketKeys.map((k) => [k, 0]));
  for (const d of dates) {
    const k = keyFn(d);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return bucketKeys.map((k) => counts.get(k) ?? 0);
}

export default async function TableauDeBordPage() {
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

  if (
    !profile ||
    !["admin_tenant", "super_admin"].includes(profile.role) ||
    !profile.tenant_id
  ) {
    redirect("/admin");
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nom")
    .eq("id", profile.tenant_id)
    .single();

  const { eleveStats, profStats } = await getDashboardStats(supabase);

  const { data: progressRows } = await supabase
    .from("progress")
    .select("user_id, updated_at")
    .eq("statut", "termine");

  const { data: submissionRows } = await supabase.from("submissions").select("user_id, submitted_at");

  const { data: attendanceRowsRaw } = await supabase
    .from("attendance")
    .select("user_id, statut, live_sessions(date_heure)");
  const attendanceRows = (attendanceRowsRaw ?? []) as unknown as {
    user_id: string;
    statut: string;
    live_sessions: { date_heure: string } | null;
  }[];

  // --- Buckets journaliers (14 derniers jours) et hebdomadaires (8 dernières semaines) ---
  const today = new Date();
  const dailyBuckets: { key: string; label: string }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dailyBuckets.push({
      key: dayKey(d),
      label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    });
  }

  const currentMonday = mondayKey(today);
  const weeklyBuckets: { key: string; label: string }[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(`${currentMonday}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeklyBuckets.push({
      key: dayKey(d),
      label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    });
  }

  const leconsDates = (progressRows ?? []).map((r) => new Date(r.updated_at));
  const devoirsDates = (submissionRows ?? []).map((r) => new Date(r.submitted_at));
  const presencesDates = attendanceRows
    .filter((r) => r.statut === "present" && r.live_sessions)
    .map((r) => new Date(r.live_sessions!.date_heure));

  const dailyKeys = dailyBuckets.map((b) => b.key);
  const weeklyKeys = weeklyBuckets.map((b) => b.key);

  const dailyActivity: ActivityBucket[] = dailyBuckets.map((b, i) => ({
    label: b.label,
    lecons: bucketCounts(leconsDates, dailyKeys, dayKey)[i],
    devoirs: bucketCounts(devoirsDates, dailyKeys, dayKey)[i],
    presences: bucketCounts(presencesDates, dailyKeys, dayKey)[i],
  }));

  const weeklyActivity: ActivityBucket[] = weeklyBuckets.map((b, i) => ({
    label: b.label,
    lecons: bucketCounts(leconsDates, weeklyKeys, mondayKey)[i],
    devoirs: bucketCounts(devoirsDates, weeklyKeys, mondayKey)[i],
    presences: bucketCounts(presencesDates, weeklyKeys, mondayKey)[i],
  }));

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "—";

  return (
    <main className="page">
      <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux comptes
      </Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">Tableau de bord — {tenant?.nom}</h1>
        <a href="/admin/tableau-de-bord/export" className="btn-secondary">
          Exporter en CSV
        </a>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Activité de l&apos;établissement</h2>
        <ActivityChart daily={dailyActivity} weekly={weeklyActivity} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Élèves</h2>
        {eleveStats.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun élève pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {eleveStats.map((e) => (
              <div
                key={e.id}
                className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
              >
                <span className="text-gray-900">{e.nom}</span>
                <span className="text-sm text-gray-500">{e.leconsTerminees} leçon(s) terminée(s)</span>
                <span className="text-sm text-gray-500">{e.devoirsRendus} devoir(s) rendu(s)</span>
                <span className="text-sm text-gray-500">Dernière activité : {formatDate(e.derniereActivite)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Professeurs</h2>
        {profStats.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun professeur pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {profStats.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
              >
                <span className="text-gray-900">{p.nom}</span>
                <span className="text-sm text-gray-500">{p.coursCrees} cours créé(s)</span>
                <span className="text-sm text-gray-500">{p.seancesProgrammees} séance(s) programmée(s)</span>
                <span className="text-sm text-gray-500">Dernière activité : {formatDate(p.derniereActivite)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
