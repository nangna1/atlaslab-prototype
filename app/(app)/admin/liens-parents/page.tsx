import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateLienForm from "./CreateLienForm";
import LienRow from "./LienRow";

export default async function LiensParentsPage() {
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

  const { data: comptes } = await supabase.from("users").select("id, nom, role").order("nom");
  const parents = (comptes ?? []).filter((c) => c.role === "parent");
  const enfants = (comptes ?? []).filter((c) => c.role === "apprenant");
  const nomParId = new Map((comptes ?? []).map((c) => [c.id, c.nom]));

  const { data: liensRaw } = await supabase
    .from("parents_enfants")
    .select("id, parent_id, enfant_id")
    .order("created_at", { ascending: false });

  const liens = (liensRaw ?? []).map((l) => ({
    id: l.id,
    parentNom: nomParId.get(l.parent_id) ?? "Compte supprimé",
    enfantNom: nomParId.get(l.enfant_id) ?? "Compte supprimé",
  }));

  return (
    <main className="page">
      <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux comptes
      </Link>
      <h1 className="mt-2 mb-2 text-2xl font-semibold text-gray-900">Liens parents-élèves</h1>
      <p className="mb-6 text-sm text-gray-500">
        Reliez un compte <strong>Parent</strong> à un ou plusieurs comptes <strong>Apprenant</strong> pour lui
        donner accès au portail parents (notes, absences, frais de scolarité).
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Créer un lien</h2>
        <CreateLienForm parents={parents} enfants={enfants} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Liens existants</h2>
        {liens.length === 0 ? (
          <p className="text-sm text-gray-500">Aucun lien créé pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {liens.map((l) => (
              <LienRow key={l.id} lien={l} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
