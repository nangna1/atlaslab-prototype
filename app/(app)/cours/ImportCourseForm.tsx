"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { importCourse, generateCourseFromDocument, type ImportCourseState, type GenerateCourseState } from "./actions";
import { COURSE_TEMPLATES } from "@/lib/course-templates";
import { MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES, MAX_PDF_PAGES, formatFileSize } from "@/lib/document-limits";

const initialState: ImportCourseState = {};
const initialGenerateState: GenerateCourseState = {};

export default function ImportCourseForm() {
  const [state, formAction, pending] = useActionState(importCourse, initialState);
  const [genState, genFormAction, genPending] = useActionState(generateCourseFromDocument, initialGenerateState);
  // Verification de la taille au choix du fichier, avant tout envoi : un
  // fichier au-dela du plafond de body des Server Actions Next.js (voir
  // lib/document-limits.ts) ne produit pas une erreur propre renvoyee par
  // generateCourseFromDocument mais un ecran generique "Application error"
  // cote client, le framework rejetant la requete avant meme d'atteindre
  // l'action. La seule parade fiable est d'empecher l'envoi en amont.
  const [sizeError, setSizeError] = useState<string | null>(null);

  function handleDocumentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setSizeError(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSizeError(`Document trop volumineux (${formatFileSize(file.size)}) — ${MAX_FILE_SIZE_MB} Mo maximum.`);
      e.target.value = "";
    } else {
      setSizeError(null);
    }
  }

  return (
    <div className="card-dashed flex flex-col gap-4">
      <p className="text-sm font-medium text-gray-700">Importer un cours</p>

      <div className="flex flex-col gap-2">
        {COURSE_TEMPLATES.map((template) => (
          <form key={template.id} action={formAction} className="flex items-center justify-between gap-2">
            <input type="hidden" name="template_id" value={template.id} />
            <span className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">{template.titre}</span> — {template.description}
            </span>
            <button type="submit" disabled={pending} className="btn-secondary btn-sm shrink-0">
              Utiliser ce modèle
            </button>
          </form>
        ))}
      </div>

      <hr className="border-gray-200" />

      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input name="file" type="file" accept=".json,application/json" required className="input w-auto flex-1" />
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? "Import..." : "Importer le fichier JSON"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <hr className="border-gray-200" />

      <div>
        <p className="text-sm font-medium text-gray-700">Générer un cours avec l&apos;IA</p>
        <p className="mt-1 text-xs text-gray-500">
          À partir d&apos;un document déjà préparé (PDF, photo/scan JPG ou PNG, Word .docx ou PowerPoint
          .pptx — {MAX_FILE_SIZE_MB} Mo et {MAX_PDF_PAGES} pages maximum pour un PDF) — l&apos;IA le découpe en
          modules et leçons. Les PDF et images sont lus directement par l&apos;IA (fonctionne aussi sur un cours
          scanné ou photographié, pas besoin de texte numérique). Résultat à relire et corriger après import.{" "}
          <Link href="/cours/modele-import" className="text-indigo-600 hover:underline">
            Voir un modèle de document à reproduire
          </Link>
          .
        </p>
      </div>
      <form action={genFormAction} className="flex flex-wrap items-center gap-2">
        <input
          name="document"
          type="file"
          accept=".pdf,.docx,.pptx,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          required
          onChange={handleDocumentChange}
          className="input w-auto flex-1"
        />
        <button type="submit" disabled={genPending || !!sizeError} className="btn-secondary">
          {genPending ? "Génération... (peut prendre une minute)" : "Générer le cours"}
        </button>
      </form>

      {sizeError && <p className="text-sm text-red-600">{sizeError}</p>}
      {genState.error && <p className="text-sm text-red-600">{genState.error}</p>}
    </div>
  );
}
