"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { matchModule } from "@/lib/assistant-modules";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

// Nombre d'echanges recents envoyes au serveur a chaque requete -- borne le
// cout par appel, l'historique affiche a l'ecran n'est lui pas tronque.
const HISTORIQUE_ENVOYE = 10;

function newId(): string {
  return Math.random().toString(36).slice(2);
}

/**
 * Assistant IA flottant, present sur toutes les pages une fois connecte
 * (voir app/layout.tsx). Contextuel : sait sur quel module de l'app
 * l'utilisateur se trouve via le chemin de l'URL (lib/assistant-modules.ts)
 * et adapte sa reponse a son role cote serveur (lib/assistant-knowledge.ts).
 */
export default function AiAssistant({ role, locale }: { role: string | null; locale: string }) {
  const pathname = usePathname();
  const moduleContext = matchModule(pathname ?? "/");

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // Ref (pas de state) : evite un setState synchrone en tete d'effet (juste
  // un garde-fou pour ne declencher le fetch qu'une fois), regle par la lint
  // react-hooks/set-state-in-effect.
  const historyFetchStarted = useRef(false);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  // Historique charge une seule fois, a la premiere ouverture du panneau
  // (evite un aller-retour reseau sur chaque page si l'utilisateur n'ouvre
  // jamais l'assistant).
  useEffect(() => {
    if (!open || historyFetchStarted.current) return;
    historyFetchStarted.current = true;
    fetch("/api/assistant")
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data: { messages?: { id: string; role: "user" | "assistant"; content: string }[] }) => {
        setMessages((prev) =>
          prev.length > 0
            ? prev
            : (data.messages ?? []).map((m) => ({ id: m.id, role: m.role, content: m.content })),
        );
      })
      .catch(() => {
        // echec silencieux : l'utilisateur peut toujours discuter, juste
        // sans historique precedent charge.
      })
      .finally(() => setHistoryLoaded(true));
  }, [open]);

  async function handleClear() {
    setMessages([]);
    try {
      await fetch("/api/assistant", { method: "DELETE" });
    } catch {
      // l'affichage est deja vide ; une erreur reseau ici n'a pas besoin
      // d'etre remontee a l'utilisateur.
    }
  }

  if (!role) return null;

  async function handleSend() {
    const texte = input.trim();
    if (!texte || streaming) return;

    const userMessage: ChatMessage = { id: newId(), role: "user", content: texte };
    const assistantId = newId();
    const historiquePourApi = [...messages, userMessage]
      .filter((m) => !m.isError)
      .slice(-HISTORIQUE_ENVOYE)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historiquePourApi,
          moduleTitle: moduleContext.title,
          moduleDescription: moduleContext.description,
          locale,
        }),
      });

      if (!res.ok || !res.body) {
        let errorMessage = "L'assistant est momentanement indisponible.";
        try {
          const data = await res.json();
          if (typeof data?.error === "string") errorMessage = data.error;
        } catch {
          // reponse non-JSON : on garde le message generique
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: errorMessage, isError: true } : m)),
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m)));
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Connexion impossible a l'assistant. Reessayez.", isError: true }
            : m,
        ),
      );
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          className="flex h-[min(32rem,70vh)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[3px] border shadow-xl"
          style={{ background: "var(--surface)", borderColor: "var(--line-strong)" }}
        >
          <div
            className="flex items-start justify-between gap-2 border-b px-4 py-3"
            style={{ borderColor: "var(--line)" }}
          >
            <div>
              <p
                className="text-sm font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}
              >
                Assistant AtlasLab
              </p>
              <p
                className="mt-0.5 text-[11px] tracking-[0.08em] uppercase"
                style={{ fontFamily: "var(--font-mono)", color: "var(--brand)" }}
              >
                {moduleContext.title}
              </p>
            </div>
            <div className="flex items-start gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-[3px] px-2 py-1 text-[11px]"
                  style={{ color: "var(--ink-soft)" }}
                >
                  Effacer
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer l'assistant"
                className="rounded-[3px] px-2 py-1 text-sm leading-none"
                style={{ color: "var(--ink-soft)" }}
              >
                ✕
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
                {!historyLoaded
                  ? "Chargement de l'historique…"
                  : (
                    <>
                      Une question sur <strong>{moduleContext.title.toLowerCase()}</strong> ? Demandez-moi comment
                      faire, je connais chaque module d&apos;AtlasLab.
                    </>
                  )}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[85%] rounded-[3px] px-3 py-2 text-sm whitespace-pre-wrap ${
                      m.role === "user" ? "self-end" : "self-start"
                    }`}
                    style={
                      m.role === "user"
                        ? { background: "var(--brand)", color: "var(--brand-ink)" }
                        : {
                            background: "var(--background-muted)",
                            color: m.isError ? "#9a3b3b" : "var(--ink)",
                          }
                    }
                  >
                    {m.content || (streaming && m.role === "assistant" ? "…" : "")}
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2 border-t p-3"
            style={{ borderColor: "var(--line)" }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              placeholder="Comment faire pour..."
              className="max-h-24 flex-1 resize-none rounded-[3px] border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--line-strong)", background: "var(--surface)", color: "var(--ink)" }}
            />
            <button type="submit" disabled={streaming || !input.trim()} className="btn-primary px-3 py-2">
              Envoyer
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-primary rounded-[3px] px-4 py-3 shadow-lg"
        aria-label={open ? "Fermer l'assistant AtlasLab" : "Ouvrir l'assistant AtlasLab"}
        aria-expanded={open}
      >
        {open ? "Fermer" : "Besoin d'aide ?"}
      </button>
    </div>
  );
}
