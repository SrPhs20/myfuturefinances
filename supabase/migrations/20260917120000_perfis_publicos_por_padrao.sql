-- Toda conta nova passa a aparecer pra todo mundo na tela inicial por
-- padrão (foto + saldo, como já acontece com a conta principal), em vez de
-- só aparecer no aparelho onde foi criada. A tela de troca de conta já
-- sabia mostrar isso (Edge Function profile-access, ação "list", já mescla
-- os perfis com show_on_home = true) — só faltava esse valor já nascer
-- como true em vez de false.

alter table public.perfis
  alter column show_on_home set default true;

-- Deixa visíveis pra todo mundo os perfis que já existem hoje (incluindo o
-- que foi criado no celular pra testar), pra não precisar recriar nada.
update public.perfis
set show_on_home = true,
    updated_at = now()
where show_on_home = false;
