-- Painel de administração dentro do próprio app: só quem tem is_admin = true
-- consegue listar todas as contas (com saldo) e excluir a de outra pessoa.
-- A exclusão de verdade acontece na Edge Function admin-contas (só ela usa
-- a service_role key), esta migração só cria a marcação de quem é admin.

alter table public.perfis
  add column if not exists is_admin boolean not null default false;

update public.perfis
set is_admin = true,
    updated_at = now()
where public_id = '7a760aa6-1520-4e93-899d-f8c93587005a'::uuid;
