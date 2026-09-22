-- Caixa de notificações DENTRO do app: além do push (que depende do sistema
-- operacional acordar o navegador, e em alguns celulares isso é bloqueado
-- por economia de bateria — ver nota no README), agora toda notificação de
-- novo lançamento e de vencimento também fica registrada aqui. Assim, quando
-- a pessoa abre o app, ela vê um sininho com as notificações recentes, mesmo
-- que o push daquele aparelho não tenha chegado.
--
-- Só as Edge Functions (service role, que ignora RLS) inserem linhas aqui —
-- de propósito não existe policy de insert pra usuários comuns, pra ninguém
-- conseguir forjar notificação pra si mesmo ou pra outra conta.

create table if not exists public.notificacoes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  corpo text not null,
  tipo text not null default 'geral',
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notificacoes_user_id_created_at_idx
  on public.notificacoes (user_id, created_at desc);

alter table public.notificacoes enable row level security;

drop policy if exists "notificacoes_select_proprias" on public.notificacoes;
create policy "notificacoes_select_proprias"
  on public.notificacoes for select
  using (auth.uid() = user_id);

drop policy if exists "notificacoes_update_proprias" on public.notificacoes;
create policy "notificacoes_update_proprias"
  on public.notificacoes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notificacoes_delete_proprias" on public.notificacoes;
create policy "notificacoes_delete_proprias"
  on public.notificacoes for delete
  using (auth.uid() = user_id);
