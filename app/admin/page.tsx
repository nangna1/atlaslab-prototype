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
    <main style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      {profile.role === "super_admin" && (
        <p style={{ marginBottom: 12 }}>
          <Link href="/admin/etablissements">Gérer les établissements</Link>
        </p>
      )}
      <h1 style={{ marginBottom: 24 }}>Comptes</h1>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Créer un compte</h2>
        <CreateAccountForm />
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Comptes existants</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(comptes ?? []).map((compte) => (
            <AccountRow key={compte.id} compte={compte} isSelf={compte.id === user.id} />
          ))}
        </div>
      </section>
    </main>
  );
}
