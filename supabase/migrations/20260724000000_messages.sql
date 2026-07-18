-- Messagerie interne : echanger entre professeur et eleve sans sortir de la
-- plateforme. Volontairement restreinte : un eleve ne peut pas contacter un
-- autre eleve (pas de moderation prevue pour ce cas), seulement le staff
-- (professeur/admin_tenant/super_admin) de son etablissement, et le staff
-- peut contacter n'importe qui dans son etablissement.

create table messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  sender_id uuid references users(id) not null,
  recipient_id uuid references users(id) not null,
  contenu text not null,
  lu boolean not null default false,
  created_at timestamptz default now()
);

create index messages_tenant_participants_idx on messages (tenant_id, sender_id, recipient_id, created_at desc);

alter table messages enable row level security;

create policy messages_select on messages
  for select using (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and (sender_id = auth.uid() or recipient_id = auth.uid())
  );

create policy messages_insert on messages
  for insert with check (
    sender_id = auth.uid()
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    and recipient_id in (select id from users where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    and not (
      coalesce(auth.jwt() ->> 'app_role', '') = 'apprenant'
      and recipient_id in (
        select id from users
        where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid and role = 'apprenant'
      )
    )
  );

-- Seul le destinataire peut marquer un message comme lu.
create policy messages_update_lu on messages
  for update using (
    recipient_id = auth.uid()
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  )
  with check (
    recipient_id = auth.uid()
    and tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  );
