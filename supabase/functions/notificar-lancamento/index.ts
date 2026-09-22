import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Avisa (Web Push) TODAS as outras contas do aplicativo sempre que uma conta
// cria um novo lançamento — é um aviso geral entre amigos: quem lançou não
// recebe o próprio aviso, mas qualquer outra conta com notificações ativadas
// recebe, com o nome de quem lançou, categoria, descrição e valor. Chamada
// automaticamente por um trigger no banco (ver migração
// notificar_lancamentos_grupo), nunca direto pelo app.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const formatarMoeda = (valor: number) => valor.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL",
});

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, mensagem: "Metodo nao permitido." }, 405);

  const cronSecret = Deno.env.get("CRON_SECRET");
  const autorizacao = request.headers.get("authorization") || "";
  if (!cronSecret || autorizacao !== `Bearer ${cronSecret}`) {
    return json({ ok: false, mensagem: "Nao autorizado." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return json({ ok: false, mensagem: "Servico nao configurado (faltam variaveis de ambiente)." }, 500);
  }

  webpush.setVapidDetails("mailto:suporte@myfuturefinances.vercel.app", vapidPublicKey, vapidPrivateKey);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return json({ ok: false, mensagem: "Corpo invalido." }, 400);
  }

  const autorUserId = String(corpo?.autor_user_id || "");
  const autorNome = String(corpo?.autor_nome || "").trim() || "Alguém";
  const quantidade = Number(corpo?.quantidade) || 1;
  if (!autorUserId) return json({ ok: false, mensagem: "autor_user_id ausente." }, 400);

  // Todas as contas do app com notificações ativadas, EXCETO a de quem
  // acabou de lançar (ela não precisa de aviso do próprio lançamento).
  const { data: assinaturas, error: erroAssinaturas } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .neq("user_id", autorUserId);
  if (erroAssinaturas) return json({ ok: false, mensagem: erroAssinaturas.message }, 500);
  if (!assinaturas || !assinaturas.length) return json({ ok: true, notificacoesEnviadas: 0 });

  let titulo: string;
  let mensagem: string;

  if (quantidade > 1) {
    titulo = `📋 ${autorNome} mexeu no app`;
    mensagem = `${autorNome} adicionou ${quantidade} lançamentos novos de uma vez.`;
  } else {
    const tipo = String(corpo?.tipo || "despesa");
    const categoria = String(corpo?.categoria || "Sem categoria");
    const descricao = String(corpo?.descricao || "").trim();
    const valor = Number(corpo?.valor) || 0;

    titulo = tipo === "receita" ? `💰 ${autorNome} recebeu uma receita` : `💸 ${autorNome} fez um gasto novo`;
    mensagem = `${formatarMoeda(valor)} em ${categoria}${descricao ? ` — ${descricao}` : ""}`;
  }

  const payload = JSON.stringify({ title: titulo, body: mensagem });

  let notificacoesEnviadas = 0;
  let assinaturasRemovidas = 0;

  for (const assinatura of assinaturas) {
    try {
      await webpush.sendNotification(
        { endpoint: assinatura.endpoint, keys: { p256dh: assinatura.p256dh, auth: assinatura.auth } },
        payload
      );
      notificacoesEnviadas++;
    } catch (erroEnvio) {
      const status = (erroEnvio as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", assinatura.id);
        assinaturasRemovidas++;
      } else {
        console.error("Falha ao enviar push:", erroEnvio);
      }
    }
  }

  return json({ ok: true, notificacoesEnviadas, assinaturasRemovidas });
});
