import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SendMessageForm from "./SendMessageForm";

const ROLE_LABEL: Record<string, string> = {
  admin_tenant: "Admin établissement",
  professeur: "Professeur",
  apprenant: "Apprenant",
};

export default async function MessagesPage() {
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
  if (!profile?.tenant_id) redirect("/cours");

  const isStaff = ["professeur", "admin_tenant", "super_admin"].includes(profile.role);

  const { data: tenantUsers } = await supabase
    .from("users")
    .select("id, nom, role")
    .neq("id", user.id);

  const contacts = (tenantUsers ?? []).filter((u) =>
    isStaff ? true : ["professeur", "admin_tenant", "super_admin"].includes(u.role),
  );
  const nomById = new Map((tenantUsers ?? []).map((u) => [u.id, { nom: u.nom, role: u.role }]));

  const { data: allMessages } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, contenu, lu, created_at")
    .order("created_at", { ascending: false });

  type Conversation = {
    otherId: string;
    nom: string;
    role: string;
    lastMessage: string;
    lastAt: string;
    unread: number;
  };
  const conversations = new Map<string, Conversation>();
  for (const m of allMessages ?? []) {
    const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    const other = nomById.get(otherId);
    if (!other) continue;
    if (!conversations.has(otherId)) {
      conversations.set(otherId, {
        otherId,
        nom: other.nom,
        role: other.role,
        lastMessage: m.contenu,
        lastAt: m.created_at,
        unread: 0,
      });
    }
    if (m.recipient_id === user.id && !m.lu) {
      conversations.get(otherId)!.unread += 1;
    }
  }
  const conversationList = [...conversations.values()].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );
  const contactsWithoutConversation = contacts.filter((c) => !conversations.has(c.id));

  return (
    <main className="page">
      <Link href="/cours" className="text-sm" style={{ color: "var(--ink-soft)" }}>
        ← Retour aux cours
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold" style={{ color: "var(--ink)" }}>
        Messages
      </h1>

      {conversationList.length === 0 ? (
        <p className="mb-8 text-sm" style={{ color: "var(--ink-soft)" }}>
          Aucune conversation pour le moment.
        </p>
      ) : (
        <div className="mb-8 flex flex-col gap-2">
          {conversationList.map((c) => (
            <Link
              key={c.otherId}
              href={`/messages/${c.otherId}`}
              className="card-link flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold" style={{ color: "var(--ink)" }}>
                  {c.nom}{" "}
                  <span
                    className="text-xs font-normal"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
                  >
                    {ROLE_LABEL[c.role] ?? c.role}
                  </span>
                </p>
                <p className="truncate text-sm" style={{ color: "var(--ink-soft)" }}>
                  {c.lastMessage}
                </p>
              </div>
              {c.unread > 0 && (
                <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                  {c.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      <section className="card-dashed max-w-md">
        <p className="mb-3 text-sm font-medium" style={{ color: "var(--ink)" }}>
          Nouveau message
        </p>
        {contactsWithoutConversation.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            {contacts.length === 0
              ? "Personne à contacter pour le moment."
              : "Vous avez déjà une conversation avec tous vos contacts."}
          </p>
        ) : (
          <SendMessageForm contacts={contactsWithoutConversation} />
        )}
      </section>
    </main>
  );
}
