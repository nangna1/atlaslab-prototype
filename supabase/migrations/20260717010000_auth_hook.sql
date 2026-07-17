-- Custom Access Token Hook : injecte tenant_id et role dans le JWT à la connexion.
-- Nécessaire pour que les policies RLS de 20260717000000_init.sql
-- (auth.jwt() ->> 'tenant_id') fonctionnent, puisque Supabase Auth
-- n'a par défaut aucune notion de tenant.
--
-- Cette fonction seule ne suffit pas : elle doit aussi être activée dans
-- Supabase Dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims"
-- (sélectionner public.custom_access_token_hook). Impossible à faire par migration SQL,
-- c'est une action manuelle côté dashboard.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  user_tenant_id uuid;
  user_role text;
begin
  select tenant_id, role into user_tenant_id, user_role
  from public.users
  where id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if user_tenant_id is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(user_tenant_id::text));
  end if;

  -- Ne PAS utiliser la clé "role" : PostgREST l'utilise pour faire
  -- SET ROLE côté Postgres (bascule anon/authenticated/service_role).
  -- Une claim "role" custom écrase cette valeur réservée et casse toutes
  -- les requêtes ("role \"professeur\" does not exist", code 22023).
  if user_role is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- Le hook s'exécute en tant que rôle supabase_auth_admin, distinct des rôles
-- authenticated/anon soumis aux policies tenant_isolation_* : il a besoin de
-- sa propre autorisation de lecture sur users pour résoudre tenant_id/role.
create policy "Allow auth admin to read users for claims" on public.users
  as permissive for select
  to supabase_auth_admin
  using (true);
