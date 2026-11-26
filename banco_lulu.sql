-- =============================================================
-- PARTE EXTRA DO PAINEL DA LULU: marcas, publis, calendário e roteiros (25/11/2026)
-- Cole este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Pode rodar de novo sem problema: não apaga nada.
-- Igual ao banco do curso: cada linha tem user_id e só o dono vê e mexe nela.
-- =============================================================

-- 1. MARCAS: com quem você fala, fechou ou quer fechar
create table if not exists public.marcas (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text not null check (char_length(nome) between 1 and 120),
  status        text not null default 'prospeccao' check (status in ('prospeccao', 'conversando', 'parceira', 'pausada')),
  contato       text check (char_length(contato) <= 120),
  email         text check (char_length(email) <= 160),
  whatsapp      text check (char_length(whatsapp) <= 30),
  instagram     text check (char_length(instagram) <= 80),
  razao_social  text check (char_length(razao_social) <= 200),
  cnpj          text check (char_length(cnpj) <= 30),
  representante text check (char_length(representante) <= 120),
  endereco      text check (char_length(endereco) <= 300),
  obs           text check (char_length(obs) <= 2000),
  criado_em     timestamptz not null default now()
);
create index if not exists marcas_user on public.marcas (user_id, nome);

-- 2. PUBLIS: cada trabalho pago (proposta, fechada, entregue, paga)
create table if not exists public.publis (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  marca_id         bigint references public.marcas (id) on delete set null,
  titulo           text not null check (char_length(titulo) between 1 and 160),
  status           text not null default 'proposta' check (status in ('proposta', 'fechada', 'gravando', 'entregue', 'paga', 'cancelada')),
  valor            numeric(12, 2) not null default 0 check (valor >= 0),
  qtd_videos       integer not null default 1 check (qtd_videos between 0 and 100),
  duracao_video    text check (char_length(duracao_video) <= 60),
  qtd_fotos        integer not null default 0 check (qtd_fotos between 0 and 100),
  entregaveis      text check (char_length(entregaveis) <= 2000),
  entrega_em       date,
  forma_pagamento  text check (char_length(forma_pagamento) <= 120),
  prazo_pagamento  integer check (prazo_pagamento between 0 and 365),
  licenca_meses    integer check (licenca_meses between 0 and 120),
  vence_em         date,
  pago_em          date,
  obs              text check (char_length(obs) <= 2000),
  criado_em        timestamptz not null default now()
);
create index if not exists publis_user on public.publis (user_id, status);

