"use client";

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary print:hidden">
      Imprimer / Enregistrer en PDF
    </button>
  );
}
