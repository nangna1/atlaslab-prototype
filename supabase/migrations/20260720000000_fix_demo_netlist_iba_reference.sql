-- Reste de l'ancien nom du tenant demo (avant son renommage en "AtlasLab School",
-- migration 20260718040000) : le commentaire du netlist de demo mentionnait encore
-- "IBA", qui designe maintenant un tenant totalement different (le vrai Institut
-- Booster Afrique de Guillaume N'goran). Corrige pour eviter toute confusion visible
-- pendant la demo.
update lessons
set labo_config = jsonb_set(
  labo_config,
  '{netlist}',
  to_jsonb(replace(labo_config->>'netlist', 'Circuit RC - Module 1 IBA', 'Circuit RC - Module 1'))
)
where id = '44444444-4444-4444-4444-444444444442';
