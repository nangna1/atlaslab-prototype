"use client";

import { useEffect, useRef, useState } from "react";
import { getVideoToken } from "./actions";

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: {
        roomName: string;
        jwt?: string;
        parentNode: HTMLElement;
        width: string;
        height: string;
      },
    ) => { dispose: () => void };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Échec de chargement du script visio."));
    document.body.appendChild(script);
  });
}

export default function VideoRoom({ seanceId }: { seanceId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let api: { dispose: () => void } | null = null;

    async function join() {
      const result = await getVideoToken(seanceId);

      if ("error" in result) {
        // Repli sur l'ancien embed public si JaaS n'est pas configuré, pour
        // ne pas casser la visio pendant la transition.
        setFallbackSrc(`https://meet.jit.si/atlaslab-${seanceId}#config.prejoinPageEnabled=true`);
        return;
      }
      if (cancelled || !containerRef.current) return;

      try {
        await loadScript(`https://8x8.vc/${result.appId}/external_api.js`);
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;

        api = new window.JitsiMeetExternalAPI("8x8.vc", {
          roomName: `${result.appId}/${result.roomName}`,
          jwt: result.token,
          parentNode: containerRef.current,
          width: "100%",
          height: "70vh",
        });
      } catch {
        if (!cancelled) setError("Impossible de charger la visioconférence.");
      }
    }

    join();

    return () => {
      cancelled = true;
      api?.dispose();
    };
  }, [seanceId]);

  if (error) {
    return <p className="mt-3 text-sm text-red-600">{error}</p>;
  }

  if (fallbackSrc) {
    return (
      <div className="mt-3 overflow-hidden rounded-lg border" style={{ borderColor: "var(--line)" }}>
        <iframe
          src={fallbackSrc}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{ width: "100%", height: "70vh", border: "none" }}
          title="Salle de visioconférence"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mt-3 overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--line)", height: "70vh" }}
    />
  );
}
