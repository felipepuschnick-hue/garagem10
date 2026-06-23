-- ══════════════════════════════════════════
--  GARAGEM 10 — SCHEMA SUPABASE
--  Execute este script inteiro no SQL Editor do Supabase
-- ══════════════════════════════════════════

-- Extensão para gerar UUIDs
create extension if not exists "uuid-ossp";

-- ── TABELA: veiculos ──
create table public.veiculos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  marca text,
  modelo text,
  ano text,
  cor text,
  placa text,
  renavam text,
  km text,
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── TABELA: manutencoes ──
create table public.manutencoes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  veiculo_id uuid not null references public.veiculos(id) on delete cascade,
  tipo text not null,
  cat text not null,
  km text,
  valor numeric(12,2),
  data date not null,
  proxima date,
  oficina text,
  obs text,
  lembrete boolean not null default false,
  arquivo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── ÍNDICES ──
create index idx_veiculos_user on public.veiculos(user_id);
create index idx_manutencoes_user on public.manutencoes(user_id);
create index idx_manutencoes_veiculo on public.manutencoes(veiculo_id);

-- ── ROW LEVEL SECURITY ──
alter table public.veiculos enable row level security;
alter table public.manutencoes enable row level security;

-- Políticas: cada usuário só vê/edita os próprios dados
create policy "veiculos_select_own" on public.veiculos
  for select using (auth.uid() = user_id);
create policy "veiculos_insert_own" on public.veiculos
  for insert with check (auth.uid() = user_id);
create policy "veiculos_update_own" on public.veiculos
  for update using (auth.uid() = user_id);
create policy "veiculos_delete_own" on public.veiculos
  for delete using (auth.uid() = user_id);

create policy "manutencoes_select_own" on public.manutencoes
  for select using (auth.uid() = user_id);
create policy "manutencoes_insert_own" on public.manutencoes
  for insert with check (auth.uid() = user_id);
create policy "manutencoes_update_own" on public.manutencoes
  for update using (auth.uid() = user_id);
create policy "manutencoes_delete_own" on public.manutencoes
  for delete using (auth.uid() = user_id);

-- ── TRIGGER: atualizar updated_at automaticamente ──
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_veiculos_updated_at
  before update on public.veiculos
  for each row execute function public.set_updated_at();

create trigger trg_manutencoes_updated_at
  before update on public.manutencoes
  for each row execute function public.set_updated_at();

-- ══════════════════════════════════════════
--  STORAGE — buckets para fotos e comprovantes
--  (Rode também via SQL Editor; cria os buckets e as policies)
-- ══════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('fotos-veiculos', 'fotos-veiculos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

-- Policies do bucket fotos-veiculos (público para leitura, autenticado para escrever)
create policy "fotos_select_public" on storage.objects
  for select using (bucket_id = 'fotos-veiculos');
create policy "fotos_insert_own" on storage.objects
  for insert with check (bucket_id = 'fotos-veiculos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "fotos_update_own" on storage.objects
  for update using (bucket_id = 'fotos-veiculos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "fotos_delete_own" on storage.objects
  for delete using (bucket_id = 'fotos-veiculos' and auth.uid()::text = (storage.foldername(name))[1]);

-- Policies do bucket comprovantes (privado, só o dono acessa)
create policy "comprovantes_select_own" on storage.objects
  for select using (bucket_id = 'comprovantes' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "comprovantes_insert_own" on storage.objects
  for insert with check (bucket_id = 'comprovantes' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "comprovantes_update_own" on storage.objects
  for update using (bucket_id = 'comprovantes' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "comprovantes_delete_own" on storage.objects
  for delete using (bucket_id = 'comprovantes' and auth.uid()::text = (storage.foldername(name))[1]);
