-- Reception de devoirs par WhatsApp : un eleve sans acces fiable a
-- l'application peut envoyer la photo de son devoir directement au numero
-- WhatsApp d'AtlasLab. Etat de conversation minimal (le webhook est
-- stateless entre deux requetes, contrairement a ArtiBot BTP qui persiste
-- sur disque) -- juste de quoi savoir "en attente de photo pour quel
-- devoir" quand plusieurs devoirs sont en attente en meme temps pour le
-- meme eleve. Jamais expose via l'API publique : seul le webhook (client
-- service_role) y touche.
create table whatsapp_devoir_attente (
  telephone text primary key,
  user_id uuid references users(id) not null,
  assignment_ids uuid[] not null,
  selected_assignment_id uuid,
  updated_at timestamptz not null default now()
);
alter table whatsapp_devoir_attente enable row level security;

insert into storage.buckets (id, name, public) values ('devoirs-soumissions', 'devoirs-soumissions', true);

create policy "Documents de devoir publics en lecture" on storage.objects
  for select using (bucket_id = 'devoirs-soumissions');
