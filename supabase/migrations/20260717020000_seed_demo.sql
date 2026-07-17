-- Données de démonstration (Institut Booster Afrique), reprises de lib/data/mock.ts,
-- pour remplacer les données simulées maintenant que les pages /cours interrogent Supabase.
-- Ne crée volontairement aucun utilisateur : auth.users ne peut être peuplé que via
-- Supabase Auth (Dashboard ou signup), voir la migration suivante pour rattacher
-- l'utilisateur démo une fois créé.
insert into tenants (id, nom, slug, plan)
values ('11111111-1111-1111-1111-111111111111', 'Institut Booster Afrique', 'iba', 'essai');

insert into courses (id, tenant_id, titre, filiere)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Électronique — Bases des circuits',
  'Génie Électrique'
);

insert into modules (id, course_id, titre, ordre) values
  ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'Module 1 — Loi d''Ohm et circuits résistifs', 1),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'Module 2 — Logique numérique', 2);

insert into lessons (id, module_id, titre, ordre, type, contenu_markdown, labo_type, labo_config) values
  (
    '44444444-4444-4444-4444-444444444441',
    '33333333-3333-3333-3333-333333333331',
    'Introduction : tension, courant, résistance',
    1,
    'contenu',
    'La loi d''Ohm relie tension (U), courant (I) et résistance (R) : **U = R × I**. Dans ce module, vous allez vérifier cette loi directement sur un circuit simulé, sans matériel physique.',
    null,
    null
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '33333333-3333-3333-3333-333333333331',
    'Simulation : circuit RC (pratique)',
    2,
    'labo',
    'Observez la charge et décharge du condensateur sur ce circuit RC. Modifiez le netlist pour changer la valeur de R ou C et observez l''effet sur le temps de charge.',
    'eecircuit',
    '{"netlist": "Circuit RC - Module 1 IBA\nv1 in 0 pulse(0 5 0 1m 1m 10m 20m)\nr1 in out 1k\nc1 out 0 1u\n.tran 0.1m 20m\n.end"}'
  ),
  (
    '44444444-4444-4444-4444-444444444443',
    '33333333-3333-3333-3333-333333333332',
    'Portes logiques de base (pratique)',
    1,
    'labo',
    'Testez les portes NOT, AND, OR, XOR, NAND, NOR en changeant les entrées A et B et observez les sorties calculées en direct.',
    'circuitverse',
    '{"embed_url": "https://circuitverse.org/simulator/embed/sample-embed"}'
  );
