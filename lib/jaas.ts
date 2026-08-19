import jwt from "jsonwebtoken";

const APP_ID = process.env.JAAS_APP_ID;
const KID = process.env.JAAS_KID;
const PRIVATE_KEY = process.env.JAAS_PRIVATE_KEY;

export function isJaasConfigured(): boolean {
  return !!(APP_ID && KID && PRIVATE_KEY);
}

export function jaasRoomName(seanceId: string): string {
  return `atlaslab-${seanceId}`;
}

/**
 * Jeton JWT signe (RS256) autorisant un utilisateur a rejoindre une seance
 * JaaS avec ou sans droits de moderateur -- evite l'ecran "aucun moderateur"
 * de meet.jit.si (authentification externe impossible en iframe).
 */
export function generateJaasToken({
  seanceId,
  userId,
  nom,
  email,
  moderator,
}: {
  seanceId: string;
  userId: string;
  nom: string;
  email: string | null;
  moderator: boolean;
}): string | null {
  if (!APP_ID || !KID || !PRIVATE_KEY) return null;

  const now = Math.floor(Date.now() / 1000);

  const payload = {
    aud: "jitsi",
    iss: "chat",
    sub: APP_ID,
    room: jaasRoomName(seanceId),
    exp: now + 60 * 60 * 3,
    nbf: now - 10,
    context: {
      user: {
        id: userId,
        name: nom,
        email: email ?? undefined,
        moderator: moderator ? "true" : "false",
      },
      features: {
        livestreaming: false,
        // L'enregistrement est demande par le client (bouton "Demander
        // l'enregistrement" pour un apprenant, cf VideoRoom.tsx), mais ne
        // doit pouvoir etre reellement declenche que par le titulaire du
        // jeton moderateur -- sinon un apprenant pourrait appeler
        // executeCommand('startRecording', ...) directement depuis la
        // console du navigateur en contournant le flux de demande.
        recording: moderator,
        transcription: false,
        "outbound-call": false,
        // Sans ceci, un apprenant pouvait inviter n'importe qui (y compris
        // en dehors de la classe) via le bouton "Inviter" du salon --
        // constate reellement le 2026-08-19. JaaS applique ce flag cote
        // serveur (masque et bloque le bouton pour ce jeton), donc ce n'est
        // pas contournable en modifiant le JS cote client.
        invite: moderator,
      },
    },
  };

  return jwt.sign(payload, PRIVATE_KEY.replace(/\\n/g, "\n"), {
    algorithm: "RS256",
    header: { kid: KID, typ: "JWT", alg: "RS256" },
  });
}
