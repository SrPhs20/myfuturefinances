-- Limite de crédito do cartão (opcional): permite mostrar "limite usado" e
-- "limite disponível" na galeria visual da aba Cartões. O "usado" é
-- calculado no app (soma das contas fixas vinculadas + parcelas em aberto
-- daquele cartão) — aqui só guardamos o limite informado pelo usuário.
-- Quando não informado, a tela mostra apenas o total em uso, sem calcular
-- o disponível. Não altera nenhum cálculo existente do dashboard.

alter table public.cartoes
  add column if not exists limite numeric(12,2);
