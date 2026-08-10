import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateOffreForm from "./CreateOffreForm";
import OffreRow from "./OffreRow";

export default async function OffresAdminPage() {
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
    !["professeur", "admin_tenant", "super_admin"].includes(profile.role) ||
    !profile.tenant_id
  ) {
    redirect("/admin");
  }

  const { data: offres } = await supabase
    .from("offres_emploi")
    .select("id, titre, entreprise, type, filiere, localisation, statut")
    .order("created_at", { ascending: false });

  return (
    <main className="page">
      <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux comptes
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold text-gray-900">Bourse aux stages/emplois</h1>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Publier une offre</h2>
        <CreateOffreForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Offres publiées</h2>
        {(offres ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Aucune offre publiée pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(offres ?? []).map((offre) => (
              <OffreRow key={offre.id} offre={offre} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
