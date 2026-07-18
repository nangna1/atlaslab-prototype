alter table tenants
  add column adresse text,
  add column numero_agrement text,
  add column representant_legal text,
  add column certificat_modele text not null default 'classique'
    check (certificat_modele in ('classique', 'moderne', 'sceau'));
