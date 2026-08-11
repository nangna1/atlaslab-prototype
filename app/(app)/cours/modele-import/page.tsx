import Link from "next/link";
import PrintButton from "./PrintButton";

export const metadata = {
  title: "Modèle de cours pour import IA — AtlasLab",
};

export default function ModeleImportPage() {
  return (
    <main className="page max-w-3xl print:max-w-none print:p-0">
      <header className="mb-8 flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Modèle de cours pour import automatique par IA</h1>
          <p className="mt-1 text-sm text-gray-500">
            Un guide à suivre pour préparer votre document (PDF, photo/scan, Word ou PowerPoint) avant de le
            téléverser dans « Générer un cours avec l&apos;IA ».
          </p>
        </div>
        <PrintButton />
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Comment ça marche</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          Pour un PDF ou une photo/scan, l&apos;IA <strong>lit directement le document</strong> (comme le
          ferait une personne qui le feuillette) — un cours scanné ou photographié fonctionne aussi bien
          qu&apos;un PDF numérique. Pour un Word ou PowerPoint, AtlasLab en extrait d&apos;abord le texte.
          Dans tous les cas, l&apos;IA <strong>reformule</strong> votre contenu en résumé pédagogique (ce
          n&apos;est pas une copie verbatim) — vos notes de cours brutes conviennent donc très bien comme
          source. Le résultat est toujours à relire et corriger après l&apos;import.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">5 règles pour un import fiable</h2>
        <ol className="flex flex-col gap-3 text-sm leading-relaxed text-gray-700">
          <li>
            <strong>1. Des titres en texte, pas seulement en mise en forme.</strong> Écrivez littéralement
            « Module 1 : ... » et « Leçon 1.1 : ... » devant chaque titre. Le gras, les couleurs et la
            taille de police disparaissent à l&apos;extraction — seul le texte brut est lu par l&apos;IA.
          </li>
          <li>
            <strong>2. Tableaux et schémas : ça dépend du format.</strong> Dans un PDF ou une photo/scan,
            l&apos;IA voit vraiment la page — tableaux, schémas et tout élément visuel sont pris en compte.
            Dans un Word ou PowerPoint, seul le texte est extrait : un schéma ou un tableau de valeurs sera
            ignoré, décrivez aussi son contenu en phrases si besoin.
          </li>
          <li>
            <strong>3. Un document raisonnablement court.</strong> Pour un Word ou PowerPoint, seuls les
            ~100 000 premiers caractères sont pris en compte (plusieurs dizaines de pages) — au-delà, la fin
            de votre document est ignorée sans erreur bloquante. Pour un PDF ou une photo/scan, la limite
            réelle est la taille du fichier (20 Mo maximum) plutôt qu&apos;un nombre de caractères. Pour un
            cours plus long que ces limites, scindez-le en plusieurs documents et importez-les comme
            plusieurs cours.
          </li>
          <li>
            <strong>4. Un ordre logique, du premier au dernier module.</strong> L&apos;IA respecte l&apos;ordre
            du document : placez vos modules et leçons dans l&apos;ordre où vous voulez qu&apos;ils
            apparaissent.
          </li>
          <li>
            <strong>5. Un contenu factuel favorise un quiz automatique.</strong> L&apos;IA n&apos;ajoute un
            petit quiz (2 à 4 questions) en fin de module que si le contenu s&apos;y prête clairement
            (définitions, valeurs, faits vérifiables) — sinon elle n&apos;en force pas un artificiellement.
          </li>
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Formats acceptés</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          PDF (.pdf), photo/scan (.jpg, .png, .webp), Word (.docx) ou PowerPoint (.pptx), jusqu&apos;à 20 Mo.
          Les anciens formats binaires (.doc, .ppt) ne sont pas pris en charge.
        </p>
      </section>

      <section className="mb-10 break-inside-avoid-page">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Modèle à reproduire (exemple concret)</h2>
        <p className="mb-3 text-sm text-gray-600">
          Seule la <strong>structure</strong> compte ici, pas le sujet — remplacez le contenu électronique
          ci-dessous par celui de votre propre cours, en gardant le même schéma « Titre → Module → Leçon ».
        </p>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-800">
{`Électronique — Bases des circuits

Module 1 : Les grandeurs électriques de base

Leçon 1.1 : Tension, courant et résistance
La tension (en volts, V) est la différence de potentiel électrique entre deux points
d'un circuit. Le courant (en ampères, A) est le débit de charges électriques qui
circule. La résistance (en ohms, Ω) s'oppose au passage du courant. Ces trois
grandeurs sont liées par la loi d'Ohm.

Leçon 1.2 : La loi d'Ohm
La loi d'Ohm relie tension, courant et résistance : U = R × I. Si on connaît deux de
ces trois grandeurs, on peut calculer la troisième. Par exemple, pour une résistance
de 100 Ω parcourue par un courant de 0,5 A, la tension à ses bornes vaut 50 V.

Module 2 : Les circuits RC

Leçon 2.1 : Charge et décharge d'un condensateur
Un circuit RC combine une résistance et un condensateur. À la mise sous tension, le
condensateur se charge progressivement selon une courbe exponentielle, caractérisée
par la constante de temps τ = R × C. Plus τ est grand, plus la charge est lente.

Leçon 2.2 : Applications pratiques
Les circuits RC servent notamment de filtres (laissent passer certaines fréquences),
de temporisateurs, ou de circuits anti-rebond pour des boutons poussoirs.`}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Après la préparation</h2>
        <p className="text-sm leading-relaxed text-gray-700">
          Enregistrez votre document (PDF, photo/scan, Word ou PowerPoint), puis rendez-vous sur{" "}
          <Link href="/cours" className="text-indigo-600 hover:underline">
            Mes cours
          </Link>{" "}
          → section « Générer un cours avec l&apos;IA » → sélectionnez votre fichier. La génération peut
          prendre jusqu&apos;à une minute ; relisez et corrigez le cours obtenu avant de le publier à vos
          élèves.
        </p>
      </section>

      <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-500">
        Ce guide est généré par AtlasLab pour faciliter la préparation de vos cours.
      </footer>
    </main>
  );
}
