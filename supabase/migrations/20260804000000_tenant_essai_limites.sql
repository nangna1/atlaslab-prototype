-- Application du plan 'essai' : duree (30 jours depuis la creation du
-- tenant) ET nombre de comptes apprenant+professeur (30 max, admin_tenant/
-- parent non comptes). Une fois l'une des deux limites atteinte, plus aucun
-- NOUVEAU compte apprenant/professeur ne peut etre cree pour ce tenant --
-- les comptes existants restent pleinement accessibles, rien n'est coupe
-- pour les utilisateurs deja inscrits. Un super_admin fait passer un tenant
-- hors de 'essai' manuellement (aucun moyen de paiement en ligne pour
-- l'instant, voir app/admin/etablissements/actions.ts) pour lever la
-- limite.
--
-- RLS = la vraie barriere (meme philosophie que 20260717050000_users_write_restricted_to_admin.sql) :
-- un pre-check applicatif (lib/tenant-plan.ts) donne un message clair AVANT
-- meme de creer le compte auth, pour ne jamais laisser un compte auth.users
-- orphelin si l'insertion public.users est ensuite bloquee ici -- mais cette
-- policy reste la barriere reelle si l'API Supabase est appelee directement.
drop policy tenant_isolation_users_insert on users;

create policy tenant_isolation_users_insert on users
  for insert
  with check (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and coalesce(auth.jwt() ->> 'app_role', '') in ('admin_tenant', 'super_admin')
    and (
      role not in ('apprenant', 'professeur')
      or not exists (
        select 1 from tenants t
        where t.id = tenant_id
          and t.plan = 'essai'
          and (
            t.created_at < now() - interval '30 days'
            or (
              select count(*) from users u2
              where u2.tenant_id = t.id and u2.role in ('apprenant', 'professeur')
            ) >= 30
          )
      )
    )
  );
