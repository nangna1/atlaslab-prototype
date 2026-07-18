"use client";

import { useActionState } from "react";
import { updateBranding, type UpdateBrandingState } from "./actions";

const initialState: UpdateBrandingState = {};

export default function BrandingForm({
  currentLogoUrl,
  currentColor,
}: {
  currentLogoUrl: string | null;
  currentColor: string;
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
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Enregistré.</p>}
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
