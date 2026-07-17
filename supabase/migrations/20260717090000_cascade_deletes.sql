-- Aucune contrainte n'avait de ON DELETE CASCADE dans le schema initial
-- (20260717000000_init.sql) : supprimer un cours avec des modules echouait
-- avec une violation de cle etrangere. Necessaire maintenant que l'UI
-- permet de supprimer cours/modules/lecons (app/cours/[courseId]/actions.ts).
-- Noms de contraintes = convention par defaut Postgres pour des
-- "references" inline sans contrainte nommee (<table>_<colonne>_fkey),
-- comme utilise partout dans ce schema.
alter table modules drop constraint modules_course_id_fkey,
  add constraint modules_course_id_fkey foreign key (course_id) references courses(id) on delete cascade;

alter table lessons drop constraint lessons_module_id_fkey,
  add constraint lessons_module_id_fkey foreign key (module_id) references modules(id) on delete cascade;

alter table live_sessions drop constraint live_sessions_course_id_fkey,
  add constraint live_sessions_course_id_fkey foreign key (course_id) references courses(id) on delete cascade;

alter table live_sessions drop constraint live_sessions_lesson_id_fkey,
  add constraint live_sessions_lesson_id_fkey foreign key (lesson_id) references lessons(id) on delete cascade;

alter table enrollments drop constraint enrollments_course_id_fkey,
  add constraint enrollments_course_id_fkey foreign key (course_id) references courses(id) on delete cascade;

alter table attendance drop constraint attendance_live_session_id_fkey,
  add constraint attendance_live_session_id_fkey foreign key (live_session_id) references live_sessions(id) on delete cascade;

alter table assignments drop constraint assignments_lesson_id_fkey,
  add constraint assignments_lesson_id_fkey foreign key (lesson_id) references lessons(id) on delete cascade;

alter table submissions drop constraint submissions_assignment_id_fkey,
  add constraint submissions_assignment_id_fkey foreign key (assignment_id) references assignments(id) on delete cascade;

alter table progress drop constraint progress_lesson_id_fkey,
  add constraint progress_lesson_id_fkey foreign key (lesson_id) references lessons(id) on delete cascade;
