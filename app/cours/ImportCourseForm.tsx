"use client";

import { useActionState } from "react";
import { importCourse, type ImportCourseState } from "./actions";
import { COURSE_TEMPLATES } from "@/lib/course-templates";

const initialState: ImportCourseState = {};

export default function ImportCourseForm() {
  const [state, formAction, pending] = useActionState(importCourse, initialState);

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
          {pending ? "Import..." : "Importer le fichier"}
        </button>
      </form>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </div>
  );
}
