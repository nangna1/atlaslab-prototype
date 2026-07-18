import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateAccountForm from "./CreateAccountForm";
import ImportAccountsForm from "./ImportAccountsForm";
import AccountRow from "./AccountRow";
import { matchesQuery } from "@/lib/search";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { q: qRaw, role: roleFilter } = await searchParams;
  const q = (qRaw ?? "").trim();
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

  const VALID_ROLES = ["professeur", "apprenant", "admin_tenant"];
  let comptesQuery = supabase.from("users").select("id, nom, email, role, actif").order("nom");
  if (roleFilter && VALID_ROLES.includes(roleFilter)) {
    comptesQuery = comptesQuery.eq("role", roleFilter);
  }
  const { data: allComptes } = await comptesQuery;
  const comptes = q
    ? (allComptes ?? []).filter((c) => matchesQuery(c.nom, q) || matchesQuery(c.email, q))
    : allComptes;

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

      <section className="mb-10">
        <ImportAccountsForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Comptes existants</h2>
        <form method="get" className="mb-4 flex flex-wrap gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Rechercher un compte (nom, email)…"
            className="input max-w-sm"
          />
          <select name="role" defaultValue={roleFilter ?? ""} className="input w-auto">
            <option value="">Tous les rôles</option>
            <option value="admin_tenant">Admin établissement</option>
            <option value="professeur">Professeur</option>
            <option value="apprenant">Apprenant</option>
          </select>
          <button type="submit" className="btn-secondary shrink-0">
            Filtrer
          </button>
        </form>
        {(comptes ?? []).length === 0 && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Aucun compte ne correspond à ces critères.
          </p>
        )}
        <div className="flex flex-col gap-2">
          {(comptes ?? []).map((compte) => (
            <AccountRow key={compte.id} compte={compte} isSelf={compte.id === user.id} />
          ))}
        </div>
      </section>
    </main>
  );
}
