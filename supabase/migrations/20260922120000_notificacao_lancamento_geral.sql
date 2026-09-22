-- Ajusta o aviso de novo lançamento (criado na migração
-- notificar_lancamentos_grupo) pra ser GERAL entre todas as contas do app,
-- em vez de só entre dispositivos do mesmo perfil: agora, quando qualquer
-- conta lança um gasto ou ganho, todas as OUTRAS contas com notificações
-- ativadas recebem um aviso com o nome de quem lançou, categoria, descrição
-- e valor. Quem lançou não recebe aviso do próprio lançamento (isso é
-- decidido na Edge Function notificar-lancamento, que agora recebe
-- autor_user_id + autor_nome em vez de user_id).

create or replace function public.notificar_novo_lancamento()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  grupo record;
  segredo text;
  nome_autor text;
begin
  select decrypted_secret into segredo
  from vault.decrypted_secrets
  where name = 'notificar_lancamento_secret'
  limit 1;

  if segredo is null then
    return null;
  end if;

  for grupo in
    select
      n.user_id,
      count(*) as quantidade,
      (array_agg(n.tipo order by n.id desc))[1] as tipo,
      (array_agg(n.categoria order by n.id desc))[1] as categoria,
      (array_agg(n.descricao order by n.id desc))[1] as descricao,
      (array_agg(n.valor order by n.id desc))[1] as valor
    from novos_lancamentos n
    group by n.user_id
  loop
    select nome into nome_autor from public.perfis where user_id = grupo.user_id;

    perform net.http_post(
      url := 'https://ijqobwweqvuqnftzxvdg.supabase.co/functions/v1/notificar-lancamento',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || segredo,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'autor_user_id', grupo.user_id,
        'autor_nome', coalesce(nullif(btrim(nome_autor), ''), 'Alguém'),
        'quantidade', grupo.quantidade,
        'tipo', grupo.tipo,
        'categoria', grupo.categoria,
        'descricao', grupo.descricao,
        'valor', grupo.valor
      )
    );
  end loop;

  return null;
end;
$$;
