-- AtlasLab — schéma initial (MVP)
-- Reprend fidèlement livrables/business/strategie/2026-07-17_architecture-technique_atlaslab.md
-- (jarvis-starter-kit), section 3.

-- Établissements (tenants)
create table tenants (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  slug text unique not null,
  logo_url text,
  couleur_primaire text,
  plan text not null default 'essai',
  created_at timestamptz default now()
);

-- Utilisateurs (rattachés à un tenant, sauf super-admin AtlasLab)
create table users (
  id uuid primary key references auth.users(id),
  tenant_id uuid references tenants(id),
  role text not null check (role in ('super_admin', 'admin_tenant', 'professeur', 'apprenant')),
  nom text not null,
  telephone text,
  email text,
  photo_url text,
  created_at timestamptz default now()
);

-- Cours
create table courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  titre text not null,
  filiere text,
  professeur_id uuid references users(id),
  created_at timestamptz default now()
);

-- Modules
create table modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) not null,
  titre text not null,
  ordre int not null
);

-- Leçons
create table lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules(id) not null,
  titre text not null,
  ordre int not null,
  type text not null check (type in ('contenu', 'labo', 'quiz', 'seance_directe')),
  contenu_markdown text,
  labo_type text check (labo_type in ('circuitverse', 'eecircuit')),
  labo_config jsonb
);

-- Séances en direct
create table live_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses(id) not null,
  lesson_id uuid references lessons(id),
  date_heure timestamptz not null,
  lien_visio text,
  professeur_id uuid references users(id)
);

-- Inscriptions
create table enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) not null,
  user_id uuid references users(id) not null,
  course_id uuid references courses(id) not null,
  date_inscription timestamptz default now(),
  unique (user_id, course_id)
);

-- Présence
create table attendance (
  id uuid primary key default gen_random_uuid(),
  live_session_id uuid references live_sessions(id) not null,
  user_id uuid references users(id) not null,
  statut text not null check (statut in ('present', 'absent', 'retard')),
  unique (live_session_id, user_id)
);

-- Devoirs
create table assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) not null,
  titre text not null,
  date_limite timestamptz
);

-- Rendus
create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references assignments(id) not null,
  user_id uuid references users(id) not null,
  contenu text,
  fichier_url text,
  note numeric,
  submitted_at timestamptz default now()
);

-- Progression (calcul déterministe côté application, jamais par l'IA)
create table progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  lesson_id uuid references lessons(id) not null,
  statut text not null default 'non_commence' check (statut in ('non_commence', 'en_cours', 'termine')),
  score numeric,
  updated_at timestamptz default now(),
  unique (user_id, lesson_id)
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security : isolation stricte par tenant
-- ─────────────────────────────────────────────────────────────

alter table tenants enable row level security;
alter table users enable row level security;
alter table courses enable row level security;
alter table modules enable row level security;
alter table lessons enable row level security;
alter table live_sessions enable row level security;
alter table enrollments enable row level security;
alter table attendance enable row level security;
alter table assignments enable row level security;
alter table submissions enable row level security;
alter table progress enable row level security;

-- Un utilisateur ne voit que les lignes de son propre tenant.
-- Le tenant_id est lu depuis le JWT (custom claim injecté à la connexion),
-- jamais depuis une valeur envoyée par le client.
create policy tenant_isolation_courses on courses
  for all using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy tenant_isolation_users on users
  for all using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy tenant_isolation_enrollments on enrollments
  for all using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- modules/lessons/live_sessions/attendance/assignments/submissions/progress
-- héritent de l'isolation via une jointure sur courses (pas de tenant_id direct)
create policy tenant_isolation_modules on modules
  for all using (
    course_id in (select id from courses where tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  );

create policy tenant_isolation_lessons on lessons
  for all using (
    module_id in (
      select m.id from modules m
      join courses c on c.id = m.course_id
      where c.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );
