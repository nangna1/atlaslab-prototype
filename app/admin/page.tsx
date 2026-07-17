import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateAccountForm from "./CreateAccountForm";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  admin_tenant: "Admin établissement",
  professeur: "Professeur",
  apprenant: "Apprenant",
};

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
    .select("id, nom, email, role")
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
            <div
              key={compte.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 6,
              }}
            >
              <span>{compte.nom}</span>
              <span style={{ color: "#666" }}>{compte.email ?? "—"}</span>
              <span style={{ color: "#666" }}>{ROLE_LABEL[compte.role] ?? compte.role}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
