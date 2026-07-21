import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

type CreneauRow = {
  id: string;
  jour: number;
  heure_debut: string;
  heure_fin: string;
  salle: string | null;
  courses: { titre: string; professeur_id: string | null; users: { nom: string } | null } | null;
};

export default async function EmploiDuTempsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!profile) redirect("/login");

  const { data: rows } = await supabase
    .from("creneaux_horaires")
    .select("id, jour, heure_debut, heure_fin, salle, courses(titre, professeur_id, users(nom))")
    .order("jour")
    .order("heure_debut");

  // RLS renvoie deja le bon perimetre pour apprenant (cascade via
  // courses_select, restreint aux cours inscrits) et admin_tenant/super_admin
  // (tout le tenant) -- seul professeur doit encore etre filtre applicativement
  // a SES cours enseignes, la RLS de courses lui laissant voir tout le tenant.
  const creneaux = ((rows ?? []) as unknown as CreneauRow[]).filter((c) =>
    profile.role === "professeur" ? c.courses?.professeur_id === user.id : true,
  );

  const parJour = JOURS.map((_, i) => creneaux.filter((c) => c.jour === i));

  return (
    <main className="page">
      <Link href="/cours" className="mb-6 inline-block text-sm text-gray-500 hover:text-gray-700">
        ← Retour à mes cours
      </Link>
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">Emploi du temps</h1>
      <p className="mb-6 text-sm text-gray-500">
        {profile.role === "apprenant" && "Créneaux de vos cours inscrits."}
        {profile.role === "professeur" && "Créneaux de vos cours enseignés."}
        {["admin_tenant", "super_admin"].includes(profile.role) && "Tous les créneaux de l'établissement."}
      </p>

      <div className="flex flex-col gap-8">
        {JOURS.map((label, i) => (
          <section key={label}>
            <h2 className="mb-3 border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">{label}</h2>
            {parJour[i].length === 0 ? (
              <p className="text-sm text-gray-500">Aucun créneau.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {parJour[i].map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <span className="font-medium text-gray-900">
                      {c.heure_debut.slice(0, 5)}–{c.heure_fin.slice(0, 5)}
                    </span>
                    <span className="text-sm text-gray-700">{c.courses?.titre ?? "Cours supprimé"}</span>
                    {c.courses?.users?.nom && <span className="text-sm text-gray-500">{c.courses.users.nom}</span>}
                    {c.salle && <span className="text-sm text-gray-500">{c.salle}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
