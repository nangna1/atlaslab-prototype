-- Alerte "nouvelle offre correspondant a la filiere" : nouveau type de
-- notification. On retrouve le check constraint existant sur notifications.type
-- dynamiquement (son nom auto-genere par Postgres n'est pas garanti) plutot que
-- de deviner un nom fixe, pour eviter de le laisser en place par erreur et
-- bloquer silencieusement les futures notifications de type nouvelle_offre.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'notifications'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%devoir_note%';

  if con_name is not null then
    execute format('alter table notifications drop constraint %I', con_name);
  end if;
end $$;

alter table notifications
  add constraint notifications_type_check
  check (type in ('devoir_note', 'seance_programmee', 'nouvelle_offre'));
