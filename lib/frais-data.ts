import type { SupabaseClient } from "@supabase/supabase-js";

// Solde jamais stocke : toujours recalcule en direct comme
// sum(frais applicables) - sum(paiements), meme principe que progress/
// certificats dans ce projet (voir supabase/migrations/20260801000000_frais_scolarite.sql).
// Un frais "applicable" a un eleve : filiere nulle (tout le monde) OU filiere
// correspondant a l'un des cours ou il est inscrit (enrollments -> courses.filiere).
// Pas de filtre explicite par tenant : comme lib/dashboard-data.ts, ces requetes
// s'appuient sur les policies RLS existantes (staff = tenant de l'appelant).

export type FraisEleveStat = {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  solde: number;
};

export type FraisApplicable = {
  id: string;
  libelle: string;
  filiere: string | null;
  montant: number;
  echeance: string | null;
  paye: number;
  reste: number;
};

async function fetchBrut(supabase: SupabaseClient) {
  const { data: tenantUsers } = await supabase.from("users").select("id, nom, email, telephone, role");
  const { data: fraisRows } = await supabase.from("frais_scolarite").select("id, libelle, filiere, montant, echeance");
  const { data: enrollRows } = await supabase.from("enrollments").select("user_id, course_id");
  const { data: courseRows } = await supabase.from("courses").select("id, filiere");
  const { data: paiementRows } = await supabase.from("paiements_frais").select("user_id, frais_id, montant");

  const filiereParCourse = new Map((courseRows ?? []).map((c) => [c.id, c.filiere as string | null]));
  const filieresParEleve = new Map<string, Set<string>>();
  for (const e of enrollRows ?? []) {
    const filiere = filiereParCourse.get(e.course_id);
    if (!filiere) continue;
    if (!filieresParEleve.has(e.user_id)) filieresParEleve.set(e.user_id, new Set());
    filieresParEleve.get(e.user_id)!.add(filiere);
  }

  const payeParEleveEtFrais = new Map<string, number>();
  for (const p of paiementRows ?? []) {
    const key = `${p.user_id}:${p.frais_id}`;
    payeParEleveEtFrais.set(key, (payeParEleveEtFrais.get(key) ?? 0) + Number(p.montant));
  }

  return {
    eleves: (tenantUsers ?? []).filter((u) => u.role === "apprenant"),
    frais: fraisRows ?? [],
    filieresParEleve,
    payeParEleveEtFrais,
  };
}

function fraisApplicablesPourEleve(
  eleveId: string,
  brut: Awaited<ReturnType<typeof fetchBrut>>,
): FraisApplicable[] {
  const filieresEleve = brut.filieresParEleve.get(eleveId) ?? new Set<string>();
  return brut.frais
    .filter((f) => !f.filiere || filieresEleve.has(f.filiere))
    .map((f) => {
      const paye = brut.payeParEleveEtFrais.get(`${eleveId}:${f.id}`) ?? 0;
      return { ...f, montant: Number(f.montant), paye, reste: Math.max(0, Number(f.montant) - paye) };
    });
}

export async function getFraisStats(supabase: SupabaseClient): Promise<FraisEleveStat[]> {
  const brut = await fetchBrut(supabase);
  return brut.eleves.map((e) => ({
    id: e.id,
    nom: e.nom,
    email: e.email,
    telephone: e.telephone,
    solde: fraisApplicablesPourEleve(e.id, brut).reduce((sum, f) => sum + f.reste, 0),
  }));
}

export async function getFraisApplicablesPourEleve(
  supabase: SupabaseClient,
  eleveId: string,
): Promise<FraisApplicable[]> {
  const brut = await fetchBrut(supabase);
  return fraisApplicablesPourEleve(eleveId, brut);
}
