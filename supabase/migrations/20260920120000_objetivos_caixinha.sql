-- Adiciona o tipo "caixinha": uma reserva sem valor-alvo (sem limite), só
-- para acompanhar quanto foi guardado e, opcionalmente, onde está guardado.
alter table public.objetivos_financeiros
  alter column valor_alvo drop not null;

alter table public.objetivos_financeiros
  drop constraint objetivos_financeiros_valor_alvo_check;
alter table public.objetivos_financeiros
  add constraint objetivos_financeiros_valor_alvo_check
  check (valor_alvo is null or valor_alvo > 0);

alter table public.objetivos_financeiros
  drop constraint objetivos_financeiros_tipo_check;
alter table public.objetivos_financeiros
  add constraint objetivos_financeiros_tipo_check
  check (tipo = any (array['objetivo'::text, 'reserva_emergencia'::text, 'caixinha'::text]));

alter table public.objetivos_financeiros
  add column local text;
alter table public.objetivos_financeiros
  add constraint objetivos_financeiros_local_check
  check (local is null or (char_length(trim(both from local)) >= 1 and char_length(trim(both from local)) <= 80));
