import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateAccountForm from "./CreateAccountForm";
import AccountRow from "./AccountRow";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin_tenant", "super_admin"].includes(profile.role)) {
    redirect("/cours");
  }

  const { data: comptes } = await supabase
    .from("users")
    .select("id, nom, email, role, actif")
    .order("nom");

  return (
    <main className="page">
      <div className="mb-3 flex gap-4">
        <Link href="/admin/tableau-de-bord" className="btn-link">
          Tableau de bord
        </Link>
        <Link href="/admin/etablissement" className="btn-link">
          Personnaliser mon établissement
        </Link>
        {profile.role === "super_admin" && (
          <Link href="/admin/etablissements" className="btn-link">
            Gérer les établissements
          </Link>
        )}
      </div>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Comptes</h1>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Créer un compte</h2>
        <CreateAccountForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Comptes existants</h2>
        <div className="flex flex-col gap-2">
          {(comptes ?? []).map((compte) => (
            <AccountRow key={compte.id} compte={compte} isSelf={compte.id === user.id} />
          ))}
        </div>
      </section>
    </main>
  );
}
