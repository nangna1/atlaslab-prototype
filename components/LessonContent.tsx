import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// contenu_markdown (genere par l'IA depuis un document reel, voir
// app/(app)/cours/actions.ts:COURSE_STRUCTURE_TOOL, ou tape a la main par
// un professeur) etait jusqu'ici affiche tel quel en texte brut partout
// (lesson viewer + vue imprimable) : le gras (**...**) et les tableaux
// markdown (frequents dans un resume genere depuis un cours technique -
// ex. "Types de dalles...", constate reellement le 2026-08-18) restaient
// litteraux au lieu de se mettre en forme. remark-gfm pour les tableaux
// (syntaxe GitHub-Flavored Markdown, pas standard sans lui).
//
// Ce que ce composant NE peut PAS faire : les figures/schemas du document
// source. L'IA lit le PDF nativement mais ne produit qu'un texte (voir la
// description du champ dans COURSE_STRUCTURE_TOOL) - aucune image n'est
// extraite ni reinseree, une limite structurelle de la generation
// actuelle, pas quelque chose que ce composant de rendu pourrait resoudre.
export default function LessonContent({ markdown }: { markdown: string }) {
  return (
    <div className="lesson-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // AtlasLab est mobile-first (voir README) : un tableau technique
          // (coefficients, dimensions...) depasse facilement la largeur d'un
          // ecran de telephone - scroll horizontal propre au tableau plutot
          // que de faire deborder toute la page.
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full">{children}</table>
            </div>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