-- Segurança igual em todas: só a dona vê e mexe no que é dela
do $$
declare t text;
begin
  foreach t in array array['marcas', 'publis'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "so o dono" on public.%I', t);
    execute format('create policy "so o dono" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

grant select, insert, update, delete on public.marcas, public.publis to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.marcas, public.publis from anon;

notify pgrst, 'reload schema';

-- =============================================================
-- CONTEÚDO (25/11/2026): calendário e roteiros
-- =============================================================

-- 3. ROTEIROS: a sua biblioteca de roteiros (cola a copy do Claude aqui)
create table if not exists public.roteiros (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  titulo     text not null check (char_length(titulo) between 1 and 160),
  produto    text check (char_length(produto) <= 200),
  formato    text check (char_length(formato) <= 40),
  status     text not null default 'ideia' check (status in ('ideia', 'pronto', 'gravado', 'postado')),
  texto      text check (char_length(texto) <= 20000),
  obs        text check (char_length(obs) <= 2000),
  criado_em  timestamptz not null default now()
);
create index if not exists roteiros_user on public.roteiros (user_id, criado_em desc);

-- 4. CALENDÁRIO: o que gravar, postar, entregar ou fazer de live em cada dia
create table if not exists public.calendario (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data        date not null,
  hora        time,
  titulo      text not null check (char_length(titulo) between 1 and 160),
  tipo        text not null default 'postar' check (tipo in ('gravar', 'editar', 'postar', 'live', 'outro')),
  plataforma  text not null default 'tiktok' check (plataforma in ('tiktok', 'instagram', 'ambos', 'outro')),
  feito       boolean not null default false,
  roteiro_id  bigint references public.roteiros (id) on delete set null,
  obs         text check (char_length(obs) <= 1000),
  criado_em   timestamptz not null default now()
);
create index if not exists calendario_user_data on public.calendario (user_id, data);
-- Um item da agenda também pode apontar para uma copy da aba Criar (tabela referencias do curso)
alter table public.calendario add column if not exists referencia_id text check (char_length(referencia_id) <= 40);

do $$
declare t text;
begin
  foreach t in array array['roteiros', 'calendario'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "so o dono" on public.%I', t);
    execute format('create policy "so o dono" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

grant select, insert, update, delete on public.roteiros, public.calendario to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.roteiros, public.calendario from anon;

notify pgrst, 'reload schema';

-- =============================================================
-- GANHOS (25/11/2026): tipo de trabalho e outros ganhos
-- =============================================================

-- Cada trabalho com marca agora diz o que é: publi, UGC, evento/presença ou outro
alter table public.publis add column if not exists tipo text not null default 'publi' check (tipo in ('publi', 'ugc', 'evento', 'outro'));

-- 5. OUTROS GANHOS: o que não é TikTok Shop nem trabalho com marca (ex.: Shopee, Amazon, aula, consultoria)
create table if not exists public.ganhos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data       date not null,
  fonte      text not null check (char_length(fonte) between 1 and 60),
  descricao  text check (char_length(descricao) <= 200),
  valor      numeric(12, 2) not null check (valor >= 0),
  criado_em  timestamptz not null default now()
);
create index if not exists ganhos_user_data on public.ganhos (user_id, data);
alter table public.ganhos enable row level security;
drop policy if exists "so o dono" on public.ganhos;
create policy "so o dono" on public.ganhos for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.ganhos to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.ganhos from anon;

notify pgrst, 'reload schema';

-- 26/11/2026: vários links de referência em cada roteiro (lista de endereços)
alter table public.roteiros add column if not exists links jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';

-- 26/11/2026: o texto (transcrição) de cada link de referência, por endereço
alter table public.roteiros add column if not exists transcricoes jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';

-- =============================================================
-- REFERÊNCIAS (26/11/2026): uma pasta por produto ou por tema, com vídeos de referência e ideias
-- =============================================================

-- 6. PASTAS: um produto (que eu tenho ou não) ou um tema ("maquiagem em geral")
create table if not exists public.pastas (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome         text not null check (char_length(nome) between 1 and 160),
  tipo         text not null default 'produto' check (tipo in ('produto', 'tema')),
  status       text not null default 'pesquisando' check (status in ('pesquisando', 'vou_gravar', 'gravado', 'pausado')),
  link_produto text check (char_length(link_produto) <= 400),
  comissao     numeric(5, 2) check (comissao between 0 and 100),
  notas        text check (char_length(notas) <= 10000),
  ideias       jsonb not null default '[]'::jsonb,
  criado_em    timestamptz not null default now()
);
create index if not exists pastas_user on public.pastas (user_id, criado_em desc);

-- 7. VÍDEOS DE REFERÊNCIA de cada pasta (com o texto transcrito e a sua anotação)
create table if not exists public.pasta_refs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pasta_id   bigint not null references public.pastas (id) on delete cascade,
  link       text not null check (char_length(link) <= 400),
  etiqueta   text check (etiqueta in ('gancho', 'demonstracao', 'prova', 'cta', 'formato', 'outro')),
  nota       text check (char_length(nota) <= 1000),
  texto      text check (char_length(texto) <= 8000),
  criado_em  timestamptz not null default now()
);
create index if not exists pasta_refs_pasta on public.pasta_refs (user_id, pasta_id);

-- o roteiro pode saber de qual pasta ele saiu
alter table public.roteiros add column if not exists pasta_id bigint references public.pastas (id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['pastas', 'pasta_refs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "so o dono" on public.%I', t);
    execute format('create policy "so o dono" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
grant select, insert, update, delete on public.pastas, public.pasta_refs to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.pastas, public.pasta_refs from anon;

notify pgrst, 'reload schema';
