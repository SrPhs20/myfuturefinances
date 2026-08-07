-- Tela de perfil com PIN: o hash nunca e devolvido ao navegador.

alter table public.perfis add column if not exists pin_hash text;
alter table public.perfis add column if not exists pin_length smallint;
alter table public.perfis add column if not exists pin_failed_attempts smallint not null default 0;
alter table public.perfis add column if not exists pin_locked_until timestamptz;

alter table public.perfis drop constraint if exists perfis_pin_length_check;
alter table public.perfis
  add constraint perfis_pin_length_check
  check (pin_length is null or pin_length between 4 and 8);

create or replace function public.configurar_pin_acesso(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sessao nao encontrada.';
  end if;

  if p_pin is null or p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'O PIN deve ter entre 4 e 8 numeros.';
  end if;

  update public.perfis
  set pin_hash = crypt(p_pin, gen_salt('bf', 10)),
      pin_length = length(p_pin),
      pin_failed_attempts = 0,
      pin_locked_until = null,
      updated_at = now()
  where user_id = v_user_id;

  if not found then
    raise exception 'Perfil nao encontrado.';
  end if;

  return jsonb_build_object('configurado', true, 'tamanho', length(p_pin));
end;
$$;

create or replace function public.verificar_pin_acesso(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_pin_hash text;
  v_tentativas smallint;
  v_bloqueado_ate timestamptz;
  v_novas_tentativas smallint;
  v_espera integer;
begin
  if v_user_id is null then
    raise exception 'Sessao nao encontrada.';
  end if;

  select pin_hash, pin_failed_attempts, pin_locked_until
  into v_pin_hash, v_tentativas, v_bloqueado_ate
  from public.perfis
  where user_id = v_user_id
  for update;

  if not found or v_pin_hash is null then
    return jsonb_build_object('valido', false, 'configurado', false);
  end if;

  if v_bloqueado_ate is not null and v_bloqueado_ate > clock_timestamp() then
    v_espera := greatest(1, ceil(extract(epoch from (v_bloqueado_ate - clock_timestamp())))::integer);
    return jsonb_build_object('valido', false, 'configurado', true, 'bloqueado', true, 'segundos', v_espera);
  end if;

  if p_pin is not null and crypt(p_pin, v_pin_hash) = v_pin_hash then
    update public.perfis
    set pin_failed_attempts = 0,
        pin_locked_until = null
    where user_id = v_user_id;

    return jsonb_build_object('valido', true, 'configurado', true);
  end if;

  v_novas_tentativas := coalesce(v_tentativas, 0) + 1;

  if v_novas_tentativas >= 5 then
    update public.perfis
    set pin_failed_attempts = 0,
        pin_locked_until = clock_timestamp() + interval '30 seconds'
    where user_id = v_user_id;

    return jsonb_build_object('valido', false, 'configurado', true, 'bloqueado', true, 'segundos', 30);
  end if;

  update public.perfis
  set pin_failed_attempts = v_novas_tentativas,
      pin_locked_until = null
  where user_id = v_user_id;

  return jsonb_build_object(
    'valido', false,
    'configurado', true,
    'bloqueado', false,
    'tentativas_restantes', 5 - v_novas_tentativas
  );
end;
$$;

revoke all on function public.configurar_pin_acesso(text) from public;
revoke all on function public.verificar_pin_acesso(text) from public;
grant execute on function public.configurar_pin_acesso(text) to authenticated;
grant execute on function public.verificar_pin_acesso(text) to authenticated;

-- O navegador pode saber apenas o tamanho do PIN, nunca o hash ou os contadores.
revoke select, insert, update on public.perfis from authenticated;
grant select (id, user_id, nome, avatar_url, created_at, updated_at, pin_length) on public.perfis to authenticated;
grant insert (user_id, nome, avatar_url) on public.perfis to authenticated;
grant update (nome, avatar_url) on public.perfis to authenticated;

