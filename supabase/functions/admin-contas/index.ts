import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Painel admin dentro do app: lista todas as contas (com saldo) e permite
// excluir a de outra pessoa, sem precisar abrir o painel do Supabase.
// Só quem tem perfis.is_admin = true pode chamar isto — ver migração
// 20260918120000_admin_contas.sql. A exclusão apaga tudo da pessoa (avatar,
// lançamentos, contas fixas, metas, cartões, orçamentos, objetivos e o
// login dela), igual à função delete-account usada pra excluir a própria
// conta.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const uuidValido = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, mensagem: "Metodo nao permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, mensagem: "Servico nao configurado." }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const autorizacao = request.headers.get("authorization") || "";
  const token = autorizacao.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, mensagem: "Sessao invalida." }, 401);

  try {
    const { data: chamador, error: erroChamador } = await admin.auth.getUser(token);
    if (erroChamador || !chamador?.user) return json({ ok: false, mensagem: "Sessao invalida." }, 401);

    const { data: perfilChamador, error: erroPerfilChamador } = await admin
      .from("perfis")
      .select("is_admin")
      .eq("user_id", chamador.user.id)
      .maybeSingle();
    if (erroPerfilChamador) throw erroPerfilChamador;
    if (!perfilChamador?.is_admin) return json({ ok: false, mensagem: "Sem permissao para isso." }, 403);

    const body = await request.json();
    const action = body?.action;

    if (action === "listar") {
      const { data: perfis, error: erroPerfis } = await admin
        .from("perfis")
        .select("user_id,public_id,nome,avatar_url,show_on_home,created_at")
        .order("created_at", { ascending: false });
      if (erroPerfis) throw erroPerfis;

      const userIds = (perfis || []).map(perfil => perfil.user_id);
      const saldos = new Map<string, number>();
      if (userIds.length) {
        const { data: movimentos, error: erroMovimentos } = await admin
          .from("lancamentos")
          .select("user_id,tipo,valor")
          .in("user_id", userIds);
        if (erroMovimentos) throw erroMovimentos;
        for (const movimento of movimentos || []) {
          const atual = saldos.get(movimento.user_id) || 0;
          const valor = Number(movimento.valor) || 0;
          saldos.set(movimento.user_id, atual + (movimento.tipo === "receita" ? valor : -valor));
        }
      }

      const contas = (perfis || []).map(perfil => ({
        public_id: perfil.public_id,
        nome: perfil.nome,
        avatar_url: perfil.avatar_url,
        show_on_home: perfil.show_on_home,
        created_at: perfil.created_at,
        saldo: saldos.get(perfil.user_id) || 0,
      }));

      return json({ ok: true, contas });
    }

    if (action === "excluir") {
      if (!uuidValido(body.public_id)) return json({ ok: false, mensagem: "Conta invalida." }, 400);

      const { data: alvo, error: erroAlvo } = await admin
        .from("perfis")
        .select("user_id")
        .eq("public_id", body.public_id)
        .maybeSingle();
      if (erroAlvo) throw erroAlvo;
      if (!alvo) return json({ ok: false, mensagem: "Conta nao encontrada." }, 404);

      if (alvo.user_id === chamador.user.id) {
        return json({ ok: false, mensagem: "Use 'Excluir perfil e dados' no seu proprio perfil pra isso." }, 400);
      }

      await admin.storage.from("avatars").remove([
        `${alvo.user_id}/avatar.jpg`,
        `${alvo.user_id}/avatar.png`,
        `${alvo.user_id}/avatar.webp`,
      ]);

      for (const tabela of ["lancamentos", "contas_fixas", "metas", "cartoes_parcelas", "orcamentos", "objetivos_financeiros", "perfis"]) {
        const { error: erroTabela } = await admin.from(tabela).delete().eq("user_id", alvo.user_id);
        if (erroTabela) throw erroTabela;
      }

      const { error: erroExclusao } = await admin.auth.admin.deleteUser(alvo.user_id);
      if (erroExclusao) throw erroExclusao;

      return json({ ok: true });
    }

    return json({ ok: false, mensagem: "Acao desconhecida." }, 400);
  } catch (error) {
    console.error(error);
    return json({ ok: false, mensagem: "Nao foi possivel concluir esta operacao." }, 500);
  }
});
