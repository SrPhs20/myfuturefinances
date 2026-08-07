-- Perfis marcados aparecem no seletor inicial mesmo em aparelhos novos.

alter table public.perfis
  add column if not exists show_on_home boolean not null default false;

update public.perfis
set show_on_home = true,
    updated_at = now()
where public_id = '7a760aa6-1520-4e93-899d-f8c93587005a'::uuid;

