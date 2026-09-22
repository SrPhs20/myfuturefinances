import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Avisa (Web Push) todos os dispositivos inscritos num perfil sempre que um
// novo lançamento é criado nele — como um mesmo perfil pode ser acessado por
// vários amigos que sabem o PIN, isso funciona como um aviso pro grupo
// inteiro. Chamada automaticamente por um trigger no banco (ver migração
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

  const userId = String(corpo?.user_id || "");
  const quantidade = Number(corpo?.quantidade) || 1;
  if (!userId) return json({ ok: false, mensagem: "user_id ausente." }, 400);

  const { data: assinaturas, error: erroAssinaturas } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (erroAssinaturas) return json({ ok: false, mensagem: erroAssinaturas.message }, 500);
  if (!assinaturas || !assinaturas.length) return json({ ok: true, notificacoesEnviadas: 0 });

  let titulo: string;
  let mensagem: string;

  if (quantidade > 1) {
    titulo = "📋 Vários lançamentos novos";
    mensagem = `${quantidade} lançamentos foram adicionados de uma vez. Dá uma conferida no app.`;
  } else {
    const tipo = String(corpo?.tipo || "despesa");
    const categoria = String(corpo?.categoria || "Sem categoria");
    const descricao = String(corpo?.descricao || "").trim();
    const valor = Number(corpo?.valor) || 0;

    titulo = tipo === "receita" ? "💰 Chegou dinheiro novo" : "💸 Rolou um gasto novo";
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
