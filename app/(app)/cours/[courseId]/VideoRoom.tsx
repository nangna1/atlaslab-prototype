"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getVideoToken } from "./actions";

type RecordingStatusEvent = { on: boolean; mode?: string; error?: string };

type JitsiApi = {
  dispose: () => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  addEventListener: (event: string, listener: (payload: RecordingStatusEvent) => void) => void;
  removeEventListener: (event: string, listener: (payload: RecordingStatusEvent) => void) => void;
};

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
    ) => JitsiApi;
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

/** Événements échangés sur le canal Realtime "enregistrement-{seanceId}"
 * (broadcast, pas de table : demande éphémère, valable uniquement pendant
 * que professeur et apprenant sont tous deux dans la séance). Demande du
 * 2026-08-19 : le bouton d'enregistrement doit être visible pour tout le
 * monde, mais seul le professeur peut réellement l'activer -- le jeton JaaS
 * d'un apprenant a `features.recording: false` (lib/jaas.ts), donc même en
 * contournant l'UI un apprenant ne peut pas démarrer l'enregistrement
 * lui-même ; ce canal ne sert qu'à transmettre sa demande au professeur. */
type DemandeEnregistrement = { type: "demande"; demandeurId: string; demandeurNom: string };
type ReponseEnregistrement = { type: "reponse"; demandeurId: string; accepte: boolean };

export default function VideoRoom({ seanceId }: { seanceId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);

  const [estModerateur, setEstModerateur] = useState(false);
  const [moi, setMoi] = useState<{ id: string; nom: string } | null>(null);
  const [enregistrementActif, setEnregistrementActif] = useState(false);
  const [erreurEnregistrement, setErreurEnregistrement] = useState<string | null>(null);
  const [demandeRecue, setDemandeRecue] = useState<DemandeEnregistrement | null>(null);
  const [demandeEnvoyee, setDemandeEnvoyee] = useState<"attente" | "refusee" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function join() {
      const result = await getVideoToken(seanceId);

      if ("error" in result) {
        // Repli sur l'ancien embed public si JaaS n'est pas configuré, pour
        // ne pas casser la visio pendant la transition.
        setFallbackSrc(`https://meet.jit.si/atlaslab-${seanceId}#config.prejoinPageEnabled=true`);
        return;
      }
      if (cancelled || !containerRef.current) return;

      setEstModerateur(result.moderator);
      setMoi({ id: result.userId, nom: result.nom });

      try {
        await loadScript(`https://8x8.vc/${result.appId}/external_api.js`);
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;

        const api = new window.JitsiMeetExternalAPI("8x8.vc", {
          roomName: `${result.appId}/${result.roomName}`,
          jwt: result.token,
          parentNode: containerRef.current,
          width: "100%",
          height: "70vh",
        });
        apiRef.current = api;

        api.addEventListener("recordingStatusChanged", (e: RecordingStatusEvent) => {
          if (cancelled) return;
          setEnregistrementActif(e.on);
          setErreurEnregistrement(e.error ?? null);
        });
      } catch {
        if (!cancelled) setError("Impossible de charger la visioconférence.");
      }
    }

    join();

    return () => {
      cancelled = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [seanceId]);

  // Canal de demande/réponse d'enregistrement, actif uniquement une fois
  // qu'on connaît son propre rôle (évite d'émettre en tant qu'apprenant par
  // défaut avant que getVideoToken ait répondu).
  useEffect(() => {
    if (!moi) return;
    const supabase = createClient();
    const canal = supabase
      .channel(`enregistrement-${seanceId}`)
      .on("broadcast", { event: "demande" }, ({ payload }: { payload: DemandeEnregistrement }) => {
        if (estModerateur) setDemandeRecue(payload);
      })
      .on("broadcast", { event: "reponse" }, ({ payload }: { payload: ReponseEnregistrement }) => {
        if (payload.demandeurId !== moi.id) return;
        setDemandeEnvoyee(payload.accepte ? null : "refusee");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [seanceId, moi, estModerateur]);

  function demanderEnregistrement() {
    if (!moi) return;
    setDemandeEnvoyee("attente");
    createClient()
      .channel(`enregistrement-${seanceId}`)
      .send({
        type: "broadcast",
        event: "demande",
        payload: { type: "demande", demandeurId: moi.id, demandeurNom: moi.nom } satisfies DemandeEnregistrement,
      });
  }

  function repondreDemande(accepte: boolean) {
    if (!demandeRecue) return;
    if (accepte) apiRef.current?.executeCommand("startRecording", { mode: "file" });
    createClient()
      .channel(`enregistrement-${seanceId}`)
      .send({
        type: "broadcast",
        event: "reponse",
        payload: { type: "reponse", demandeurId: demandeRecue.demandeurId, accepte } satisfies ReponseEnregistrement,
      });
    setDemandeRecue(null);
  }

  function arreterEnregistrement() {
    apiRef.current?.executeCommand("stopRecording", "file");
  }

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
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {enregistrementActif && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-red-600">
            ● Enregistrement en cours
          </span>
        )}
        {estModerateur ? (
          enregistrementActif && (
            <button type="button" onClick={arreterEnregistrement} className="btn-link text-sm text-red-600">
              Arrêter l&apos;enregistrement
            </button>
          )
        ) : (
          <>
            {!enregistrementActif && demandeEnvoyee !== "attente" && (
              <button type="button" onClick={demanderEnregistrement} className="btn-link text-sm">
                Demander l&apos;enregistrement
              </button>
            )}
            {demandeEnvoyee === "attente" && (
              <span className="text-sm text-gray-500">Demande envoyée, en attente du professeur…</span>
            )}
            {demandeEnvoyee === "refusee" && (
              <span className="text-sm text-gray-500">
                Demande refusée.{" "}
                <button type="button" onClick={demanderEnregistrement} className="btn-link">
                  Redemander
                </button>
              </span>
            )}
          </>
        )}
        {erreurEnregistrement && (
          <span className="text-sm text-red-600">Échec de l&apos;enregistrement : {erreurEnregistrement}</span>
        )}
      </div>
      {estModerateur && demandeRecue && (
        <div
          className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm"
          style={{ borderColor: "var(--line)" }}
        >
          <span>
            <strong>{demandeRecue.demandeurNom}</strong> demande l&apos;autorisation d&apos;enregistrer la séance.
          </span>
          <button type="button" onClick={() => repondreDemande(true)} className="btn-secondary text-xs">
            Accepter
          </button>
          <button type="button" onClick={() => repondreDemande(false)} className="btn-link text-xs text-red-600">
            Refuser
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        className="overflow-hidden rounded-lg border"
        style={{ borderColor: "var(--line)", height: "70vh" }}
      />
    </div>
  );
}
