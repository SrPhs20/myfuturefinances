# My Future Finances

Aplicativo financeiro pessoal integrado ao Supabase, com autenticação, lançamentos, contas fixas, metas mensais, compras parceladas, orçamentos por categoria, objetivos, reserva de emergência e perfil com avatar.

O dashboard funciona como um orientador: calcula um placar de saúde financeira, compara seis meses, mede a taxa de economia, sinaliza estouros de orçamento e antecipa compromissos.

## Estrutura

- `index.html`, `style.css` e `script.js`: aplicação web estática.
- `supabase/migrations`: banco, índices, RLS, gatilhos e funções transacionais.
- `supabase/functions/delete-account`: exclusão definitiva da conta no Supabase Auth.
- `vercel.json`: publicação e cabeçalhos de segurança no Vercel.
- `manifest.json` e `service-worker.js`: instalação como PWA e shell offline.

## Configurar o Supabase

1. Abra o SQL Editor do projeto `hjafylznpribmpumcgtk`.
2. Execute, na ordem, `supabase/migrations/20260721143000_finance_app.sql` e `supabase/migrations/20260721160000_financial_coach.sql`.
3. Publique a Edge Function `delete-account` mantendo a verificação de JWT habilitada.
4. Em Authentication > URL Configuration, cadastre a URL de produção e as URLs locais permitidas.

A chave usada no navegador é a chave pública `anon`. Nunca coloque `service_role` no frontend.

## Desenvolvimento local

Sirva a pasta por HTTP para que autenticação e service worker funcionem corretamente:

```powershell
python -m http.server 8000
```

Acesse `http://localhost:8000`.

## Publicação

O repositório está conectado ao Vercel. Um push para `main` inicia automaticamente uma implantação de produção.
