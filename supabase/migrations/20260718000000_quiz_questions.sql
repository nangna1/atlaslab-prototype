-- Stocke les questions d'une lecon de type "quiz" directement sur lessons,
-- meme esprit que labo_config pour les lecons labo : pas de nouvelle table,
-- pas de nouvelle policy RLS, lessons a deja tout le CRUD necessaire
-- (20260717070000). Forme : [{ "question": "...", "options": [...], "correct": 0 }, ...]
alter table lessons add column quiz_questions jsonb;
