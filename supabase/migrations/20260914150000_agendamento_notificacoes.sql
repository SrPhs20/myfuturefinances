-- Agenda, dentro do próprio Supabase, as duas chamadas diárias que checam
-- vencimentos e disparam as notificações push (Edge Function
-- check-vencimentos). Usa pg_cron (agendador) + pg_net (faz a chamada HTTP)
-- — assim o segredo (CRON_SECRET) fica só aqui dentro do seu projeto, nunca
-- em nenhum outro lugar.
--
-- IMPORTANTE: troque 'COLE_AQUI_O_MESMO_CRON_SECRET' pelo mesmo valor que
-- você colocar como variável de ambiente CRON_SECRET na Edge Function
-- check-vencimentos (Project Settings → Edge Functions → Secrets).
--
-- Se o seu projeto Supabase não tiver pg_cron/pg_net disponíveis (raro, mas
-- pode acontecer em planos mais antigos), este arquivo vai dar erro ao
-- rodar — nesse caso me avise que a gente ajusta o agendamento de outro
-- jeito. As tabelas e a Edge Function funcionam normalmente sem isso.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.unschedule('aviso-vencimento-manha') where exists (
  select 1 from cron.job where jobname = 'aviso-vencimento-manha'
);
select cron.unschedule('aviso-vencimento-noite') where exists (
  select 1 from cron.job where jobname = 'aviso-vencimento-noite'
);

-- 11:00 UTC = 08:00 em Brasília (sem horário de verão desde 2019).
select cron.schedule(
  'aviso-vencimento-manha',
  '0 11 * * *',
  $$
  select net.http_post(
    url := 'https://hjafylznpribmpumcgtk.supabase.co/functions/v1/check-vencimentos',
    headers := jsonb_build_object('Authorization', 'Bearer COLE_AQUI_O_MESMO_CRON_SECRET', 'Content-Type', 'application/json'),
    body := jsonb_build_object('periodo', 'manha')
  );
  $$
);

-- 23:00 UTC = 20:00 em Brasília.
select cron.schedule(
  'aviso-vencimento-noite',
  '0 23 * * *',
  $$
  select net.http_post(
    url := 'https://hjafylznpribmpumcgtk.supabase.co/functions/v1/check-vencimentos',
    headers := jsonb_build_object('Authorization', 'Bearer COLE_AQUI_O_MESMO_CRON_SECRET', 'Content-Type', 'application/json'),
    body := jsonb_build_object('periodo', 'noite')
  );
  $$
);
