-- Painel admin sem Edge Function: duas funções no próprio banco (RPC),
-- chamadas direto pelo app via supabaseClient.rpc(...). Isso troca a
-- Edge Function "admin-contas"/"smooth-handler" (que dava CORS/JWT/erro
-- difícil de depurar) por algo que roda dentro do Postgres, sem precisar
-- de deploy manual nenhum.
--
-- Segurança: cada função confere sozinha, no início, se quem está
-- chamando (auth.uid()) tem perfis.is_admin = true. Quem não é admin
-- recebe um erro e não consegue listar nem excluir nada. A exclusão
-- apaga a conta inteira: como todas as tabelas (lancamentos,
-- contas_fixas, metas, cartoes_parcelas, orcamentos,
-- objetivos_financeiros, perfis) têm "on delete cascade" ligado a
-- auth.users, basta apagar a linha em auth.users que tudo o resto some
-- junto.

create or replace function public.admin_listar_contas()
returns table (
  public_id uuid,
  nome text,
  avatar_url text,
  show_on_home boolean,
  created_at timestamptz,
  saldo numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.perfis where user_id = auth.uid() and is_admin = true
  ) then
    raise exception 'Sem permissao para isso.' using errcode = '42501';
  end if;

  return query
  select
    p.public_id,
    p.nome,
    p.avatar_url,
    p.show_on_home,
    p.created_at,
    coalesce(sum(case when l.tipo = 'receita' then l.valor else -l.valor end), 0) as saldo
  from public.perfis p
  left join public.lancamentos l on l.user_id = p.user_id
  group by p.public_id, p.nome, p.avatar_url, p.show_on_home, p.created_at
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_excluir_conta(p_public_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo_user_id uuid;
begin
  if not exists (
    select 1 from public.perfis where user_id = auth.uid() and is_admin = true
  ) then
    raise exception 'Sem permissao para isso.' using errcode = '42501';
  end if;

  select user_id into v_alvo_user_id from public.perfis where public_id = p_public_id;

  if v_alvo_user_id is null then
    raise exception 'Conta nao encontrada.' using errcode = 'P0002';
  end if;

  if v_alvo_user_id = auth.uid() then
    raise exception 'Use a opcao de excluir seu proprio perfil pra isso.' using errcode = '22023';
  end if;

  delete from storage.objects
  where bucket_id = 'avatars' and name like v_alvo_user_id::text || '/%';

  delete from auth.users where id = v_alvo_user_id;
end;
$$;

grant execute on function public.admin_listar_contas() to authenticated;
grant execute on function public.admin_excluir_conta(uuid) to authenticated;
