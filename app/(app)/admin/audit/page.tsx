import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ACTION_LABELS: Record<string, string> = {
  compte_cree: "Compte créé",
  comptes_importes: "Comptes importés (CSV)",
  compte_renomme: "Compte renommé",
  compte_desactive: "Compte désactivé",
  compte_reactive: "Compte réactivé",
  etablissement_personnalise: "Établissement personnalisé",
  devoir_note: "Devoir noté",
};

function formatDetails(action: string, details: Record<string, unknown> | null): string {
  if (!details) return "—";
  switch (action) {
    case "compte_cree":
      return `${details.nom} (${details.email}) — ${details.role}`;
    case "comptes_importes":
      return `${details.count} compte(s)`;
    case "compte_renomme":
      return `Nouveau nom : ${details.nom}`;
    case "etablissement_personnalise":
      return `Champs modifiés : ${(details.champs as string[] | undefined)?.join(", ") ?? "—"}`;
    case "devoir_note":
      return `${details.devoir} → ${details.note}/20`;
    default:
      return JSON.stringify(details);
  }
}

export default async function AuditPage() {
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

  const { data: entries } = await supabase
    .from("audit_log")
    .select("id, action, cible_type, details, created_at, users(nom)")
    .order("created_at", { ascending: false })
    .limit(200);

  type Entry = {
    id: string;
    action: string;
    cible_type: string;
    details: Record<string, unknown> | null;
    created_at: string;
    users: { nom: string } | null;
  };

  return (
    <main className="page">
      <Link href="/admin" className="text-sm" style={{ color: "var(--ink-soft)" }}>
        ← Retour aux comptes
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold" style={{ color: "var(--ink)" }}>
        Historique d&apos;audit
      </h1>

      {(entries ?? []).length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
          Aucune action journalisée pour le moment.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: "var(--ink-soft)" }}>
                <th className="pr-4 pb-2 font-medium">Date</th>
                <th className="pr-4 pb-2 font-medium">Acteur</th>
                <th className="pr-4 pb-2 font-medium">Action</th>
                <th className="pb-2 font-medium">Détails</th>
              </tr>
            </thead>
            <tbody>
              {(entries as unknown as Entry[]).map((entry) => (
                <tr key={entry.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td
                    className="py-1.5 pr-4 whitespace-nowrap"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
                  >
                    {new Date(entry.created_at).toLocaleString("fr-FR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="py-1.5 pr-4">{entry.users?.nom ?? "—"}</td>
                  <td className="py-1.5 pr-4">{ACTION_LABELS[entry.action] ?? entry.action}</td>
                  <td className="py-1.5" style={{ color: "var(--ink-soft)" }}>
                    {formatDetails(entry.action, entry.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
