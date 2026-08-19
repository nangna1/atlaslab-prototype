-- Partage de document pendant une seance en direct (2026-08-19, demande
-- utilisateur : "permettre au professeur l'ajout d'un fichier PDF/image
-- pendant le direct, visible sur l'ecran de tous les apprenants, defilement
-- controle par le professeur"). Perimetre PDF + images uniquement (voir
-- lib/live-document-limits.ts) : Word/Excel/PowerPoint n'ont pas de rendu
-- visuel fiable sans service de conversion tiers payant sur une plateforme
-- serverless (Vercel) - le professeur convertit en PDF avant de televerser.
--
-- Un seul document "actif" par seance (pas un historique de tous les
-- documents partages) : upsert sur live_session_id, jamais un nouvel
-- insert par partage. Chaque page du PDF est rendue en image CLIENT-SIDE
-- (pdfjs-dist dans le navigateur de l'enseignant, jamais cote serveur -
-- voir le commentaire de lib/document-text.ts sur DOMMatrix/pdfjs-dist en
-- environnement serverless, meme paquet, meme risque si utilise cote
-- Node), puis chaque page televersee comme une image independante -
-- "pages" stocke le tableau ordonne de leurs URLs publiques.
create table live_session_documents (
  live_session_id uuid primary key references live_sessions(id) on delete cascade,
  professeur_id uuid references users(id) not null,
  nom_fichier text not null,
  pages jsonb not null,
  page_courante int not null default 1,
  updated_at timestamptz not null default now()
);

alter table live_session_documents enable row level security;

-- Lecture : herite de la visibilite de live_sessions (elle-meme scopee par
-- tenant via courses, voir 20260717120000_live_sessions_rls.sql) - un
-- eleve inscrit au cours ou un membre du staff du meme etablissement peut
-- voir le document partage, jamais un tenant tiers.
create policy live_session_documents_select on live_session_documents
  for select using (
    live_session_id in (select id from live_sessions)
  );

-- Ecriture (partager/changer de page/arreter le partage) : reservee au
-- PROFESSEUR TITULAIRE de cette seance precise (professeur_id = auth.uid()
-- sur la ligne live_sessions elle-meme), pas a n'importe quel staff du
-- tenant - "controle par le professeur" (demande utilisateur) veut dire
-- CE professeur, pas ses collegues ni meme l'administrateur.
create policy live_session_documents_insert on live_session_documents
  for insert with check (
    live_session_id in (select id from live_sessions where professeur_id = auth.uid())
  );

create policy live_session_documents_update on live_session_documents
  for update
  using (live_session_id in (select id from live_sessions where professeur_id = auth.uid()))
  with check (live_session_id in (select id from live_sessions where professeur_id = auth.uid()));

create policy live_session_documents_delete on live_session_documents
  for delete using (
    live_session_id in (select id from live_sessions where professeur_id = auth.uid())
  );

-- Realtime : les eleves ecoutent les UPDATE (changement de page) et DELETE
-- (arret du partage) sur cette table pour rester synchronises sans
-- recharger la page (voir lib/live-document.ts:subscribeLiveDocument).
alter publication supabase_realtime add table live_session_documents;

-- Stockage : bucket public dedie, meme raisonnement que lecons-documents/
-- logos/photos-* (20260718020000/20260729000000) - le contenu pedagogique
-- partage en direct n'est pas plus sensible, un bucket prive aurait
-- demande des URLs signees regenerees a chaque page, cout de complexite
-- disproportionne ici.
insert into storage.buckets (id, name, public) values ('seance-documents', 'seance-documents', true);

create policy "Pages de document en direct publiques en lecture" on storage.objects
  for select using (bucket_id = 'seance-documents');

-- Ecriture reservee au professeur titulaire de LA seance precise dont
-- l'id forme le premier segment du chemin (voir DocumentPartage.tsx :
-- chemin televerse "{live_session_id}/{uuid}/page-{n}.png") - meme
-- granularite que la policy live_session_documents_insert ci-dessus,
-- jamais "n'importe quel professeur du tenant".
create policy "Professeur titulaire peut deposer une page de document" on storage.objects
  for insert
  with check (
    bucket_id = 'seance-documents'
    and exists (
      select 1 from live_sessions
      where id::text = (storage.foldername(name))[1]
      and professeur_id = auth.uid()
    )
  );

create policy "Professeur titulaire peut supprimer une page de document" on storage.objects
  for delete
  using (
    bucket_id = 'seance-documents'
    and exists (
      select 1 from live_sessions
      where id::text = (storage.foldername(name))[1]
      and professeur_id = auth.uid()
    )
  );
