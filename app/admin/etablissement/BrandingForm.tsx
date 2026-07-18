"use client";

import { useActionState } from "react";
import { updateBranding, type UpdateBrandingState } from "./actions";

const initialState: UpdateBrandingState = {};

const MODELES = [
  { value: "classique", label: "Classique", description: "Cadre bordé, disposition centrée." },
  { value: "moderne", label: "Moderne", description: "Minimal, barre d'accent en haut, aligné à gauche." },
  { value: "sceau", label: "Sceau officiel", description: "Cadre + sceau circulaire dans la couleur de marque." },
] as const;

export default function BrandingForm({
  currentLogoUrl,
  currentColor,
  currentAdresse,
  currentNumeroAgrement,
  currentRepresentantLegal,
  currentCertificatModele,
}: {
  currentLogoUrl: string | null;
  currentColor: string;
  currentAdresse: string;
  currentNumeroAgrement: string;
  currentRepresentantLegal: string;
  currentCertificatModele: string;
}) {
  const [state, formAction, pending] = useActionState(updateBranding, initialState);

  return (
    <form action={formAction} className="card flex max-w-sm flex-col gap-4">
      {currentLogoUrl && (
        <div>
          <span className="label">Logo actuel</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentLogoUrl}
            alt="Logo de l'établissement"
            className="h-16 w-auto rounded border border-gray-200 bg-white p-2"
          />
        </div>
      )}
      <label>
        <span className="label">Nouveau logo (PNG, JPG, SVG)</span>
        <input type="file" name="logo" accept="image/*" className="input" />
      </label>
      <label>
        <span className="label">Couleur de marque</span>
        <input
          type="color"
          name="couleur_primaire"
          defaultValue={currentColor}
          className="h-10 w-16 rounded border border-gray-300"
        />
      </label>

      <hr className="border-gray-200" />
      <p className="text-sm font-medium text-gray-700">Informations légales (certificats)</p>
      <label>
        <span className="label">Adresse</span>
        <input name="adresse" type="text" defaultValue={currentAdresse} className="input" />
      </label>
      <label>
        <span className="label">N° d&apos;agrément / immatriculation</span>
        <input name="numero_agrement" type="text" defaultValue={currentNumeroAgrement} className="input" />
      </label>
      <label>
        <span className="label">Représentant légal</span>
        <input name="representant_legal" type="text" defaultValue={currentRepresentantLegal} className="input" />
      </label>

      <hr className="border-gray-200" />
      <p className="text-sm font-medium text-gray-700">Modèle de certificat</p>
      <div className="flex flex-col gap-2">
        {MODELES.map((modele) => (
          <label key={modele.value} className="flex items-start gap-2">
            <input
              type="radio"
              name="certificat_modele"
              value={modele.value}
              defaultChecked={currentCertificatModele === modele.value}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-gray-900">{modele.label}</span>
              <span className="block text-xs text-gray-500">{modele.description}</span>
            </span>
          </label>
        ))}
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Enregistré.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
