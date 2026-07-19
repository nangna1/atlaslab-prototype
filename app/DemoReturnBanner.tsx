"use client";

import { useEffect, useState } from "react";
import { DEMO_RETURN_LINK_KEY } from "@/lib/demo-session";

export default function DemoReturnBanner() {
  const [returnLink, setReturnLink] = useState<string | null>(null);

  useEffect(() => {
    setReturnLink(sessionStorage.getItem(DEMO_RETURN_LINK_KEY));
  }, []);

  if (!returnLink) return null;

  return (
    <div
      role="status"
      className="flex w-full items-center justify-center gap-3 px-4 py-2 text-center text-sm font-medium"
      style={{ background: "#6d28d9", color: "#fff" }}
    >
      🎭 Vous consultez AtlasLab avec le compte d&apos;un autre utilisateur.
      <button
        type="button"
        onClick={() => {
          sessionStorage.removeItem(DEMO_RETURN_LINK_KEY);
          window.location.href = returnLink;
        }}
        className="underline"
      >
        Revenir à mon compte
      </button>
    </div>
  );
}
