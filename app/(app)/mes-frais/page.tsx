import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFraisApplicablesPourEleve } from "@/lib/frais-data";
import { formatMontantCFA } from "@/lib/format";
import { hasTenantCinetPayConfig } from "@/lib/tenant-cinetpay";
import PaierEnLigneButton from "./PaierEnLigneButton";

// Moyens de paiement acceptes par CinetPay (voir lib/cinetpay.ts,
// CHANNEL_MAP) - affiches ici a titre informatif uniquement. Contrairement
// a la maquette, ce ne sont PAS des tuiles selectionnables : CinetPay est
// appele avec channels="ALL" (voir app/(app)/mes-frais/actions.ts,
// initierPaiementEnLigne), le choix du moyen de paiement se fait reellement
// sur la page hebergee CinetPay apres redirection, pas dans cette app -
// construire une grille "selectionnable" qui ne ferait rien aurait ete
// trompeur.
const MOYENS_PAIEMENT = ["Orange Money", "MTN MoMo", "Moov Money", "Wave", "Carte bancaire"];

export default async function MesFraisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("users").select("tenant_id").eq("id", user.id).single();
  const { data: tenant } = profile?.tenant_id
    ? await supabase.from("tenants").select("nom").eq("id", profile.tenant_id).single()
    : { data: null };
  const paiementEnLigneDisponible = profile?.tenant_id
    ? await hasTenantCinetPayConfig(createAdminClient(), profile.tenant_id)
    : false;
  const fraisApplicables = await getFraisApplicablesPourEleve(supabase, user.id);
  const solde = fraisApplicables.reduce((sum, f) => sum + f.reste, 0);
  const aPayer = fraisApplicables.filter((f) => f.reste > 0);
  // Prochaine echeance non soldee, pour le badge d'en-tete - pas de fausse
  // date si tout est paye ou si aucune echeance n'est renseignee.
  const prochaineEcheance = aPayer
    .filter((f) => f.echeance)
    .sort((a, b) => (a.echeance ?? "").localeCompare(b.echeance ?? ""))[0]?.echeance;

  const { data: historique } = await supabase
    .from("paiements_frais")
    .select("id, montant, created_at, frais_scolarite(libelle)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-[1000px] px-10 py-9">
      <h1 className="mb-2 text-[34px] font-extrabold tracking-[-0.03em]">Frais de scolarité</h1>
      <p className="mb-7 text-[15px]" style={{ color: "var(--text-muted)" }}>
        {tenant?.nom ?? ""}
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          <div
            className="flex items-end justify-between gap-5 border-b px-6 py-[22px]"
            style={{ borderColor: "var(--line-3)" }}
          >
            <div>
              <p className="mb-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
                Solde restant
              </p>
              <p className="nowrap text-[34px] font-extrabold tracking-[-0.02em]">{formatMontantCFA(solde)}</p>
            </div>
            {prochaineEcheance && (
              <span
                className="rounded-full px-3 py-1.5 text-xs font-bold"
                style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}
              >
                Échéance {new Date(prochaineEcheance).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </span>
            )}
            {solde === 0 && fraisApplicables.length > 0 && (
              <span className="badge-success">Vous êtes à jour ✅</span>
            )}
          </div>

          {fraisApplicables.length === 0 ? (
            <p className="px-6 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
              Aucun frais applicable à votre profil pour le moment.
            </p>
          ) : (
            fraisApplicables.map((f) => {
              const etat = f.reste === 0 ? "Payée" : "À payer";
              const etatStyle =
                f.reste === 0
                  ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
                  : { background: "var(--warn-bg)", color: "var(--warn-fg)" };
              return (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4"
                  style={{ borderColor: "var(--line-3)" }}
                >
                  <div>
                    <p className="text-[14.5px] font-semibold">{f.libelle}</p>
                    <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-faint)" }}>
                      {f.reste === 0
                        ? `${formatMontantCFA(f.paye)} payé`
                        : f.echeance
                          ? `À payer avant le ${new Date(f.echeance).toLocaleDateString("fr-FR", { dateStyle: "medium" })}`
                          : `${formatMontantCFA(f.paye)} payé / ${formatMontantCFA(f.montant)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3.5">
                    <span className="nowrap text-[15px] font-bold">{formatMontantCFA(f.reste > 0 ? f.reste : f.montant)}</span>
                    <span className="rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={etatStyle}>
                      {etat}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div
          className="rounded-2xl border p-[22px]"
          style={{ background: "linear-gradient(150deg,#173029,#141f1b)", borderColor: "var(--line-accent)" }}
        >
          <h3 className="mb-1.5 text-base font-bold">Payer en ligne</h3>
          <p className="mb-4.5 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            Paiement sécurisé vers le compte marchand de l&apos;établissement.
          </p>

          {!paiementEnLigneDisponible ? (
            <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
              Le paiement en ligne n&apos;est pas encore disponible pour votre établissement.
            </p>
          ) : aPayer.length === 0 ? (
            <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
              Aucun frais à payer pour le moment.
            </p>
          ) : (
            <div className="flex flex-col gap-3 border-b pb-4.5" style={{ borderColor: "var(--line-accent)" }}>
              {aPayer.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 rounded-lg p-3" style={{ background: "var(--surface-2)" }}>
                  <div>
                    <p className="text-[13.5px] font-semibold">{f.libelle}</p>
                    <p className="nowrap text-xs" style={{ color: "var(--text-muted)" }}>
                      {formatMontantCFA(f.reste)}
                    </p>
                  </div>
                  <PaierEnLigneButton fraisId={f.id} />
                </div>
              ))}
            </div>
          )}

          <p className="mt-4.5 mb-2.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            Moyens de paiement acceptés
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {MOYENS_PAIEMENT.map((m) => (
              <div
                key={m}
                className="rounded-[10px] border px-3.5 py-3 text-[13.5px] font-semibold"
                style={{ borderColor: "var(--line-2)", background: "var(--surface-2)", color: "var(--text-2)" }}
              >
                {m}
              </div>
            ))}
          </div>
          <p className="mt-3.5 text-xs leading-[1.5]" style={{ color: "var(--text-faint)" }}>
            Un reçu est envoyé par e-mail et WhatsApp dès la confirmation du paiement.
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Historique de mes paiements</h2>
        {(historique ?? []).length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Aucun paiement enregistré pour le moment.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {(historique ?? []).map((p) => (
              <div key={p.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--text-2)" }}>
                <span className="nowrap">{formatMontantCFA(p.montant)}</span> —{" "}
                {(p.frais_scolarite as unknown as { libelle: string } | null)?.libelle ?? "frais supprimé"} —{" "}
                {new Date(p.created_at).toLocaleDateString("fr-FR")}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
