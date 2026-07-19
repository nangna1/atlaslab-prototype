"use client";

import { useEffect, useState } from "react";

export default function OfflineStatusBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="w-full px-4 py-2 text-center text-sm font-medium"
      style={{ background: "var(--brand)", color: "#fff" }}
    >
      Vous êtes hors-ligne — les leçons déjà consultées restent disponibles. Les actions qui
      nécessitent une connexion (rendre un devoir, envoyer un message…) attendront le retour du
      réseau.
    </div>
  );
}
