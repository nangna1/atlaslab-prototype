type Tenant = {
  nom: string | null;
  logo_url: string | null;
  couleur_primaire: string | null;
  adresse: string | null;
  numero_agrement: string | null;
  representant_legal: string | null;
  certificat_modele: string;
};

function MentionsLegales({ tenant }: { tenant: Tenant }) {
  const parts = [
    tenant.adresse,
    tenant.numero_agrement ? `N° d'agrément : ${tenant.numero_agrement}` : null,
    tenant.representant_legal ? `Représentant légal : ${tenant.representant_legal}` : null,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return <p className="mt-2 text-xs text-gray-400">{parts.join(" — ")}</p>;
}

function VerificationQr({ qrCodeDataUrl }: { qrCodeDataUrl: string | null }) {
  if (!qrCodeDataUrl) return null;
  return (
    <div className="mt-4 flex flex-col items-center gap-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrCodeDataUrl} alt="QR code de vérification" className="h-16 w-16" />
      <p className="text-[10px] text-gray-400">Scanner pour vérifier ce certificat</p>
    </div>
  );
}

function Seal() {
  return (
    <svg viewBox="0 0 100 100" className="h-20 w-20" aria-hidden>
      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--brand)" strokeWidth="3" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="var(--brand)" strokeWidth="1.5" />
      <path
        d="M35 52 L46 63 L67 40"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function CertificateTemplate({
  tenant,
  eleveNom,
  courseTitre,
  dateObtention,
  qrCodeDataUrl = null,
}: {
  tenant: Tenant;
  eleveNom: string;
  courseTitre: string;
  dateObtention: string;
  qrCodeDataUrl?: string | null;
}) {
  const dateLabel = new Date(dateObtention).toLocaleDateString("fr-FR", { dateStyle: "long" });

  const logo = tenant.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={tenant.logo_url} alt={tenant.nom ?? ""} className="h-16 w-auto" />
  ) : (
    <p className="text-sm font-medium text-gray-500">{tenant.nom}</p>
  );

  if (tenant.certificat_modele === "moderne") {
    return (
      <div
        className="border-t-4 p-12 text-left print:border-t-0"
        style={{ borderColor: "var(--brand)" }}
      >
        {logo}
        <p className="mt-8 text-xs tracking-widest text-gray-400 uppercase">Certificat de réussite</p>
        <h1 className="mt-2 text-3xl font-semibold text-gray-900">{eleveNom}</h1>
        <p className="mt-3 text-sm text-gray-600">a complété avec succès le cours</p>
        <h2 className="text-xl font-medium text-gray-900">{courseTitre}</h2>
        <p className="mt-6 text-sm text-gray-500">Délivré le {dateLabel}</p>
        {tenant.nom && <p className="text-sm text-gray-500">{tenant.nom}</p>}
        <MentionsLegales tenant={tenant} />
        <VerificationQr qrCodeDataUrl={qrCodeDataUrl} />
      </div>
    );
  }

  if (tenant.certificat_modele === "sceau") {
    return (
      <div
        className="relative flex flex-col items-center gap-4 rounded-lg border-4 p-12 text-center print:border-0"
        style={{ borderColor: "var(--brand)" }}
      >
        {logo}
        <p className="text-sm tracking-widest text-gray-500 uppercase">Certificat de réussite</p>
        <p className="text-sm text-gray-600">Ce certificat est décerné à</p>
        <h1 className="text-3xl font-semibold text-gray-900">{eleveNom}</h1>
        <p className="text-sm text-gray-600">pour avoir complété avec succès le cours</p>
        <h2 className="text-xl font-medium text-gray-900">{courseTitre}</h2>
        <div className="mt-4 flex w-full items-end justify-between px-4">
          <div className="text-left">
            <p className="text-sm text-gray-500">Délivré le {dateLabel}</p>
            {tenant.nom && <p className="text-sm text-gray-500">{tenant.nom}</p>}
          </div>
          <Seal />
        </div>
        <MentionsLegales tenant={tenant} />
        <VerificationQr qrCodeDataUrl={qrCodeDataUrl} />
      </div>
    );
  }

  // classique (par défaut)
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-lg border-4 p-12 text-center print:border-0"
      style={{ borderColor: "var(--brand)" }}
    >
      {logo}
      <p className="text-sm tracking-widest text-gray-500 uppercase">Certificat de réussite</p>
      <p className="text-sm text-gray-600">Ce certificat est décerné à</p>
      <h1 className="text-3xl font-semibold text-gray-900">{eleveNom}</h1>
      <p className="text-sm text-gray-600">pour avoir complété avec succès le cours</p>
      <h2 className="text-xl font-medium text-gray-900">{courseTitre}</h2>
      <p className="mt-4 text-sm text-gray-500">Délivré le {dateLabel}</p>
      {tenant.nom && <p className="text-sm text-gray-500">{tenant.nom}</p>}
      <MentionsLegales tenant={tenant} />
      <VerificationQr qrCodeDataUrl={qrCodeDataUrl} />
    </div>
  );
}
