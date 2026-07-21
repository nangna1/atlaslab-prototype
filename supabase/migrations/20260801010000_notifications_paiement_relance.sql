-- Relance de paiement de frais de scolarite : nouveau type de notification
-- (voir app/admin/paiements/actions.ts). Le constraint est deja nomme
-- explicitement notifications_type_check depuis 20260728000000, pas besoin
-- de le retrouver dynamiquement cette fois.
alter table notifications drop constraint notifications_type_check;

alter table notifications
  add constraint notifications_type_check
  check (type in ('devoir_note', 'seance_programmee', 'nouvelle_offre', 'paiement_relance'));
