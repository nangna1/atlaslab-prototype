import type { SupabaseClient } from "@supabase/supabase-js";

export type EleveStat = {
  id: string;
  nom: string;
  leconsTerminees: number;
  devoirsRendus: number;
  derniereActivite: string | null;
};

export type ProfStat = {
  id: string;
  nom: string;
  coursCrees: number;
  seancesProgrammees: number;
  derniereActivite: string | null;
};

// Pas de filtre explicite par tenant : comme le reste du dashboard, ces requetes s'appuient
// sur les policies RLS existantes (staff = tenant de l'appelant).
export async function getDashboardStats(
  supabase: SupabaseClient,
): Promise<{ eleveStats: EleveStat[]; profStats: ProfStat[] }> {
  const { data: tenantUsers } = await supabase.from("users").select("id, nom, role");
  const eleves = (tenantUsers ?? []).filter((u) => u.role === "apprenant");
  const professeurs = (tenantUsers ?? []).filter((u) => u.role === "professeur");

  const { data: progressRows } = await supabase
    .from("progress")
    .select("user_id, updated_at")
    .eq("statut", "termine");

  const { data: submissionRows } = await supabase.from("submissions").select("user_id, submitted_at");

  const { data: courseRows } = await supabase.from("courses").select("id, professeur_id, created_at");
  const { data: sessionRows } = await supabase.from("live_sessions").select("professeur_id, date_heure");

  // --- Récapitulatif élèves ---
  const leconsParEleve = new Map<string, number>();
  const devoirsParEleve = new Map<string, number>();
  const derniereParEleve = new Map<string, string>();
  for (const row of progressRows ?? []) {
    leconsParEleve.set(row.user_id, (leconsParEleve.get(row.user_id) ?? 0) + 1);
    const prev = derniereParEleve.get(row.user_id);
    if (!prev || row.updated_at > prev) derniereParEleve.set(row.user_id, row.updated_at);
  }
  for (const row of submissionRows ?? []) {
    devoirsParEleve.set(row.user_id, (devoirsParEleve.get(row.user_id) ?? 0) + 1);
    const prev = derniereParEleve.get(row.user_id);
    if (!prev || row.submitted_at > prev) derniereParEleve.set(row.user_id, row.submitted_at);
  }

  const eleveStats: EleveStat[] = eleves.map((e) => ({
    id: e.id,
    nom: e.nom,
    leconsTerminees: leconsParEleve.get(e.id) ?? 0,
    devoirsRendus: devoirsParEleve.get(e.id) ?? 0,
    derniereActivite: derniereParEleve.get(e.id) ?? null,
  }));

  // --- Récapitulatif professeurs ---
  const coursParProf = new Map<string, number>();
  const seancesParProf = new Map<string, number>();
  const derniereParProf = new Map<string, string>();
  for (const c of courseRows ?? []) {
    if (!c.professeur_id) continue;
    coursParProf.set(c.professeur_id, (coursParProf.get(c.professeur_id) ?? 0) + 1);
    const prev = derniereParProf.get(c.professeur_id);
    if (!prev || c.created_at > prev) derniereParProf.set(c.professeur_id, c.created_at);
  }
  for (const s of sessionRows ?? []) {
    if (!s.professeur_id) continue;
    seancesParProf.set(s.professeur_id, (seancesParProf.get(s.professeur_id) ?? 0) + 1);
    const prev = derniereParProf.get(s.professeur_id);
    if (!prev || s.date_heure > prev) derniereParProf.set(s.professeur_id, s.date_heure);
  }

  const profStats: ProfStat[] = professeurs.map((p) => ({
    id: p.id,
    nom: p.nom,
    coursCrees: coursParProf.get(p.id) ?? 0,
    seancesProgrammees: seancesParProf.get(p.id) ?? 0,
    derniereActivite: derniereParProf.get(p.id) ?? null,
  }));

  return { eleveStats, profStats };
}
