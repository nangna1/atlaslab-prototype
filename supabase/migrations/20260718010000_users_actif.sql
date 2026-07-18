-- Colonne miroir de l'etat de bannissement Supabase Auth (ban_duration sur
-- auth.users, qui coupe reellement l'acces sans rien supprimer). La lire
-- necessiterait le client service_role a chaque chargement de /admin ; la
-- refleter ici permet de garder la liste des comptes en simple requete via
-- le client de session (RLS deja en place sur users).
alter table users add column actif boolean not null default true;
