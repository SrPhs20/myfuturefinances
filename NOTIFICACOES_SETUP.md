# Notificações de vencimento — passo a passo para ativar

Isso é só de configuração no Supabase (uma vez). Depois de pronto, funciona sozinho.

## 1. Rodar as duas migrações novas no SQL Editor do Supabase

Nesta ordem:

1. `20260914140000_notificacoes_vencimento.sql` — cria a tabela de inscrições e a preferência no perfil.
2. `20260914150000_agendamento_notificacoes.sql` — **antes de rodar**, troque as duas ocorrências de `COLE_AQUI_O_MESMO_CRON_SECRET` pelo valor abaixo (é o mesmo valor do passo 3):

```
k61ZySL0UkKE2qIyto4f_8-dz32WEeYb
```

Se esse segundo arquivo der erro (projeto sem `pg_cron`/`pg_net` disponível), me avise — as tabelas e a notificação em si continuam funcionando, só o agendamento automático que precisa de outro jeito.

## 2. Criar a Edge Function `check-vencimentos`

No painel do Supabase: **Edge Functions → Create a new function**, nome `check-vencimentos`, e cole o conteúdo do arquivo `functions/check-vencimentos/index.ts` que te mandei. Deploy.

## 3. Configurar os segredos da função

Ainda em Edge Functions → `check-vencimentos` → **Secrets** (ou em Project Settings → Edge Functions), adicione:

| Nome | Valor |
|---|---|
| `CRON_SECRET` | `k61ZySL0UkKE2qIyto4f_8-dz32WEeYb` |
| `VAPID_PUBLIC_KEY` | `BBWpHWUBmp2CI8AErgUC8kYrc9ev7SUC0iBfu3S_--XinwgfGeqEeUpx9mn-XNQPHH02OqdTOXgmtpoqRanBQiE` |
| `VAPID_PRIVATE_KEY` | `-f5ukaoE5wQyv_P3oJOdTrCKKw6BLxUAAC9eq-FNVpU` |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` o Supabase já injeta sozinho, não precisa adicionar.

## 4. Subir o código do app (GitHub Desktop)

Os arquivos `index.html`, `script.js`, `style.css`, `service-worker.js` já têm a parte do app (botão "Ativar notificações" no perfil, service worker sabendo mostrar o aviso). É só commitar e dar push como das outras vezes.

## 5. Testar

1. Abra o app, vá em **Editar perfil** → **Ativar notificações**, aceite a permissão do navegador.
2. No Supabase, em Edge Functions → `check-vencimentos`, use o botão de **Invoke/Test** com o corpo `{"periodo":"manha"}` e o header `Authorization: Bearer k61ZySL0UkKE2qIyto4f_8-dz32WEeYb` — se você tiver alguma conta fixa ou cartão vencendo dentro da sua antecedência escolhida, a notificação deve aparecer.

A partir daí, o Supabase chama essa função sozinho todo dia às 8h e às 20h (horário de Brasília).

## Como funciona a regra de aviso

Você escolhe, em Editar perfil, avisar com **1, 3 ou 5 dias** de antecedência:

- Todo dia de manhã: avisa tudo que vence de hoje até N dias à frente.
- Toda noite: avisa de novo só o que vence hoje ou amanhã — reforço extra perto do prazo.

No iPhone, isso só funciona se o Minhas Finanças estiver **instalado na tela de início** (Safari → Compartilhar → Adicionar à Tela de Início). Pelo navegador comum do iPhone, notificação push não funciona — é uma limitação da Apple, não do app.
