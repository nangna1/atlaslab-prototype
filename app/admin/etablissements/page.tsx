import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CreateTenantForm from "./CreateTenantForm";

export default async function EtablissementsPage() {
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

  if (!profile || profile.role !== "super_admin") {
    redirect("/admin");
  }

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, nom, slug, plan, created_at")
    .order("created_at");

  return (
    <main style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <Link href="/admin" style={{ color: "#666" }}>
        ← Retour aux comptes
      </Link>
      <h1 style={{ marginBottom: 24 }}>Établissements</h1>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Créer un établissement</h2>
        <CreateTenantForm />
      </section>

      <section>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Établissements existants</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(tenants ?? []).map((tenant) => (
            <div
              key={tenant.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: 12,
                border: "1px solid #eee",
                borderRadius: 6,
              }}
            >
              <span>{tenant.nom}</span>
              <span style={{ color: "#666" }}>{tenant.slug}</span>
              <span style={{ color: "#666" }}>{tenant.plan}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
