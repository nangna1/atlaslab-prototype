create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  type text not null check (type in ('devoir_note', 'seance_programmee')),
  titre text not null,
  message text not null,
  lien text,
  lu boolean not null default false,
  created_at timestamptz default now()
);
alter table notifications enable row level security;

create policy notifications_select on notifications
  for select using (user_id = auth.uid());

create policy notifications_update on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Le staff insere des notifications pour des destinataires de son propre tenant (l'appelant
-- n'est jamais le destinataire ici) -- meme pattern que les policies d'ecriture staff
-- existantes (ex. attendance_insert), verifie via users.tenant_id plutot que user_id = auth.uid().
create policy notifications_insert on notifications
  for insert with check (
    coalesce(auth.jwt() ->> 'app_role', '') in ('professeur', 'admin_tenant', 'super_admin')
    and user_id in (select id from users where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );
