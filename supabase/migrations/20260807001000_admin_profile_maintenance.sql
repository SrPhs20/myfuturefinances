-- Rotina de manutencao para suporte. Somente a service_role pode executa-la.

create or replace function public.admin_atualizar_perfil_por_nome(
  p_nome_atual text,
  p_novo_nome text,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_total integer;
  v_user_id uuid;
  v_public_id uuid;
begin
  if p_nome_atual is null or btrim(p_nome_atual) = '' then
    raise exception 'Informe o nome atual.';
  end if;
  if p_novo_nome is null or char_length(btrim(p_novo_nome)) < 2 then
    raise exception 'Informe o novo nome.';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'O PIN deve ter entre 4 e 8 numeros.';
  end if;

  select count(*) into v_total
  from public.perfis
  where lower(btrim(nome)) = lower(btrim(p_nome_atual));

  if v_total <> 1 then
    raise exception 'A manutencao exige exatamente uma conta correspondente; encontradas: %.', v_total;
  end if;

  select user_id, public_id into v_user_id, v_public_id
  from public.perfis
  where lower(btrim(nome)) = lower(btrim(p_nome_atual))
  for update;

  update public.perfis
  set nome = btrim(p_novo_nome),
      pin_hash = crypt(p_pin, gen_salt('bf', 10)),
      pin_length = length(p_pin),
      pin_failed_attempts = 0,
      pin_locked_until = null,
      updated_at = now()
  where user_id = v_user_id;

  return jsonb_build_object(
    'atualizado', true,
    'public_id', v_public_id,
    'nome', btrim(p_novo_nome),
    'pin_length', length(p_pin)
  );
end;
$$;

revoke all on function public.admin_atualizar_perfil_por_nome(text, text, text) from public;
grant execute on function public.admin_atualizar_perfil_por_nome(text, text, text) to service_role;

