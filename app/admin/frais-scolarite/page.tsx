import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateFraisForm from "./CreateFraisForm";
import FraisRow from "./FraisRow";

export default async function FraisScolaritePage() {
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

  const { data: frais } = await supabase
    .from("frais_scolarite")
    .select("id, libelle, filiere, montant, echeance")
    .order("created_at", { ascending: false });

  return (
    <main className="page">
      <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
        ← Retour aux comptes
      </Link>
      <h1 className="mt-2 mb-2 text-2xl font-semibold text-gray-900">Frais de scolarité</h1>
      <p className="mb-6 text-sm text-gray-500">
        Définissez les frais applicables à votre établissement. Pour enregistrer un paiement d&apos;un
        élève, rendez-vous sur{" "}
        <Link href="/admin/paiements" className="text-indigo-600 hover:underline">
          Paiements
        </Link>
        .
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Créer un frais</h2>
        <CreateFraisForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Frais existants</h2>
        {(frais ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">Aucun frais défini pour le moment.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(frais ?? []).map((f) => (
              <FraisRow key={f.id} frais={f} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
