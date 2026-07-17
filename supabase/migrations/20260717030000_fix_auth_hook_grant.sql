-- Corrige un oubli de 20260717010000_auth_hook.sql : la policy RLS "Allow auth
-- admin to read users for claims" ne suffit pas à elle seule. Postgres vérifie
-- le GRANT au niveau table AVANT les policies RLS, donc sans ce GRANT SELECT
-- explicite, custom_access_token_hook échoue avec "permission denied for table
-- users" à chaque connexion — ce qui remonte côté client comme une erreur
-- opaque (message vide "{}") au lieu d'un vrai message d'erreur.
grant select on public.users to supabase_auth_admin;
