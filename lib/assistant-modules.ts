// Associe une route AtlasLab au module/fonctionnalite qu'elle represente,
// pour que l'assistant IA (app/AiAssistant.tsx) sache de quoi parler sans que
// l'utilisateur ait a le preciser. Fonction pure, sans dependance serveur --
// utilisee cote client (usePathname()) donc pas d'import next/headers ici.

export type ModuleContext = { title: string; description: string };

const FALLBACK: ModuleContext = {
  title: "AtlasLab",
  description: "Aucune page specifique detectee : question generale sur la plateforme.",
};

// Sous-routes de /cours/{courseId}/... : l'id du cours est dynamique, donc
// verifiees par regex plutot que par simple prefixe.
const COURSE_SUBROUTES: { test: RegExp; context: ModuleContext }[] = [
  {
    test: /^\/cours\/[^/]+\/lecons\/[^/]+/,
    context: {
      title: "Lecon",
      description:
        "Une lecon d'un cours : contenu (texte/PDF), laboratoire electronique (simulation SPICE) ou logique " +
        "(CircuitVerse), devoir a rendre, ou quiz note.",
    },
  },
  {
    test: /^\/cours\/[^/]+\/bulletin/,
    context: {
      title: "Bulletin de notes",
      description: "Bulletin consolide d'un eleve pour un cours : notes de quiz et devoirs, progression.",
    },
  },
  {
    test: /^\/cours\/[^/]+\/certificat/,
    context: {
      title: "Certificat de fin de cours",
      description: "Generation du certificat de fin de cours, verifiable publiquement par QR code.",
    },
  },
  {
    test: /^\/cours\/[^/]+\/imprimer/,
    context: {
      title: "Export PDF du cours",
      description: "Version imprimable/hors-ligne complete d'un cours (toutes les lecons).",
    },
  },
  {
    test: /^\/cours\/[^/]+\/?$/,
    context: {
      title: "Page d'un cours",
      description: "Modules et lecons d'un cours, inscription, seances en direct, presence.",
    },
  },
];

// Routes fixes, comparees par prefixe. La plus specifique doit precede sa
// parente (ex. "/admin/etablissements" avant "/admin").
const RULES: { prefix: string; context: ModuleContext }[] = [
  {
    prefix: "/cours",
    context: {
      title: "Liste des cours",
      description: "Liste des cours de l'etablissement, creation/import de cours.",
    },
  },
  {
    prefix: "/emploi-du-temps",
    context: {
      title: "Emploi du temps",
      description:
        "Creneaux hebdomadaires recurrents par cours, vue agregee par role, alerte de conflit horaire/salle.",
    },
  },
  {
    prefix: "/messages",
    context: {
      title: "Messagerie",
      description: "Messagerie interne entre professeur et eleve, avec notifications in-app, email et WhatsApp.",
    },
  },
  {
    prefix: "/mes-frais",
    context: {
      title: "Frais de scolarite",
      description:
        "Suivi des frais de scolarite et paiement en ligne (Orange Money, MTN Money, Moov Money, Wave, carte via CinetPay).",
    },
  },
  {
    prefix: "/portail-parent",
    context: {
      title: "Portail parent",
      description: "Espace parent en lecture seule : notes, absences et frais de son enfant.",
    },
  },
  {
    prefix: "/profil",
    context: { title: "Profil", description: "Informations du compte utilisateur." },
  },
  {
    prefix: "/securite",
    context: {
      title: "Securite du compte",
      description: "Authentification a deux facteurs (TOTP) et changement de mot de passe.",
    },
  },
  {
    prefix: "/verifier",
    context: {
      title: "Verification de certificat",
      description: "Verification publique d'un certificat AtlasLab a partir de son code/QR.",
    },
  },
  {
    prefix: "/admin/tableau-de-bord",
    context: {
      title: "Tableau de bord etablissement",
      description: "Suivi journalier/hebdomadaire de l'etablissement, export CSV.",
    },
  },
  {
    prefix: "/admin/rapport-impact",
    context: { title: "Rapport d'impact", description: "Rapport d'impact exportable de l'etablissement." },
  },
  {
    prefix: "/admin/decrochage",
    context: { title: "Alerte de decrochage", description: "Detection des eleves inactifs (decrochage)." },
  },
  {
    prefix: "/admin/audit",
    context: {
      title: "Historique d'audit",
      description: "Historique d'audit : qui a fait quoi et quand sur l'etablissement.",
    },
  },
  {
    prefix: "/admin/insertion-professionnelle",
    context: {
      title: "Insertion professionnelle",
      description: "Suivi d'insertion professionnelle des diplomes.",
    },
  },
  {
    prefix: "/admin/offres",
    context: {
      title: "Bourse aux stages/emplois (gestion)",
      description: "Gestion des offres de stages/emplois avec alerte par filiere.",
    },
  },
  {
    prefix: "/admin/liens-parents",
    context: {
      title: "Liens parents-eleves",
      description: "Association des comptes parents a leurs enfants.",
    },
  },
  {
    prefix: "/admin/frais-scolarite",
    context: {
      title: "Frais de scolarite (gestion)",
      description: "Suivi manuel des frais de scolarite par le staff.",
    },
  },
  {
    prefix: "/admin/paiements",
    context: {
      title: "Paiements",
      description: "Suivi des paiements en ligne (CinetPay) de l'etablissement.",
    },
  },
  {
    prefix: "/admin/etablissements",
    context: {
      title: "Gestion des etablissements",
      description: "Provisioning multi-etablissement, reserve au super_admin.",
    },
  },
  {
    prefix: "/admin/etablissement",
    context: {
      title: "Personnaliser mon etablissement",
      description: "Logo, couleur de marque, informations legales, modele de certificat, identifiants CinetPay.",
    },
  },
  {
    prefix: "/admin",
    context: {
      title: "Comptes & administration",
      description:
        "Creation de comptes (unitaire ou import CSV), recherche/filtre par nom/email/role, desactivation, " +
        "'Se connecter en tant que'.",
    },
  },
  {
    prefix: "/inscription-etablissement",
    context: {
      title: "Inscription d'un etablissement",
      description: "Demande publique de creation d'un etablissement sur AtlasLab, sous approbation.",
    },
  },
];

export function matchModule(pathname: string): ModuleContext {
  // Verifiee avant COURSE_SUBROUTES : sinon "/cours/modele-import" matche
  // par erreur le regex generique "page d'un cours" (/cours/{id}), qui
  // prendrait "modele-import" pour un identifiant de cours.
  if (pathname === "/cours/modele-import" || pathname.startsWith("/cours/modele-import/")) {
    return {
      title: "Import de cours par IA",
      description:
        "Import d'un cours a partir d'un document existant (PDF/Word/PPT) ou de la bibliotheque AtlasLab : " +
        "l'IA structure le document en modules et lecons.",
    };
  }

  for (const { test, context } of COURSE_SUBROUTES) {
    if (test.test(pathname)) return context;
  }
  for (const { prefix, context } of RULES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?")) {
      return context;
    }
  }
  return FALLBACK;
}
