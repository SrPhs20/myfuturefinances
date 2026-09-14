import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Checa vencimentos de contas fixas e faturas de cartão e envia notificação
// Web Push (funciona mesmo com o app fechado) para quem ativou o aviso.
// Não é chamada pelo próprio app: é chamada de fora, duas vezes por dia
// (manhã e noite), por um agendador externo — ver README do projeto.
//
// Regra de disparo, por perfil (perfis.notificar_antecedencia_dias = N):
//   - Toda manhã: avisa qualquer conta/fatura com 0 a N dias até o vencimento.
//   - Toda noite: avisa só o que vence hoje ou amanhã (0 ou 1 dia) — reforço
//     extra perto do prazo, além do aviso da manhã.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function diasAte(dataISO: string, hojeISO: string): number {
  const alvo = new Date(`${dataISO}T00:00:00`).getTime();
  const hoje = new Date(`${hojeISO}T00:00:00`).getTime();
  return Math.round((alvo - hoje) / 86400000);
}

function proximoVencimentoCartao(diaVencimento: number, hoje: Date): string {
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const diaHoje = hoje.getDate();
  const ultimoDiaMesAtual = new Date(ano, mes + 1, 0).getDate();
  const diaAlvoMesAtual = Math.min(diaVencimento, ultimoDiaMesAtual);

  let candidato = new Date(ano, mes, diaAlvoMesAtual);
  if (diaHoje > diaAlvoMesAtual) {
    const ultimoDiaProximoMes = new Date(ano, mes + 2, 0).getDate();
    candidato = new Date(ano, mes + 1, Math.min(diaVencimento, ultimoDiaProximoMes));
  }
  return candidato.toISOString().slice(0, 10);
}

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

  let periodo = "manha";
  try {
    const body = await request.json();
    if (body?.periodo === "noite") periodo = "noite";
  } catch {
    // corpo vazio/ausente: assume "manha".
  }

  const agora = new Date();
  const hojeISO = agora.toISOString().slice(0, 10);

  const { data: perfis, error: erroPerfis } = await admin
    .from("perfis")
    .select("user_id, notificar_antecedencia_dias")
    .eq("notificar_vencimentos", true);
  if (erroPerfis) return json({ ok: false, mensagem: erroPerfis.message }, 500);

  let notificacoesEnviadas = 0;
  let assinaturasRemovidas = 0;
  let perfisAvisados = 0;

  for (const perfil of perfis || []) {
    const antecedencia = Number(perfil.notificar_antecedencia_dias) || 3;

    const [{ data: contas }, { data: cartoes }] = await Promise.all([
      admin.from("contas_fixas").select("nome, vencimento").eq("user_id", perfil.user_id),
      admin.from("cartoes").select("nome, dia_vencimento").eq("user_id", perfil.user_id),
    ]);

    const itens: { nome: string; dias: number }[] = [];

    for (const conta of contas || []) {
      const dias = diasAte(conta.vencimento, hojeISO);
      if (dias >= 0 && dias <= antecedencia) itens.push({ nome: conta.nome, dias });
    }
    for (const cartao of cartoes || []) {
      const proxima = proximoVencimentoCartao(Number(cartao.dia_vencimento), agora);
      const dias = diasAte(proxima, hojeISO);
      if (dias >= 0 && dias <= antecedencia) itens.push({ nome: `Fatura ${cartao.nome}`, dias });
    }

    const itensDoEnvio = periodo === "noite" ? itens.filter(item => item.dias <= 1) : itens;
    if (!itensDoEnvio.length) continue;

    const { data: assinaturas } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", perfil.user_id);
    if (!assinaturas || !assinaturas.length) continue;

    itensDoEnvio.sort((a, b) => a.dias - b.dias);
    const titulo = itensDoEnvio.length === 1
      ? `${itensDoEnvio[0].nome} ${itensDoEnvio[0].dias === 0 ? "vence hoje" : `vence em ${itensDoEnvio[0].dias} dia(s)`}`
      : `${itensDoEnvio.length} vencimentos próximos`;
    const corpo = itensDoEnvio
      .map(item => `${item.nome} — ${item.dias === 0 ? "hoje" : `em ${item.dias} dia(s)`}`)
      .join(" · ");

    const payload = JSON.stringify({ title: titulo, body: corpo });
    let avisouEsteperfil = false;

    for (const assinatura of assinaturas) {
      try {
        await webpush.sendNotification(
          { endpoint: assinatura.endpoint, keys: { p256dh: assinatura.p256dh, auth: assinatura.auth } },
          payload
        );
        notificacoesEnviadas++;
        avisouEsteperfil = true;
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

    if (avisouEsteperfil) perfisAvisados++;
  }

  return json({ ok: true, periodo, perfisAvisados, notificacoesEnviadas, assinaturasRemovidas });
});
