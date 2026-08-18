-- Historique de conversation de l'assistant IA d'aide a l'utilisation
-- (bouton flottant, voir app/AiAssistant.tsx + app/api/assistant/route.ts).
-- Un utilisateur ne voit et n'ecrit que ses propres messages -- pas de
-- partage entre utilisateurs, contrairement a `messages` (messagerie
-- interne professeur/eleve). module_title garde une trace du contexte au
-- moment du message (page ou l'utilisateur se trouvait), utile pour
-- comprendre l'historique mais jamais utilise pour filtrer l'acces.
--
-- tenant_id nullable et compare avec le meme garde-fou que audit_log
-- (20260723000000) : un super_admin a tenant_id NULL en base et en JWT, et
-- NULL = NULL n'est jamais vrai en SQL -- sans le "or (... is null and ...
-- is null)" ci-dessous, un super_admin serait bloque hors RLS des sa
-- premiere utilisation de l'assistant (meme bug que 20260717100000/110000).

create table assistant_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  user_id uuid references users(id) not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  module_title text,
  created_at timestamptz default now()
);

create index assistant_messages_user_idx on assistant_messages (user_id, created_at);

alter table assistant_messages enable row level security;

create policy assistant_messages_select on assistant_messages
  for select using (
    user_id = auth.uid()
    and (
      tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      or (tenant_id is null and auth.jwt() ->> 'tenant_id' is null)
    )
  );

create policy assistant_messages_insert on assistant_messages
  for insert with check (
    user_id = auth.uid()
    and (
      tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      or (tenant_id is null and auth.jwt() ->> 'tenant_id' is null)
    )
  );

-- Permet le bouton "Effacer la conversation" cote client.
create policy assistant_messages_delete on assistant_messages
  for delete using (
    user_id = auth.uid()
    and (
      tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      or (tenant_id is null and auth.jwt() ->> 'tenant_id' is null)
    )
  );
