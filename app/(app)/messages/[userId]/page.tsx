import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SendMessageForm from "../SendMessageForm";
import { markThreadRead } from "../actions";

const ROLE_LABEL: Record<string, string> = {
  admin_tenant: "Admin établissement",
  professeur: "Professeur",
  apprenant: "Apprenant",
};

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: other } = await supabase
    .from("users")
    .select("id, nom, role")
    .eq("id", userId)
    .single();
  if (!other) return notFound();

  await markThreadRead(userId);

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, contenu, created_at")
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`)
    .order("created_at", { ascending: true });

  return (
    <main className="page">
      <Link href="/messages" className="text-sm" style={{ color: "var(--ink-soft)" }}>
        ← Retour aux messages
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold" style={{ color: "var(--ink)" }}>
        {other.nom}{" "}
        <span
          className="text-sm font-normal"
          style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}
        >
          {ROLE_LABEL[other.role] ?? other.role}
        </span>
      </h1>

      <div className="mb-6 flex flex-col gap-2">
        {(messages ?? []).length === 0 && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Aucun message pour le moment — écrivez le premier.
          </p>
        )}
        {(messages ?? []).map((m) => {
          const isMine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className="max-w-[75%] rounded-lg px-3 py-2 text-sm"
                style={
                  isMine
                    ? { background: "var(--brand, #4f46e5)", color: "var(--brand-ink, #fff)" }
                    : { background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink)" }
                }
              >
                <p className="whitespace-pre-wrap">{m.contenu}</p>
                <p
                  className="mt-1 text-[11px]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    opacity: 0.75,
                  }}
                >
                  {new Date(m.created_at).toLocaleString("fr-FR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <SendMessageForm recipientId={userId} />
    </main>
  );
}
