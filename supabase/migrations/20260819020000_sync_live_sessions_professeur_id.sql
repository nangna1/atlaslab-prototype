-- Empeche la regression constatee le 2026-08-19 : reattribuer un cours a un
-- autre professeur (courses.professeur_id) ne mettait pas a jour les
-- live_sessions deja creees pour ce cours -- celles-ci gardaient
-- l'ancien professeur_id (ou NULL), si bien que DocumentPartage.tsx
-- (estProfesseurTitulaire = seance.professeur_id === user.id) et
-- l'enregistrement (VideoRoom.tsx, estModerateur derive de meme logique
-- cote serveur) restaient invisibles pour le nouveau titulaire.
create or replace function sync_live_sessions_professeur_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.professeur_id is distinct from old.professeur_id then
    update live_sessions
    set professeur_id = new.professeur_id
    where course_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_live_sessions_professeur_id on courses;
create trigger trg_sync_live_sessions_professeur_id
  after update of professeur_id on courses
  for each row
  execute function sync_live_sessions_professeur_id();
