-- Corrige live_sessions.professeur_id pour les seances deja creees par un
-- admin_tenant/super_admin (2026-08-19, constate reellement : le bouton de
-- partage de document introuvable car professeur_id valait NULL sur une
-- seance de test). L'ancienne logique de createSeance
-- (app/(app)/cours/[courseId]/actions.ts) mettait professeur_id a NULL des
-- que ce n'etait pas un compte "professeur" qui remplissait le formulaire
-- de programmation, meme quand le cours avait bien un titulaire assigne -
-- desormais corrige pour toujours reprendre courses.professeur_id, mais
-- les lignes deja creees avant ce correctif restent orphelines sans ce
-- backfill.
update live_sessions
set professeur_id = courses.professeur_id
from courses
where live_sessions.course_id = courses.id
  and live_sessions.professeur_id is null
  and courses.professeur_id is not null;
