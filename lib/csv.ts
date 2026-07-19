export type ParsedAccountRow = {
  nom: string;
  email: string;
  role: "professeur" | "apprenant";
  motDePasse?: string;
  telephone?: string;
};

export type CsvParseError = { line: number; message: string };

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseAccountsCsv(text: string): {
  rows: ParsedAccountRow[];
  errors: CsvParseError[];
} {
  const lines = text.split(/\r\n|\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, message: "Fichier vide." }] };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const nomIdx = header.findIndex((h) => ["nom", "name"].includes(h));
  const emailIdx = header.findIndex((h) => h === "email");
  const roleIdx = header.findIndex((h) => ["role", "rôle"].includes(h));
  const passwordIdx = header.findIndex((h) => ["mot_de_passe", "password"].includes(h));
  const telephoneIdx = header.findIndex((h) => ["telephone", "téléphone", "phone"].includes(h));

  if (nomIdx === -1 || emailIdx === -1) {
    return {
      rows: [],
      errors: [{ line: 1, message: "Colonnes requises manquantes : nom, email." }],
    };
  }

  const rows: ParsedAccountRow[] = [];
  const errors: CsvParseError[] = [];
  const seenEmails = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    const nom = fields[nomIdx]?.trim();
    const email = fields[emailIdx]?.trim().toLowerCase();
    const roleRaw = roleIdx >= 0 ? fields[roleIdx]?.trim().toLowerCase() : "";
    const motDePasse = passwordIdx >= 0 ? fields[passwordIdx]?.trim() : "";
    const telephone = telephoneIdx >= 0 ? fields[telephoneIdx]?.trim() : "";

    if (!nom || !email) {
      errors.push({ line: i + 1, message: "Nom ou email manquant." });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ line: i + 1, message: `Email invalide : ${email}` });
      continue;
    }
    if (seenEmails.has(email)) {
      errors.push({ line: i + 1, message: `Email en double dans le fichier : ${email}` });
      continue;
    }
    seenEmails.add(email);

    if (roleRaw && !["professeur", "apprenant"].includes(roleRaw)) {
      errors.push({
        line: i + 1,
        message: `Rôle "${roleRaw}" inconnu — "apprenant" utilisé par défaut pour ${email}.`,
      });
    }
    const role = roleRaw === "professeur" ? "professeur" : "apprenant";

    rows.push({ nom, email, role, motDePasse: motDePasse || undefined, telephone: telephone || undefined });
  }

  return { rows, errors };
}
