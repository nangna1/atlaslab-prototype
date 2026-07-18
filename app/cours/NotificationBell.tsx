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
        className="relative text-gray-500 hover:text-gray-700"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lue(s))` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        🔔
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
        >
          {notifications.length === 0 ? (
            <p className="p-2 text-sm text-gray-500">Aucune notification.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {notifications.map((n) => (
                <form key={n.id} action={markNotificationRead}>
                  <input type="hidden" name="notification_id" value={n.id} />
                  <input type="hidden" name="lien" value={n.lien ?? "/cours"} />
                  <button
                    type="submit"
                    role="menuitem"
                    className={`block w-full rounded-md p-2 text-left text-sm hover:bg-gray-50 ${
                      n.lu ? "text-gray-500" : "font-medium text-gray-900"
                    }`}
                  >
                    <span className="block">{n.titre}</span>
                    <span className="block text-xs font-normal text-gray-500">{n.message}</span>
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
