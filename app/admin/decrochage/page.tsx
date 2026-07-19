import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardStats } from "@/lib/dashboard-data";
import RelanceButton from "./RelanceButton";

const SEUILS = [7, 14, 30];

export default async function DecrochagePage({
  searchParams,
}: {
  searchParams: Promise<{ seuil?: string }>;
}) {
  const { seuil: seuilRaw } = await searchParams;
  const seuilJours = SEUILS.includes(Number(seuilRaw)) ? Number(seuilRaw) : 7;

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

  const { eleveStats } = await getDashboardStats(supabase);
  const now = Date.now();

  const enrichis = eleveStats.map((e) => ({
    ...e,
    jours: e.derniereActivite
      ? Math.floor((now - new Date(e.derniereActivite).getTime()) / (1000 * 60 * 60 * 24))
      : null,
  }));

  const aRisque = enrichis
    .filter((e) => e.jours === null || e.jours >= seuilJours)
    .sort((a, b) => (b.jours ?? Number.MAX_SAFE_INTEGER) - (a.jours ?? Number.MAX_SAFE_INTEGER));

  return (
    <main className="page">
      <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux comptes
      </Link>
      <h1 className="mt-2 mb-2 text-2xl font-semibold text-gray-900">Alerte de décrochage</h1>
      <p className="mb-6 text-sm text-gray-500">
        Élèves sans leçon terminée ni devoir rendu depuis au moins {seuilJours} jour
        {seuilJours > 1 ? "s" : ""} — ou n&apos;ayant jamais démarré.
      </p>

      <form method="get" className="mb-6 flex items-center gap-2">
        <label htmlFor="seuil" className="text-sm text-gray-600">
          Seuil :
        </label>
        <select id="seuil" name="seuil" defaultValue={String(seuilJours)} className="input w-auto">
          {SEUILS.map((s) => (
            <option key={s} value={s}>
              {s} jours
            </option>
          ))}
        </select>
        <button type="submit" className="btn-secondary">
          Filtrer
        </button>
      </form>

      {aRisque.length === 0 ? (
        <p className="text-sm text-gray-500">Aucun élève à risque pour ce seuil — bon signe !</p>
      ) : (
        <div className="flex flex-col gap-2">
          {aRisque.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3"
            >
              <span className="font-medium text-gray-900">{e.nom}</span>
              <span className="text-sm text-gray-600">
                {e.jours === null ? "Jamais actif" : `Inactif depuis ${e.jours} jour${e.jours > 1 ? "s" : ""}`}
              </span>
              <RelanceButton userId={e.id} userNom={e.nom} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
