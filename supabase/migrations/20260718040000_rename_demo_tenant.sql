-- Renomme le tenant de demo : "Institut Booster Afrique" pretait a confusion
-- pour une demo devant le fondateur d'IBA lui-meme (il aura son propre
-- compte etablissement separe, cree via /admin/etablissements, pour tester
-- avec ses propres donnees). Le tenant de demo devient une vitrine neutre
-- AtlasLab.
update tenants
set nom = 'AtlasLab School', slug = 'atlaslab-school'
where id = '11111111-1111-1111-1111-111111111111';
