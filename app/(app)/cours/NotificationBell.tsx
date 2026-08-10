"use client";

import { useEffect, useRef, useState } from "react";
import { markNotificationRead } from "./actions";

type Notification = {
  id: string;
  titre: string;
  message: string;
  lien: string | null;
  lu: boolean;
  created_at: string;
};

export default function NotificationBell({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.lu).length;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-[11px] rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors"
        style={{
          background: open ? "var(--line)" : "transparent",
          color: open ? "var(--text)" : "var(--text-muted)",
          fontWeight: open ? 700 : 500,
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lue(s))` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span
          className="h-[7px] w-[7px] rounded-full"
          style={{ background: unreadCount > 0 ? "var(--accent)" : "var(--inactive-dot)" }}
        />
        <span className="flex-1">Notifications</span>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        // Deploie vers la droite hors de la sidebar (248px de large, pas de
        // place a droite du bouton lui-meme) plutot que vers le bas comme
        // avant (redesign 2026-08-10, l'ancien `absolute right-0 mt-2`
        // supposait une barre horizontale large, pas une colonne etroite).
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute bottom-0 left-full z-10 ml-2 w-80 rounded-2xl border p-2"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          {notifications.length === 0 ? (
            <p className="p-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Aucune notification.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {notifications.map((n) => (
                <form key={n.id} action={markNotificationRead}>
                  <input type="hidden" name="notification_id" value={n.id} />
                  <input type="hidden" name="lien" value={n.lien ?? "/cours"} />
                  <button
                    type="submit"
                    role="menuitem"
                    className="block w-full rounded-lg p-2 text-left text-sm"
                    style={{ color: n.lu ? "var(--text-muted)" : "var(--text)", fontWeight: n.lu ? 400 : 600 }}
                  >
                    <span className="block">{n.titre}</span>
                    <span className="block text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                      {n.message}
                    </span>
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
