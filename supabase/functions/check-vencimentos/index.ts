import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// Checa vencimentos de contas fixas e faturas de cartão e envia notificação
// Web Push (funciona mesmo com o app fechado) para quem ativou o aviso.
// Não é chamada pelo próprio app: é chamada de fora, duas vezes por dia
// (manhã e noite), por um agendador externo (pg_cron, ver migração
// agendamento_notificacoes) — ver README do projeto.
//
// Régua de avisos, por perfil (perfis.notificar_antecedencia_dias = 1, 3 ou
// 5 escolhe a partir de quantos dias antes começar a avisar):
//   - Checkpoints fixos: 5, 3 e 1 dia(s) antes e no dia do vencimento — só os
//     que estiverem dentro da antecedência escolhida.
//   - Vencida: todo dia, sem parar, enquanto não for marcada como paga —
//     isso NÃO depende da antecedência escolhida.
//   - Toda manhã: avisa tudo que bateu em algum checkpoint hoje.
//   - Toda noite: reforço extra só do que vence hoje/amanhã ou já venceu.
//
// Conta fixa vinculada a um cartão (paga "no cartão" em vez de em dinheiro):
// os avisos de 5/3/1 dia antes são iguais aos de qualquer conta. No dia do
// vencimento, em vez do aviso genérico, avisa que o valor vai entrar na
// fatura do cartão — e SÓ continua cobrando (aviso de "vencida" todo dia)
// se o cartão não tiver limite suficiente pra cobrir (mesma regra que a aba
// Cartões usa pra decidir "No cartão" vs "Vencida").

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

type ContaFixa = { id: number; nome: string; valor: number; vencimento: string; cartao_id: number | null };
type Cartao = { id: number; nome: string; dia_vencimento: number; limite: number | null };
type Parcela = { cartao_id: number | null; valor_total: number; total_parcelas: number; parcelas_pagas: number };

// Mesma conta de "limite usado" que a aba Cartões faz no app (calcularUsoCartoes
// em script.js), pra bater exatamente com o que a pessoa vê na tela: soma das
// contas fixas vinculadas que já venceram (entraram na fatura atual) + o que
// falta pagar das compras parceladas daquele cartão.
function calcularUsoPorCartao(cartoes: Cartao[], contasFixas: ContaFixa[], parcelas: Parcela[], hojeISO: string) {
  const mapa = new Map<number, { usoTotal: number; temLimite: boolean; limite: number | null; estourado: boolean }>();

  for (const cartao of cartoes) {
    const totalContasNaFaturaAtual = contasFixas
      .filter(conta => conta.cartao_id === cartao.id && conta.vencimento <= hojeISO)
      .reduce((total, conta) => total + Number(conta.valor), 0);

    const totalParcelasAberto = parcelas
      .filter(item => item.cartao_id === cartao.id && Number(item.parcelas_pagas) < Number(item.total_parcelas))
      .reduce((total, item) => {
        const valorParcela = Number(item.valor_total) / Number(item.total_parcelas);
        const restantes = Number(item.total_parcelas) - Number(item.parcelas_pagas);
        return total + valorParcela * restantes;
      }, 0);

    const usoTotal = totalContasNaFaturaAtual + totalParcelasAberto;
    const temLimite = cartao.limite !== null && cartao.limite !== undefined;
    const limite = temLimite ? Number(cartao.limite) : null;
    const estourado = temLimite && usoTotal > (limite as number);

    mapa.set(cartao.id, { usoTotal, temLimite, limite, estourado });
  }

  return mapa;
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
    const checkpoints = [5, 3, 1, 0].filter(dias => dias <= antecedencia);

    const [{ data: contasFixasRaw }, { data: cartoesRaw }, { data: parcelasRaw }] = await Promise.all([
      admin.from("contas_fixas").select("id, nome, valor, vencimento, cartao_id").eq("user_id", perfil.user_id),
      admin.from("cartoes").select("id, nome, dia_vencimento, limite").eq("user_id", perfil.user_id),
      admin.from("cartoes_parcelas").select("cartao_id, valor_total, total_parcelas, parcelas_pagas").eq("user_id", perfil.user_id),
    ]);

    const contasFixas = (contasFixasRaw || []) as ContaFixa[];
    const cartoes = (cartoesRaw || []) as Cartao[];
    const parcelas = (parcelasRaw || []) as Parcela[];
    const usoPorCartao = calcularUsoPorCartao(cartoes, contasFixas, parcelas, hojeISO);

    const itens: { nome: string; dias: number }[] = [];

    for (const conta of contasFixas) {
      const dias = diasAte(conta.vencimento, hojeISO);
      const cartaoVinculado = conta.cartao_id ? cartoes.find(c => c.id === conta.cartao_id) : null;

      if (dias > 0) {
        // Antes do vencimento: mesma régua de checkpoints pra todas as
        // contas, tenham cartão vinculado ou não.
        if (checkpoints.includes(dias)) itens.push({ nome: conta.nome, dias });
        continue;
      }

      if (dias === 0) {
        if (!checkpoints.includes(0)) continue;
        if (!cartaoVinculado) {
          itens.push({ nome: conta.nome, dias: 0 });
          continue;
        }
        const uso = usoPorCartao.get(cartaoVinculado.id);
        if (!uso || !uso.temLimite || uso.estourado) {
          itens.push({ nome: `${conta.nome} (cartão ${cartaoVinculado.nome} — confira o limite)`, dias: 0 });
        } else {
          itens.push({ nome: `${conta.nome} (cobrado no cartão ${cartaoVinculado.nome} hoje)`, dias: 0 });
        }
        continue;
      }

      // dias < 0: vencida. Sem cartão, avisa todo dia até ser paga. Com
      // cartão, só continua avisando se o cartão não tiver limite pra cobrir
      // (senão o valor já foi absorvido pela fatura, mesma regra da aba
      // Cartões).
      if (!cartaoVinculado) {
        itens.push({ nome: conta.nome, dias });
        continue;
      }
      const uso = usoPorCartao.get(cartaoVinculado.id);
      if (!uso || !uso.temLimite || uso.estourado) {
        itens.push({ nome: `${conta.nome} (cartão ${cartaoVinculado.nome} sem limite pra cobrir)`, dias });
      }
    }

    for (const cartao of cartoes) {
      const proxima = proximoVencimentoCartao(Number(cartao.dia_vencimento), agora);
      const dias = diasAte(proxima, hojeISO);
      if (checkpoints.includes(dias)) itens.push({ nome: `Fatura ${cartao.nome}`, dias });
    }

    const itensDoEnvio = periodo === "noite" ? itens.filter(item => item.dias <= 1) : itens;
    if (!itensDoEnvio.length) continue;

    const { data: assinaturas } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", perfil.user_id);
    if (!assinaturas || !assinaturas.length) continue;

    itensDoEnvio.sort((a, b) => a.dias - b.dias);
    const rotuloDias = (dias: number) => dias < 0
      ? "vencida"
      : dias === 0
        ? "vence hoje"
        : `vence em ${dias} dia(s)`;
    const titulo = itensDoEnvio.length === 1
      ? `${itensDoEnvio[0].nome} ${rotuloDias(itensDoEnvio[0].dias)}`
      : `${itensDoEnvio.length} avisos de vencimento`;
    const corpo = itensDoEnvio
      .map(item => `${item.nome} — ${rotuloDias(item.dias)}`)
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
