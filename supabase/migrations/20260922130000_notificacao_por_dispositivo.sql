-- Corrige o aviso de novo lançamento pra excluir só o DISPOSITIVO que fez o
-- lançamento, em vez da conta inteira. Antes, quando a mesma conta era
-- usada em mais de um aparelho (ex.: celular e computador da mesma pessoa),
-- o aviso não chegava em NENHUM dos dois, porque a conta inteira de quem
-- lançou era excluída da lista de avisos. Agora só o aparelho que
-- efetivamente lançou fica de fora — os outros aparelhos da mesma conta, e
-- todas as outras contas, recebem normalmente. Pra isso, cada lançamento
-- passa a guardar de qual assinatura de notificação (endpoint do push) do
-- aparelho que o criou ele veio (nulo se aquele aparelho não tem
-- notificações ativadas).

alter table public.lancamentos add column if not exists dispositivo_origem text;

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
    -- Segredo ainda não configurado no Vault: não quebra o insert, só não
    -- notifica (evita que lançamentos parem de salvar por causa disso).
    return null;
  end if;

  for grupo in
    select
      n.user_id,
      count(*) as quantidade,
      (array_agg(n.tipo order by n.id desc))[1] as tipo,
      (array_agg(n.categoria order by n.id desc))[1] as categoria,
      (array_agg(n.descricao order by n.id desc))[1] as descricao,
      (array_agg(n.valor order by n.id desc))[1] as valor,
      array_remove(array_agg(distinct n.dispositivo_origem), null) as origem_endpoints
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
        'valor', grupo.valor,
        'origem_endpoints', to_jsonb(grupo.origem_endpoints)
      )
    );
  end loop;

  return null;
end;
$$;
