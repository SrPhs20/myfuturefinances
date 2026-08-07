import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const pinValido = (pin: unknown) => typeof pin === "string" && /^\d{4,8}$/.test(pin);
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

  try {
    const body = await request.json();
    const action = body?.action;

    if (action === "list") {
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter(uuidValido))].slice(0, 20) : [];
      if (!ids.length) return json({ ok: true, contas: [] });

      const { data: perfis, error: erroPerfis } = await admin
        .from("perfis")
        .select("user_id,public_id,nome,avatar_url,pin_length")
        .in("public_id", ids);
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

      const porId = new Map((perfis || []).map(perfil => [perfil.public_id, {
        public_id: perfil.public_id,
        nome: perfil.nome,
        avatar_url: perfil.avatar_url,
        pin_length: perfil.pin_length,
        saldo: saldos.get(perfil.user_id) || 0,
      }]));
      return json({ ok: true, contas: ids.map(id => porId.get(id)).filter(Boolean) });
    }

    if (action === "create") {
      const nome = String(body.nome || "").trim().slice(0, 80);
      const pin = body.pin;
      if (nome.length < 2) return json({ ok: false, mensagem: "Digite seu nome." });
      if (!pinValido(pin)) return json({ ok: false, mensagem: "O PIN deve ter entre 4 e 8 numeros." });

      const identificador = crypto.randomUUID();
      const emailTecnico = `conta.${identificador}@example.com`;
      const senhaTecnica = `Mf!${crypto.randomUUID()}`;
      const { data: criacao, error: erroCriacao } = await admin.auth.admin.createUser({
        email: emailTecnico,
        password: senhaTecnica,
        email_confirm: true,
        user_metadata: { nome },
      });
      if (erroCriacao || !criacao.user) throw erroCriacao || new Error("Conta nao criada.");

      try {
        const { data: perfilCriado, error: erroCriarPerfil } = await admin
          .from("perfis")
          .insert({ user_id: criacao.user.id, nome, avatar_url: "" })
          .select("public_id,nome,avatar_url,pin_length")
          .single();
        if (erroCriarPerfil) throw erroCriarPerfil;

        const { error: erroPin } = await admin.rpc("configurar_pin_conta_admin", {
          p_user_id: criacao.user.id,
          p_pin: pin,
        });
        if (erroPin) throw erroPin;

        const { data: perfil, error: erroPerfil } = await admin.from("perfis")
          .select("public_id,nome,avatar_url,pin_length")
          .eq("public_id", perfilCriado.public_id)
          .single();
        if (erroPerfil) throw erroPerfil;

        const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: emailTecnico,
        });
        if (erroLink || !link?.properties?.hashed_token) throw erroLink || new Error("Acesso nao gerado.");

        return json({ ok: true, conta: { ...perfil, saldo: 0 }, token_hash: link.properties.hashed_token });
      } catch (error) {
        await admin.auth.admin.deleteUser(criacao.user.id);
        throw error;
      }
    }

    if (action === "login") {
      if (!uuidValido(body.public_id) || !pinValido(body.pin)) {
        return json({ ok: false, valido: false, mensagem: "Conta ou PIN invalido." });
      }

      const { data: verificacao, error: erroVerificacao } = await admin.rpc("verificar_pin_conta_admin", {
        p_public_id: body.public_id,
        p_pin: body.pin,
      });
      if (erroVerificacao) throw erroVerificacao;
      if (!verificacao?.valido) return json({ ok: true, ...verificacao });

      const { data: usuario, error: erroUsuario } = await admin.auth.admin.getUserById(verificacao.user_id);
      const emailTecnico = usuario?.user?.email;
      if (erroUsuario || !emailTecnico) throw erroUsuario || new Error("Conta nao encontrada.");

      const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: emailTecnico,
      });
      if (erroLink || !link?.properties?.hashed_token) throw erroLink || new Error("Acesso nao gerado.");

      return json({ ok: true, valido: true, token_hash: link.properties.hashed_token });
    }

    return json({ ok: false, mensagem: "Acao desconhecida." }, 400);
  } catch (error) {
    console.error(error);
    return json({ ok: false, mensagem: "Nao foi possivel concluir esta operacao." }, 500);
  }
});
