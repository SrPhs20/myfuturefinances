-- Notificação em tempo real: sempre que um novo lançamento (gasto ou ganho)
-- é criado, avisa via Web Push todos os dispositivos inscritos no MESMO
-- perfil (user_id) — como perfis podem ser acessados por vários amigos que
-- sabem o PIN, isso funciona como um aviso pro grupo inteiro que usa aquela
-- conta. Não dispara em edição, só em criação (INSERT).
--
-- Roda uma vez por INSTRUÇÃO de insert (não por linha): uma importação em
-- massa gera UM aviso resumido em vez de um push por lançamento. Usa pg_net
-- pra chamar a Edge Function notificar-lancamento.
--
-- O segredo (Bearer token) que autentica essa chamada NÃO fica em texto
-- neste arquivo (ele é público no seu repositório) — fica guardado no
-- Supabase Vault deste projeto, sob o nome 'notificar_lancamento_secret',
-- e a função abaixo só lê o valor na hora de chamar a Edge Function. Isso
-- já foi configurado direto no banco; nada a fazer aqui.

create or replace function public.notificar_novo_lancamento()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  grupo record;
  segredo text;
begin
  select decrypted_secret into segredo
  from vault.decrypted_secrets
  where name = 'notificar_lancamento_secret'
  limit 1;

  if segredo is null then
    -- Segredo ainda não configurado no Vault: não quebra o insert, só não
    -- notifica (evita que lançamentos parem de salvar por causa disso).
    return null;
  end if;

  -- Agrupa por user_id (normalmente só um grupo por instrução, já que cada
  -- cliente só insere lançamentos do próprio perfil) e dispara um aviso por
  -- grupo: detalhado quando é um único lançamento, resumido quando são vários
  -- (ex.: restaurar backup).
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
    perform net.http_post(
      url := 'https://ijqobwweqvuqnftzxvdg.supabase.co/functions/v1/notificar-lancamento',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || segredo,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'user_id', grupo.user_id,
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

revoke all on function public.notificar_novo_lancamento() from public, anon, authenticated;

drop trigger if exists trg_notificar_novo_lancamento on public.lancamentos;
create trigger trg_notificar_novo_lancamento
  after insert on public.lancamentos
  referencing new table as novos_lancamentos
  for each statement
  execute function public.notificar_novo_lancamento();
