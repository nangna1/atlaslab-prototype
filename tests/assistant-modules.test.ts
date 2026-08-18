import { describe, it, expect } from "vitest";
import { matchModule } from "../lib/assistant-modules";

// Fonction pure, pas de dependance Supabase -- contrairement au reste de
// tests/ (RLS/rate-limit contre le vrai projet), ce fichier ne touche pas
// le reseau.
describe("matchModule (lib/assistant-modules.ts)", () => {
  it("distingue une lecon d'une page de cours", () => {
    expect(matchModule("/cours/abc-123/lecons/xyz-789").title).toBe("Lecon");
    expect(matchModule("/cours/abc-123").title).toBe("Page d'un cours");
    expect(matchModule("/cours/abc-123/").title).toBe("Page d'un cours");
  });

  it("distingue bulletin, certificat et impression d'un cours donne", () => {
    expect(matchModule("/cours/abc-123/bulletin").title).toBe("Bulletin de notes");
    expect(matchModule("/cours/abc-123/certificat").title).toBe("Certificat de fin de cours");
    expect(matchModule("/cours/abc-123/imprimer").title).toBe("Export PDF du cours");
  });

  it("priorise le modele d'import sur la liste des cours generique", () => {
    expect(matchModule("/cours/modele-import").title).toBe("Import de cours par IA");
  });

  it("reconnait la liste des cours", () => {
    expect(matchModule("/cours").title).toBe("Liste des cours");
  });

  it("priorise les sous-routes admin specifiques sur le fallback /admin", () => {
    expect(matchModule("/admin/etablissements").title).toBe("Gestion des etablissements");
    expect(matchModule("/admin/etablissement").title).toBe("Personnaliser mon etablissement");
    expect(matchModule("/admin/frais-scolarite").title).toBe("Frais de scolarite (gestion)");
    expect(matchModule("/admin").title).toBe("Comptes & administration");
  });

  it("reconnait les routes simples", () => {
    expect(matchModule("/emploi-du-temps").title).toBe("Emploi du temps");
    expect(matchModule("/messages").title).toBe("Messagerie");
    expect(matchModule("/messages/some-user-id").title).toBe("Messagerie");
    expect(matchModule("/portail-parent/enfant-id").title).toBe("Portail parent");
  });

  it("retombe sur AtlasLab generique pour une route inconnue", () => {
    expect(matchModule("/une-route-qui-nexiste-pas").title).toBe("AtlasLab");
  });
});
