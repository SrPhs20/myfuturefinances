const SUPABASE_URL = "https://hjafylznpribmpumcgtk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqYWZ5bHpucHJpYm1wdW1jZ3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMzA1NzcsImV4cCI6MjA5NjcwNjU3N30.a1Tg7EAsusekhQ3gdUopSE4b0MDSbP-YQEiv3khQeI4";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const COLUNAS_PERFIL = "id,user_id,public_id,nome,avatar_url,created_at,updated_at,pin_length";
const CONTAS_DISPOSITIVO_KEY = "myfuturefinances:contas:v1";

let usuarioAtual = null;
let lancamentos = [];
let contasFixas = [];
let gruposContas = [];
let metaMensal = 0;
let metasMensais = [];
let perfilAtual = null;
let cartoesParcelados = [];
let orcamentos = [];
let objetivosFinanceiros = [];
let mesDashboard = null;

let editandoId = null;
let calendarioData;
let calendarioVencimento;
let editandoCartaoId = null;
let calendarioCartaoPrimeiraParcela;
let editandoContaFixaId = null;
let editandoOrcamentoId = null;
let editandoObjetivoId = null;
let filtroCompromissos = "mes";
let compromissosExpandidos = false;
let validandoPin = false;
let temporizadorBloqueioPin = null;
let contasDispositivo = [];
let modoMigracaoConta = false;

const appContainer = document.querySelector(".container");
appContainer.classList.add("hidden");

document.body.insertAdjacentHTML("afterbegin", `
<section id="authScreen" class="auth-screen">
  <div class="money-orbit money-orbit-one" aria-hidden="true">R$</div>
  <div class="money-orbit money-orbit-two" aria-hidden="true">+</div>

  <div class="account-chooser hidden" id="accountChooser">
    <div class="gate-brand"><span>R$</span><strong>Minhas Finanças</strong></div>
    <span class="chooser-eyebrow">Seu dinheiro. Suas escolhas.</span>
    <h1>Quem vai entrar?</h1>
    <p>Escolha uma conta para ver sua vida financeira.</p>
    <div id="accountsGrid" class="accounts-grid"></div>
    <button class="add-account-button" type="button" onclick="abrirCriacaoConta()">
      <span aria-hidden="true">+</span>
      <strong>Criar conta</strong>
    </button>
    <p id="chooserMessage" class="chooser-message" aria-live="polite"></p>
  </div>

  <div class="account-create hidden" id="accountCreate">
    <button class="create-back" type="button" onclick="fecharCriacaoConta()" aria-label="Voltar">←</button>
    <div class="gate-brand"><span>R$</span><strong>Minhas Finanças</strong></div>
    <span class="chooser-eyebrow">Novo perfil</span>
    <h1>Crie sua conta</h1>
    <p>Você só precisa de uma foto, seu nome e um PIN numérico.</p>

    <label class="create-avatar-picker" for="novaContaFoto">
      <span class="create-avatar-preview">
        <img id="novaContaFotoPreview" class="hidden" alt="Prévia da foto" />
        <span id="novaContaFotoPlaceholder">+</span>
      </span>
      <strong>Escolher foto</strong>
    </label>
    <input id="novaContaFoto" class="hidden" type="file" accept="image/jpeg,image/png,image/webp" onchange="mostrarPreviewNovaConta(this)" />

    <div class="create-fields">
      <label for="novaContaNome">Seu nome</label>
      <input id="novaContaNome" type="text" maxlength="80" autocomplete="name" placeholder="Como quer ser chamado?" />
      <label for="novaContaPin">Crie uma senha numérica</label>
      <input id="novaContaPin" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="new-password" placeholder="4 a 8 números" oninput="limitarCampoPin(this)" />
      <label for="novaContaPinConfirmacao">Confirme a senha</label>
      <input id="novaContaPinConfirmacao" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="new-password" placeholder="Repita os números" oninput="limitarCampoPin(this)" />
      <button id="botaoCriarConta" type="button" onclick="criarContaPorPerfil()">Criar minha conta</button>
      <p id="createAccountMessage" class="pin-message" aria-live="polite"></p>
    </div>
  </div>

  <div class="profile-gate hidden" id="profileGate">
    <div class="gate-brand"><span>R$</span><strong>Minhas Finanças</strong></div>
    <p class="gate-kicker">Quem está cuidando do futuro hoje?</p>

    <button id="gateAvatarButton" class="gate-avatar-button" type="button" onclick="abrirEntradaPin()" aria-label="Entrar no perfil">
      <span class="gate-avatar-ring">
        <img id="gateAvatar" class="hidden" alt="Foto do perfil" />
        <span id="gateInitials" class="gate-initials">MF</span>
      </span>
      <span class="gate-enter-badge" aria-hidden="true">→</span>
    </button>

    <h1 id="gateName">Meu perfil</h1>
    <div class="gate-balance">
      <span>Saldo atual</span>
      <strong id="gateBalance">R$ 0,00</strong>
      <small>Visível neste dispositivo</small>
    </div>
    <p id="gateHint" class="gate-hint">Toque na foto para entrar</p>

    <div id="pinPanel" class="pin-panel hidden">
      <label for="pinAcesso">Digite seu PIN</label>
      <input id="pinAcesso" class="pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" aria-describedby="pinMensagem" oninput="processarPin(this)" />
      <div id="pinDots" class="pin-dots" aria-hidden="true"></div>
      <p id="pinMensagem" class="pin-message" aria-live="polite">A entrada acontece automaticamente.</p>
    </div>

    <div id="pinSetup" class="pin-setup hidden">
      <span class="setup-pill">Primeiro acesso</span>
      <h2>Crie seu PIN</h2>
      <p>Escolha de 4 a 8 números. Ele será pedido sempre que o aplicativo abrir.</p>
      <label for="novoPinGate">Novo PIN</label>
      <input id="novoPinGate" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="new-password" placeholder="4 a 8 números" oninput="limitarCampoPin(this)" />
      <label for="confirmarPinGate">Confirme o PIN</label>
      <input id="confirmarPinGate" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="new-password" placeholder="Repita os números" oninput="limitarCampoPin(this)" />
      <button type="button" onclick="configurarPinInicial()">Criar PIN e entrar</button>
      <p id="pinSetupMensagem" class="pin-message" aria-live="polite"></p>
    </div>

    <button class="gate-switch" type="button" onclick="voltarParaContas()">← Voltar para as contas</button>
  </div>
</section>
`);

appContainer.insertAdjacentHTML("afterbegin", `
  <div class="user-bar">
    <div class="profile-preview">
      <img id="fotoPerfilTopo" class="profile-avatar hidden" />
      <span id="usuarioLogado"></span>
    </div>

    <div class="profile-actions">
      <button class="secondary small-button" onclick="abrirPerfil()">Editar perfil</button>
      <button class="secondary small-button" onclick="sair()">Sair</button>
    </div>
  </div>

  <div id="modalPerfil" class="profile-modal hidden">
    <div class="profile-card">
      <h2>Meu perfil</h2>

      <label>Nome</label>
      <input id="perfilNome" type="text" placeholder="Seu nome" />

      <label>Nova foto</label>
      <input id="perfilFoto" type="file" accept="image/*" />

      <img id="previewPerfil" class="profile-avatar-large hidden" />

      <div class="profile-pin-settings">
        <span class="eyebrow">Segurança do aplicativo</span>
        <h3>Alterar PIN de acesso</h3>
        <p>Deixe em branco para manter o PIN atual.</p>
        <label for="perfilNovoPin">Novo PIN</label>
        <input id="perfilNovoPin" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="new-password" placeholder="4 a 8 números" oninput="limitarCampoPin(this)" />
        <label for="perfilConfirmarPin">Confirme o novo PIN</label>
        <input id="perfilConfirmarPin" type="password" inputmode="numeric" pattern="[0-9]*" minlength="4" maxlength="8" autocomplete="new-password" placeholder="Repita os números" oninput="limitarCampoPin(this)" />
      </div>

      <button onclick="salvarPerfil()">Salvar perfil</button>
      <button class="danger" onclick="excluirPerfil()">Excluir perfil e dados</button>
      <button class="secondary" onclick="fecharPerfil()">Fechar</button>
    </div>
  </div>
`);

const authScreen = document.getElementById("authScreen");
const form = document.getElementById("form");
const lista = document.getElementById("lista");
const formContaFixa = document.getElementById("formContaFixa");
const botaoContaFixa = document.getElementById("botaoContaFixa");
const botaoCancelarEdicaoContaFixa =
  document.getElementById("cancelarEdicaoContaFixa");

if (botaoCancelarEdicaoContaFixa) {
  botaoCancelarEdicaoContaFixa.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    cancelarEdicaoContaFixa();
  });
}
const botaoLancamento = document.getElementById("botaoLancamento");
const avisoEdicao = document.getElementById("avisoEdicao");

function hojeTexto() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function primeiroDiaMesAtual() {
  return `${hojeTexto().slice(0, 7)}-01`;
}

function escaparHTML(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mensagemErro(error, fallback) {
  console.error(error);
  return error?.message || fallback;
}

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatarData(data) {
  if (!data) return "";
  const partes = data.split("-");
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function mostrarMensagemAuth(texto) {
  document.getElementById("chooserMessage").textContent = texto || "";
}

function limitarCampoPin(campo) {
  campo.value = campo.value.replace(/\D/g, "").slice(0, 8);
}

function saldoAtualDoPerfil() {
  return lancamentos.reduce((saldo, item) => {
    const valor = Number(item.valor) || 0;
    return saldo + (item.tipo === "receita" ? valor : -valor);
  }, 0);
}

function iniciaisDoPerfil(nome) {
  const partes = String(nome || "MF").trim().split(/\s+/).filter(Boolean);
  return (partes.length > 1 ? `${partes[0][0]}${partes.at(-1)[0]}` : partes[0]?.slice(0, 2) || "MF").toUpperCase();
}

function idsContasLembradas() {
  try {
    const ids = JSON.parse(localStorage.getItem(CONTAS_DISPOSITIVO_KEY) || "[]");
    return Array.isArray(ids) ? [...new Set(ids.filter(id => typeof id === "string"))].slice(0, 20) : [];
  } catch {
    return [];
  }
}

function salvarIdsContas(ids) {
  localStorage.setItem(CONTAS_DISPOSITIVO_KEY, JSON.stringify([...new Set(ids)].slice(0, 20)));
}

function lembrarConta(publicId) {
  if (!publicId) return;
  salvarIdsContas([publicId, ...idsContasLembradas().filter(id => id !== publicId)]);
}

async function chamarAcessoPerfis(body) {
  const { data, error } = await supabaseClient.functions.invoke("profile-access", { body });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.mensagem || "Não foi possível concluir esta operação.");
  return data;
}

function cardContaHTML(conta) {
  const id = escaparHTML(conta.public_id);
  const nome = escaparHTML(conta.nome || "Minha conta");
  const avatar = conta.avatar_url
    ? `<img src="${escaparHTML(conta.avatar_url)}" alt="Foto de ${nome}" />`
    : `<span>${escaparHTML(iniciaisDoPerfil(conta.nome))}</span>`;
  const remover = conta.show_on_home ? "" : `<button class="forget-account" type="button" onclick="removerContaDesteAparelho('${id}', event)" aria-label="Remover ${nome} deste aparelho" title="Remover deste aparelho">×</button>`;
  return `<article class="account-profile">
    <button class="account-profile-main" type="button" onclick="selecionarConta('${id}')" aria-label="Entrar na conta de ${nome}">
      <span class="account-profile-avatar">${avatar}</span>
      <strong>${nome}</strong>
      <small>Saldo atual</small>
      <b>${formatarMoeda(conta.saldo)}</b>
    </button>
    ${remover}
  </article>`;
}

async function carregarContasDoDispositivo() {
  const grade = document.getElementById("accountsGrid");
  const ids = idsContasLembradas();
  contasDispositivo = [];

  grade.innerHTML = '<div class="accounts-loading"><span></span><p>Carregando contas…</p></div>';
  try {
    const resposta = await chamarAcessoPerfis({ action: "list", ids });
    contasDispositivo = resposta.contas || [];
    salvarIdsContas(contasDispositivo.map(conta => conta.public_id));
    grade.innerHTML = contasDispositivo.length
      ? contasDispositivo.map(cardContaHTML).join("")
      : '<div class="chooser-empty"><span>R$</span><strong>Nenhuma conta encontrada</strong><p>Você pode criar uma nova conta.</p></div>';
  } catch (error) {
    grade.innerHTML = '<div class="chooser-empty"><strong>Não foi possível carregar as contas.</strong><p>Tente atualizar a página.</p></div>';
    mostrarMensagemAuth(mensagemErro(error, "Não foi possível carregar as contas."));
  }
}

async function mostrarSeletorContas() {
  clearInterval(temporizadorBloqueioPin);
  validandoPin = false;
  modoMigracaoConta = false;
  appContainer.classList.add("hidden");
  document.getElementById("profileGate").classList.add("hidden");
  document.getElementById("accountCreate").classList.add("hidden");
  document.getElementById("accountChooser").classList.remove("hidden");
  authScreen.classList.remove("hidden");
  mostrarMensagemAuth("");
  await carregarContasDoDispositivo();
}

function selecionarConta(publicId) {
  const conta = contasDispositivo.find(item => item.public_id === publicId);
  if (!conta) return;
  perfilAtual = { ...conta };
  prepararTelaDoPerfil();
  abrirEntradaPin();
}

async function removerContaDesteAparelho(publicId, event) {
  event?.stopPropagation();
  salvarIdsContas(idsContasLembradas().filter(id => id !== publicId));
  await carregarContasDoDispositivo();
}

function voltarParaContas() {
  clearInterval(temporizadorBloqueioPin);
  document.getElementById("pinAcesso").value = "";
  document.getElementById("profileGate").classList.add("hidden");
  document.getElementById("accountChooser").classList.remove("hidden");
  perfilAtual = null;
  validandoPin = false;
}

function abrirCriacaoConta() {
  document.getElementById("accountChooser").classList.add("hidden");
  document.getElementById("accountCreate").classList.remove("hidden");
  document.getElementById("novaContaNome").focus();
}

function fecharCriacaoConta() {
  document.getElementById("accountCreate").classList.add("hidden");
  document.getElementById("accountChooser").classList.remove("hidden");
  document.getElementById("createAccountMessage").textContent = "";
}

function mostrarPreviewNovaConta(campo) {
  const arquivo = campo.files?.[0];
  const preview = document.getElementById("novaContaFotoPreview");
  const placeholder = document.getElementById("novaContaFotoPlaceholder");
  if (!arquivo) {
    preview.classList.add("hidden");
    placeholder.classList.remove("hidden");
    return;
  }
  preview.src = URL.createObjectURL(arquivo);
  preview.classList.remove("hidden");
  placeholder.classList.add("hidden");
}

async function criarContaPorPerfil() {
  const nome = document.getElementById("novaContaNome").value.trim();
  const pin = document.getElementById("novaContaPin").value;
  const confirmacao = document.getElementById("novaContaPinConfirmacao").value;
  const foto = document.getElementById("novaContaFoto").files?.[0];
  const mensagem = document.getElementById("createAccountMessage");
  const botao = document.getElementById("botaoCriarConta");

  if (nome.length < 2) return mensagem.textContent = "Digite seu nome.";
  if (!/^\d{4,8}$/.test(pin)) return mensagem.textContent = "Crie uma senha com 4 a 8 números.";
  if (pin !== confirmacao) return mensagem.textContent = "As duas senhas precisam ser iguais.";
  if (foto && !foto.type.startsWith("image/")) return mensagem.textContent = "Escolha uma foto válida.";

  botao.disabled = true;
  mensagem.textContent = "Criando seu perfil…";
  try {
    const resposta = await chamarAcessoPerfis({ action: "create", nome, pin });
    lembrarConta(resposta.conta.public_id);
    const { data: autenticacao, error: erroAutenticacao } = await supabaseClient.auth.verifyOtp({
      token_hash: resposta.token_hash,
      type: "email"
    });
    if (erroAutenticacao || !autenticacao.user) throw erroAutenticacao || new Error("Conta não autenticada.");

    usuarioAtual = autenticacao.user;
    let avatarUrl = "";
    if (foto) {
      try {
        mensagem.textContent = "Preparando sua foto…";
        const imagem = await prepararImagemPerfil(foto);
        const caminho = `${usuarioAtual.id}/avatar.jpg`;
        const { error: erroUpload } = await supabaseClient.storage.from("avatars")
          .upload(caminho, imagem, { contentType: "image/jpeg", upsert: true });
        if (erroUpload) throw erroUpload;
        const { data: urlPublica } = supabaseClient.storage.from("avatars").getPublicUrl(caminho);
        avatarUrl = `${urlPublica.publicUrl}?v=${Date.now()}`;
        const { error: erroPerfil } = await supabaseClient.from("perfis")
          .update({ avatar_url: avatarUrl })
          .eq("user_id", usuarioAtual.id);
        if (erroPerfil) throw erroPerfil;
      } catch (erroFoto) {
        console.warn("Conta criada sem foto:", erroFoto);
      }
    }

    await supabaseClient.auth.signOut({ scope: "local" });
    usuarioAtual = null;
    document.getElementById("novaContaNome").value = "";
    document.getElementById("novaContaPin").value = "";
    document.getElementById("novaContaPinConfirmacao").value = "";
    document.getElementById("novaContaFoto").value = "";
    document.getElementById("novaContaFotoPreview").classList.add("hidden");
    document.getElementById("novaContaFotoPlaceholder").classList.remove("hidden");
    fecharCriacaoConta();
    await carregarContasDoDispositivo();
  } catch (error) {
    mensagem.textContent = mensagemErro(error, "Não foi possível criar a conta.");
  } finally {
    botao.disabled = false;
  }
}

function prepararTelaDoPerfil() {
  const nome = perfilAtual?.nome || usuarioAtual?.email?.split("@")[0] || "Meu perfil";
  const avatar = perfilAtual?.avatar_url || "";
  const gateAvatar = document.getElementById("gateAvatar");
  const gateInitials = document.getElementById("gateInitials");

  document.getElementById("gateName").textContent = nome;
  const saldoExibido = Object.hasOwn(perfilAtual || {}, "saldo") ? Number(perfilAtual.saldo) : saldoAtualDoPerfil();
  document.getElementById("gateBalance").textContent = formatarMoeda(saldoExibido);
  gateInitials.textContent = iniciaisDoPerfil(nome);

  if (avatar) {
    gateAvatar.src = avatar;
    gateAvatar.classList.remove("hidden");
    gateInitials.classList.add("hidden");
  } else {
    gateAvatar.removeAttribute("src");
    gateAvatar.classList.add("hidden");
    gateInitials.classList.remove("hidden");
  }

  document.getElementById("accountChooser").classList.add("hidden");
  document.getElementById("accountCreate").classList.add("hidden");
  document.getElementById("profileGate").classList.remove("hidden", "unlocking", "pin-error");
  document.getElementById("pinPanel").classList.add("hidden");
  document.getElementById("gateHint").classList.remove("hidden");
  document.getElementById("pinMensagem").textContent = "A entrada acontece automaticamente.";
  document.getElementById("pinAcesso").value = "";

  const possuiPin = Number(perfilAtual?.pin_length) >= 4;
  document.getElementById("pinSetup").classList.toggle("hidden", possuiPin);
  document.querySelector("#profileGate .gate-switch").classList.toggle("hidden", !possuiPin && modoMigracaoConta);
  document.getElementById("gateHint").textContent = possuiPin
    ? "Toque na foto para entrar"
    : "Crie um PIN para proteger este perfil";

  atualizarPontosPin(0);
  appContainer.classList.add("hidden");
  authScreen.classList.remove("hidden");
}

function atualizarPontosPin(preenchidos) {
  const quantidade = Math.max(4, Math.min(8, Number(perfilAtual?.pin_length) || 4));
  document.getElementById("pinDots").innerHTML = Array.from({ length: quantidade }, (_, indice) =>
    `<span class="${indice < preenchidos ? "filled" : ""}"></span>`
  ).join("");
}

function abrirEntradaPin() {
  if (Number(perfilAtual?.pin_length) < 4) {
    document.getElementById("novoPinGate").focus();
    return;
  }

  document.getElementById("gateHint").classList.add("hidden");
  document.getElementById("pinPanel").classList.remove("hidden");
  const campo = document.getElementById("pinAcesso");
  campo.maxLength = Number(perfilAtual.pin_length);
  campo.focus({ preventScroll: true });
}

async function processarPin(campo) {
  limitarCampoPin(campo);
  atualizarPontosPin(campo.value.length);

  const tamanhoPin = Number(perfilAtual?.pin_length) || 0;
  if (!validandoPin && tamanhoPin && campo.value.length === tamanhoPin) {
    await validarPinDigitado(campo.value);
  }
}

function iniciarContagemBloqueioPin(segundos) {
  clearInterval(temporizadorBloqueioPin);
  const campo = document.getElementById("pinAcesso");
  const mensagem = document.getElementById("pinMensagem");
  let restante = Math.max(1, Number(segundos) || 30);
  campo.disabled = true;

  const atualizar = () => {
    mensagem.textContent = `Muitas tentativas. Tente novamente em ${restante}s.`;
    restante -= 1;
    if (restante < 0) {
      clearInterval(temporizadorBloqueioPin);
      campo.disabled = false;
      campo.value = "";
      atualizarPontosPin(0);
      mensagem.textContent = "Digite seu PIN novamente.";
      campo.focus();
    }
  };

  atualizar();
  temporizadorBloqueioPin = setInterval(atualizar, 1000);
}

async function validarPinDigitado(pin) {
  validandoPin = true;
  const campo = document.getElementById("pinAcesso");
  const mensagem = document.getElementById("pinMensagem");
  mensagem.textContent = "Verificando…";

  let data;
  try {
    data = await chamarAcessoPerfis({ action: "login", public_id: perfilAtual.public_id, pin });
  } catch (error) {
    validandoPin = false;
    campo.value = "";
    atualizarPontosPin(0);
    mensagem.textContent = mensagemErro(error, "Não foi possível verificar o PIN.");
    return;
  }

  if (data?.valido) {
    mensagem.textContent = "Abrindo sua conta…";
    const { data: autenticacao, error: erroAutenticacao } = await supabaseClient.auth.verifyOtp({
      token_hash: data.token_hash,
      type: "email"
    });
    if (erroAutenticacao || !autenticacao.user) {
      validandoPin = false;
      campo.value = "";
      atualizarPontosPin(0);
      mensagem.textContent = mensagemErro(erroAutenticacao, "Não foi possível abrir a conta.");
      return;
    }
    usuarioAtual = autenticacao.user;
    lembrarConta(perfilAtual.public_id);
    await iniciarApp({ bloquear: false });
    return;
  }

  validandoPin = false;
  campo.value = "";
  atualizarPontosPin(0);

  if (data?.bloqueado) {
    iniciarContagemBloqueioPin(data.segundos);
    return;
  }

  const gate = document.getElementById("profileGate");
  gate.classList.remove("pin-error");
  void gate.offsetWidth;
  gate.classList.add("pin-error");
  mensagem.textContent = `PIN incorreto. ${data?.tentativas_restantes ?? 0} tentativa(s) restante(s).`;
  setTimeout(() => campo.focus(), 80);
}

async function configurarPinInicial() {
  const pin = document.getElementById("novoPinGate").value;
  const confirmacao = document.getElementById("confirmarPinGate").value;
  const mensagem = document.getElementById("pinSetupMensagem");

  if (!/^\d{4,8}$/.test(pin)) {
    mensagem.textContent = "Escolha um PIN com 4 a 8 números.";
    return;
  }
  if (pin !== confirmacao) {
    mensagem.textContent = "Os dois PINs precisam ser iguais.";
    return;
  }

  mensagem.textContent = "Protegendo seu perfil…";
  const { data, error } = await supabaseClient.rpc("configurar_pin_acesso", { p_pin: pin });
  if (error) {
    mensagem.textContent = mensagemErro(error, "Não foi possível criar o PIN.");
    return;
  }

  perfilAtual.pin_length = Number(data?.tamanho) || pin.length;
  document.getElementById("novoPinGate").value = "";
  document.getElementById("confirmarPinGate").value = "";
  lembrarConta(perfilAtual.public_id);
  if (modoMigracaoConta) {
    await supabaseClient.auth.signOut({ scope: "local" });
    usuarioAtual = null;
    await mostrarSeletorContas();
  } else {
    desbloquearAplicativo();
  }
}

function desbloquearAplicativo() {
  clearInterval(temporizadorBloqueioPin);
  const gate = document.getElementById("profileGate");
  gate.classList.add("unlocking");
  document.activeElement?.blur();

  setTimeout(() => {
    authScreen.classList.add("hidden");
    gate.classList.remove("unlocking");
    appContainer.classList.remove("hidden");
    validandoPin = false;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, 720);
}

async function sair() {
  clearInterval(temporizadorBloqueioPin);
  await supabaseClient.auth.signOut({ scope: "local" });
  usuarioAtual = null;
  perfilAtual = null;
  lancamentos = [];
  contasFixas = [];
  cartoesParcelados = [];
  orcamentos = [];
  objetivosFinanceiros = [];
  metasMensais = [];
  metaMensal = 0;
  appContainer.classList.add("hidden");
  await mostrarSeletorContas();
}

async function verificarSessao() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    usuarioAtual = data.session.user;
    const { data: perfilSessao } = await supabaseClient.from("perfis")
      .select(COLUNAS_PERFIL)
      .eq("user_id", usuarioAtual.id)
      .maybeSingle();
    if (perfilSessao?.public_id) lembrarConta(perfilSessao.public_id);

    if (perfilSessao && Number(perfilSessao.pin_length) < 4) {
      modoMigracaoConta = true;
      await iniciarApp({ bloquear: true });
      return;
    }

    await supabaseClient.auth.signOut({ scope: "local" });
    usuarioAtual = null;
  }

  await mostrarSeletorContas();
}

async function iniciarApp({ bloquear = true } = {}) {
  try {
    appContainer.classList.add("hidden");

    await carregarPerfil();
    await carregarDados();

    configurarCalendarios();
    atualizarTudo();
    fecharPerfil();
    if (bloquear) prepararTelaDoPerfil();
    else desbloquearAplicativo();
  } catch (error) {
    appContainer.classList.add("hidden");
    authScreen.classList.remove("hidden");
    mostrarMensagemAuth(mensagemErro(error, "Não foi possível iniciar o aplicativo."));
    document.getElementById("accountChooser").classList.remove("hidden");
    document.getElementById("profileGate").classList.add("hidden");
  }
}
async function carregarDados() {
  const [resLancamentos, resContas, resGruposContas, resMetas, resCartoes, resOrcamentos, resObjetivos] = await Promise.all([
    supabaseClient
      .from("lancamentos")
      .select("*")
      .eq("user_id", usuarioAtual.id)
      .order("data", { ascending: false }),
    supabaseClient
      .from("contas_fixas")
      .select("*")
      .eq("user_id", usuarioAtual.id)
      .order("vencimento", { ascending: true }),
    supabaseClient
      .from("grupos_contas")
      .select("*")
      .eq("user_id", usuarioAtual.id)
      .order("nome", { ascending: true }),
    supabaseClient
      .from("metas")
      .select("*")
      .eq("user_id", usuarioAtual.id),
    supabaseClient
      .from("cartoes_parcelas")
      .select("*")
      .eq("user_id", usuarioAtual.id),
    supabaseClient
      .from("orcamentos")
      .select("*")
      .eq("user_id", usuarioAtual.id),
    supabaseClient
      .from("objetivos_financeiros")
      .select("*")
      .eq("user_id", usuarioAtual.id)
      .order("created_at", { ascending: false })
  ]);

  const erro = resLancamentos.error || resContas.error || resGruposContas.error || resMetas.error || resCartoes.error || resOrcamentos.error || resObjetivos.error;
  if (erro) {
    throw new Error(mensagemErro(erro, "Não foi possível carregar seus dados."));
  }

  lancamentos = resLancamentos.data || [];
  contasFixas = resContas.data || [];
  gruposContas = resGruposContas.data || [];
  metasMensais = resMetas.data || [];
  metaMensal = Number(metasMensais.find(meta => meta.mes === primeiroDiaMesAtual())?.valor || 0);
  cartoesParcelados = resCartoes.data || [];
  orcamentos = resOrcamentos.data || [];
  objetivosFinanceiros = resObjetivos.data || [];
  if (!mesDashboard) mesDashboard = hojeTexto().slice(0, 7);
}

function mostrarAba(aba) {
  document.getElementById("abaDashboard").classList.toggle("hidden", aba !== "dashboard");
  document.getElementById("abaLancamentos").classList.toggle("hidden", aba !== "lancamentos");
  document.getElementById("abaContas").classList.toggle("hidden", aba !== "contas");
  document.getElementById("abaCartoes").classList.toggle("hidden", aba !== "cartoes");
  document.getElementById("abaPlanejamento").classList.toggle("hidden", aba !== "planejamento");

  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(tab => tab.classList.remove("active"));

  if (aba === "dashboard") tabs[0].classList.add("active");
  if (aba === "lancamentos") tabs[1].classList.add("active");
  if (aba === "contas") tabs[2].classList.add("active");
  if (aba === "cartoes") tabs[3].classList.add("active");
  if (aba === "planejamento") tabs[4].classList.add("active");
}

function configurarCalendarios() {
  if (!calendarioData) {
    calendarioData = flatpickr("#data", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      locale: "pt",
      defaultDate: hojeTexto()
    });

    if (!calendarioCartaoPrimeiraParcela) {
  calendarioCartaoPrimeiraParcela = flatpickr("#cartaoDataPrimeiraParcela", {
    dateFormat: "Y-m-d",
    altInput: true,
    altFormat: "d/m/Y",
    locale: "pt",
    defaultDate: hojeTexto()
  });
}

  }

  if (!calendarioVencimento) {
    calendarioVencimento = flatpickr("#dataVencimentoConta", {
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      locale: "pt",
      defaultDate: hojeTexto()
    });
  }

}

function limparFormularioLancamento() {
  form.reset();

  if (calendarioData) {
    calendarioData.setDate(hojeTexto(), true);
  }

  editandoId = null;
  botaoLancamento.textContent = "Adicionar lançamento";
  avisoEdicao.classList.add("hidden");
}

function cancelarEdicao() {
  limparFormularioLancamento();
}

function atualizarTela() {
  lista.innerHTML = "";

  const busca = document.getElementById("busca").value.toLowerCase();
  const filtroTipo = document.getElementById("filtroTipo").value;

  let receitas = 0;
  let despesas = 0;

  lancamentos.forEach(item => {
    if (item.tipo === "receita") receitas += Number(item.valor);
    if (item.tipo === "despesa") despesas += Number(item.valor);
  });

  const filtrados = lancamentos.filter(item => {
    const categoria = item.categoria || "";
    const descricao = item.descricao || "";

    const combinaBusca =
      categoria.toLowerCase().includes(busca) ||
      descricao.toLowerCase().includes(busca);

    const combinaTipo =
      filtroTipo === "todos" || item.tipo === filtroTipo;

    return combinaBusca && combinaTipo;
  });

  filtrados.forEach(item => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${formatarData(item.data)}</td>
      <td>${item.tipo === "receita" ? "Receita" : "Despesa"}</td>
      <td>${escaparHTML(item.categoria)}</td>
      <td>${escaparHTML(item.descricao)}</td>
      <td class="${item.tipo === "receita" ? "positive" : "negative"}">
        ${formatarMoeda(item.valor)}
      </td>
      <td>
        <button type="button" onclick="editarLancamento(${item.id})">Editar</button>
        <button type="button" class="danger" onclick="remover(${item.id})">Excluir</button>
      </td>
    `;

    lista.appendChild(tr);
  });

  document.getElementById("totalReceitas").textContent = formatarMoeda(receitas);
  document.getElementById("totalDespesas").textContent = formatarMoeda(despesas);
  document.getElementById("saldo").textContent = formatarMoeda(receitas - despesas);

  atualizarGrafico();
  atualizarDashboard();
}

form.addEventListener("submit", async function(e) {
  e.preventDefault();

  const novo = {
    tipo: document.getElementById("tipo").value,
    categoria: document.getElementById("categoria").value.trim(),
    descricao: document.getElementById("descricao").value.trim(),
    valor: Number(document.getElementById("valor").value),
    data: document.getElementById("data").value || hojeTexto(),
    user_id: usuarioAtual.id
  };

  if (!novo.categoria || !novo.descricao) {
    alert("Preencha categoria e descrição.");
    return;
  }

  if (novo.valor <= 0) {
    alert("Digite um valor maior que zero.");
    return;
  }

  if (editandoId) {
    const { error } = await supabaseClient
      .from("lancamentos")
      .update(novo)
      .eq("id", editandoId)
      .eq("user_id", usuarioAtual.id);

    if (error) {
      alert("Erro ao editar lançamento.");
      return;
    }
  } else {
    const { error } = await supabaseClient
      .from("lancamentos")
      .insert([novo]);

    if (error) {
      alert("Erro ao adicionar lançamento.");
      return;
    }
  }

  await carregarDados();
  atualizarTela();
  limparFormularioLancamento();
});

function editarLancamento(id) {
  const item = lancamentos.find(l => l.id === id);

  if (!item) return;

  editandoId = id;

  document.getElementById("tipo").value = item.tipo;
  document.getElementById("categoria").value = item.categoria;
  document.getElementById("descricao").value = item.descricao;
  document.getElementById("valor").value = item.valor;

  if (calendarioData) {
    calendarioData.setDate(item.data, true);
  }

  botaoLancamento.textContent = "Salvar alterações";
  avisoEdicao.classList.remove("hidden");

  mostrarAba("lancamentos");

  setTimeout(() => {
    form.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
}

async function remover(id) {
  const confirmar = confirm(
    "Tem certeza que deseja excluir este lançamento?\n\nEssa ação não poderá ser desfeita."
  );

  if (!confirmar) return;

  const { error } = await supabaseClient
    .from("lancamentos")
    .delete()
    .eq("id", id)
    .eq("user_id", usuarioAtual.id);

  if (error) {
    alert("Erro ao excluir lançamento.");
    return;
  }

  await carregarDados();
  atualizarTela();
}

formContaFixa.addEventListener("submit", async function(e) {
  e.preventDefault();

  const dadosConta = {
    nome: document.getElementById("nomeConta").value.trim(),
    valor: Number(document.getElementById("valorConta").value),
    vencimento: document.getElementById("dataVencimentoConta").value || hojeTexto(),
    grupo_id: document.getElementById("grupoConta").value
      ? Number(document.getElementById("grupoConta").value)
      : null,
    user_id: usuarioAtual.id
  };

  if (!dadosConta.nome) {
    alert("Digite o nome da conta.");
    return;
  }

  if (dadosConta.valor <= 0) {
    alert("Digite um valor maior que zero.");
    return;
  }

  let resposta;

  if (editandoContaFixaId) {
    resposta = await supabaseClient
      .from("contas_fixas")
      .update(dadosConta)
      .eq("id", editandoContaFixaId)
      .eq("user_id", usuarioAtual.id);
  } else {
    resposta = await supabaseClient
      .from("contas_fixas")
      .insert([dadosConta]);
  }

  if (resposta.error) {
    alert("Erro ao salvar conta fixa.");
    return;
  }

  const estavaEditando = !!editandoContaFixaId;

  await carregarDados();
  atualizarTudo();
  limparFormularioContaFixa();

  alert(
    estavaEditando
      ? "Conta fixa atualizada!"
      : "Conta fixa adicionada!"
  );
});

async function removerContaFixa(id) {
  if (!confirm("Deseja excluir esta conta fixa?")) return;

  const { error } = await supabaseClient
    .from("contas_fixas")
    .delete()
    .eq("id", id)
    .eq("user_id", usuarioAtual.id);

  if (error) {
    alert("Erro ao excluir conta fixa.");
    return;
  }

  if (editandoContaFixaId === id) {
    limparFormularioContaFixa();
  }

  await carregarDados();
  atualizarTudo();
}

async function pagarContaFixa(id) {
  const conta = contasFixas.find(c => c.id === id);
  if (!conta) return;

  const { error } = await supabaseClient.rpc("pagar_conta_fixa", {
    p_conta_id: id
  });

  if (error) {
    alert(mensagemErro(error, "Erro ao pagar conta fixa."));
    return;
  }

  await carregarDados();
  atualizarTudo();

  alert("Conta paga! Ela foi adicionada nas despesas e voltou para o próximo mês.");
}

function atualizarContasFixas() {
  const listaContas = document.getElementById("listaContasFixas");
  listaContas.innerHTML = "";

  atualizarOpcoesGruposContas();

  const filtroGrupo = document.getElementById("filtroGrupoConta")?.value || "todos";
  const contasFiltradas = contasFixas.filter(conta => {
    if (filtroGrupo === "todos") return true;
    if (filtroGrupo === "sem_grupo") return !conta.grupo_id;
    return Number(conta.grupo_id) === Number(filtroGrupo);
  });

  let totalFixas = contasFixas.reduce((total, conta) => total + Number(conta.valor), 0);
  let totalAbertas = 0;
  let totalVencidas = 0;

  const hoje = hojeTexto();

  contasFixas.forEach(conta => {
    totalAbertas += Number(conta.valor);
    if (conta.vencimento < hoje) totalVencidas += Number(conta.valor);
  });

  if (contasFixas.length === 0) {
    listaContas.innerHTML = '<p class="empty-state">Nenhuma conta fixa cadastrada ainda.</p>';
  } else if (contasFiltradas.length === 0) {
    listaContas.innerHTML = '<p class="empty-state">Nenhuma conta encontrada neste grupo.</p>';
  }

  const contasOrdenadas = [...contasFiltradas]
    .map(conta => {
      let prioridade = 2;

      if (conta.vencimento < hoje) prioridade = 0;
      if (conta.vencimento === hoje) prioridade = 1;

      return { ...conta, prioridade };
    })
    .sort((a, b) => {
      if (a.prioridade !== b.prioridade) return a.prioridade - b.prioridade;
      return new Date(a.vencimento) - new Date(b.vencimento);
    });

  contasOrdenadas.forEach(conta => {
    let status = "Em aberto";
    let classeStatus = "status-open";

    if (conta.vencimento < hoje) {
      status = "Vencida";
      classeStatus = "status-late";
    } else if (conta.vencimento === hoje) {
      status = "Vence hoje";
      classeStatus = "status-today";
    }

    const grupo = gruposContas.find(item => Number(item.id) === Number(conta.grupo_id));

    const div = document.createElement("div");

const mesAtual = hojeTexto().slice(0, 7);
const contaEhDoMesAtual =
  conta.vencimento &&
  conta.vencimento.slice(0, 7) === mesAtual;

div.className = contaEhDoMesAtual
  ? "fixed-bill"
  : "fixed-bill conta-futura";

    div.innerHTML = `
      <div>
        <strong>${escaparHTML(conta.nome)}</strong>
        <p>${formatarMoeda(conta.valor)} • Vencimento: ${formatarData(conta.vencimento)}</p>
        <div class="bill-tags">
          <span class="status ${classeStatus}">${status}</span>
          <span class="group-badge ${grupo ? "" : "group-badge-empty"}">${grupo ? escaparHTML(grupo.nome) : "Sem grupo"}</span>
        </div>
      </div>

    <div class="bill-actions">
  <button type="button" onclick="pagarContaFixa(${conta.id})">Marcar como paga</button>
  <button type="button" onclick="editarContaFixa(${conta.id})">Editar</button>
  <button type="button" class="danger" onclick="removerContaFixa(${conta.id})">Excluir</button>
</div>
    `;

    listaContas.appendChild(div);
  });

  document.getElementById("totalFixas").textContent = formatarMoeda(totalFixas);
  document.getElementById("totalFixasAbertas").textContent = formatarMoeda(totalAbertas);
  document.getElementById("totalFixasVencidas").textContent = formatarMoeda(totalVencidas);
  document.getElementById("totalGrupoFiltrado").textContent = formatarMoeda(
    contasFiltradas.reduce((total, conta) => total + Number(conta.valor), 0)
  );

  const grupoSelecionado = gruposContas.find(item => String(item.id) === filtroGrupo);
  document.getElementById("rotuloTotalGrupo").textContent = filtroGrupo === "todos"
    ? "Total de todas as contas"
    : filtroGrupo === "sem_grupo"
      ? "Total sem grupo"
      : `Total de ${grupoSelecionado?.nome || "grupo"}`;
}

function atualizarOpcoesGruposContas() {
  const seletorConta = document.getElementById("grupoConta");
  const seletorFiltro = document.getElementById("filtroGrupoConta");
  if (!seletorConta || !seletorFiltro) return;

  const grupoContaAtual = seletorConta.value;
  const filtroAtual = seletorFiltro.value || "todos";
  const opcoes = gruposContas.map(grupo =>
    `<option value="${grupo.id}">${escaparHTML(grupo.nome)}</option>`
  ).join("");

  seletorConta.innerHTML = `<option value="">Sem grupo</option>${opcoes}`;
  seletorFiltro.innerHTML = `<option value="todos">Todos os grupos</option><option value="sem_grupo">Sem grupo</option>${opcoes}`;

  seletorConta.value = gruposContas.some(grupo => String(grupo.id) === grupoContaAtual) ? grupoContaAtual : "";
  seletorFiltro.value = filtroAtual === "todos" || filtroAtual === "sem_grupo" || gruposContas.some(grupo => String(grupo.id) === filtroAtual)
    ? filtroAtual
    : "todos";
}

function mostrarPainelContasFixas(painel) {
  const exibindoGrupos = painel === "grupos";
  document.getElementById("painelContasFixas").classList.toggle("hidden", exibindoGrupos);
  document.getElementById("painelGruposContas").classList.toggle("hidden", !exibindoGrupos);
  document.getElementById("tabPainelContas").classList.toggle("active", !exibindoGrupos);
  document.getElementById("tabPainelGrupos").classList.toggle("active", exibindoGrupos);
  if (exibindoGrupos) atualizarGruposContas();
}

document.getElementById("formGrupoConta").addEventListener("submit", async function(event) {
  event.preventDefault();
  const nome = document.getElementById("nomeGrupoConta").value.trim();
  if (!nome) return;

  const { error } = await supabaseClient.from("grupos_contas").insert([{
    user_id: usuarioAtual.id,
    nome
  }]);

  if (error) {
    alert(error.code === "23505" ? "Você já criou um grupo com esse nome." : mensagemErro(error, "Não foi possível criar o grupo."));
    return;
  }

  this.reset();
  await carregarDados();
  atualizarTudo();
  mostrarPainelContasFixas("grupos");
});

async function removerGrupoConta(id) {
  const grupo = gruposContas.find(item => Number(item.id) === Number(id));
  if (!grupo) return;
  const quantidade = contasFixas.filter(conta => Number(conta.grupo_id) === Number(id)).length;
  const detalhe = quantidade
    ? `\n\n${quantidade} conta${quantidade === 1 ? "" : "s"} continuar${quantidade === 1 ? "á" : "ão"} existindo como \"Sem grupo\".`
    : "";
  if (!confirm(`Excluir o grupo \"${grupo.nome}\"?${detalhe}`)) return;

  const { error } = await supabaseClient.from("grupos_contas").delete().eq("id", id).eq("user_id", usuarioAtual.id);
  if (error) return alert(mensagemErro(error, "Não foi possível excluir o grupo."));

  await carregarDados();
  atualizarTudo();
  mostrarPainelContasFixas("grupos");
}

function atualizarGruposContas() {
  const lista = document.getElementById("listaGruposContas");
  if (!lista) return;
  document.getElementById("resumoGruposContas").textContent = `${gruposContas.length} grupo${gruposContas.length === 1 ? "" : "s"}`;

  if (!gruposContas.length) {
    lista.innerHTML = '<p class="empty-state">Nenhum grupo criado. Que tal começar por Streaming, Estudos ou Moradia?</p>';
    return;
  }

  lista.innerHTML = gruposContas.map(grupo => {
    const contasDoGrupo = contasFixas.filter(conta => Number(conta.grupo_id) === Number(grupo.id));
    const total = contasDoGrupo.reduce((soma, conta) => soma + Number(conta.valor), 0);
    return `
      <article class="group-card">
        <div class="group-card-icon">${escaparHTML(grupo.nome.slice(0, 1).toUpperCase())}</div>
        <div class="group-card-copy">
          <span>${contasDoGrupo.length} conta${contasDoGrupo.length === 1 ? "" : "s"}</span>
          <h3>${escaparHTML(grupo.nome)}</h3>
          <strong>${formatarMoeda(total)} <small>/ mês</small></strong>
        </div>
        <button type="button" class="group-delete-button" onclick="removerGrupoConta(${grupo.id})" aria-label="Excluir grupo ${escaparHTML(grupo.nome)}">Excluir</button>
      </article>`;
  }).join("");
}

function resumoDoMes(mes) {
  return lancamentos.reduce((resumo, item) => {
    if (item.data?.slice(0, 7) === mes) resumo[item.tipo] += Number(item.valor);
    return resumo;
  }, { receita: 0, despesa: 0 });
}

function mesAnterior(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  const data = new Date(ano, numeroMes - 2, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function nomeDoMes(mes) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(ano, numeroMes - 1, 1));
}

function alterarMesDashboard(novoMes) {
  if (!/^\d{4}-\d{2}$/.test(novoMes)) return;
  mesDashboard = novoMes;
  atualizarDashboard();
  atualizarPlanejamento();
}

function voltarMesAtual() {
  alterarMesDashboard(hojeTexto().slice(0, 7));
}

function calcularSaudeFinanceira({ receitas, despesas, saldoPrevisto, contasPendentes, orcamentosMes }) {
  if (!receitas && !despesas) return 0;
  let score = 45;
  const taxa = receitas > 0 ? (receitas - despesas) / receitas : -1;
  if (taxa >= 0.2) score += 25;
  else if (taxa >= 0.1) score += 17;
  else if (taxa >= 0) score += 7;
  else score -= 22;
  score += saldoPrevisto >= 0 ? 15 : -20;
  const pressao = receitas > 0 ? contasPendentes / receitas : 1;
  if (pressao <= 0.3) score += 10;
  else if (pressao > 0.6) score -= 10;
  if (orcamentosMes.length) {
    const dentro = orcamentosMes.filter(o => gastoCategoria(o.categoria, mesDashboard) <= Number(o.limite)).length;
    score += Math.round((dentro / orcamentosMes.length) * 10);
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function atualizarDashboard() {
  if (!mesDashboard) mesDashboard = hojeTexto().slice(0, 7);
  const { receita: receitas, despesa: despesas } = resumoDoMes(mesDashboard);
  let contasPendentes = contasFixas
    .filter(conta => conta.vencimento?.slice(0, 7) <= mesDashboard)
    .reduce((total, conta) => total + Number(conta.valor), 0);
  contasPendentes += parcelasCartaoDoMes(mesDashboard);

  const saldoAtual = receitas - despesas;
  const saldoPrevisto = saldoAtual - contasPendentes;
  const taxaEconomia = receitas > 0 ? (saldoAtual / receitas) * 100 : 0;
  const orcamentosMes = orcamentos.filter(item => item.mes?.slice(0, 7) === mesDashboard);
  const score = calcularSaudeFinanceira({ receitas, despesas, saldoPrevisto, contasPendentes, orcamentosMes });

  atualizarResumoGeral();

  document.getElementById("mesDashboard").value = mesDashboard;
  document.getElementById("tituloMesDashboard").textContent = nomeDoMes(mesDashboard).replace(/^./, letra => letra.toUpperCase());
  document.getElementById("dashSaldoAtual").textContent = formatarMoeda(saldoAtual);
  document.getElementById("dashContasPendentes").textContent = formatarMoeda(contasPendentes);
  document.getElementById("dashSaldoPrevisto").textContent = formatarMoeda(saldoPrevisto);
  document.getElementById("dashEconomiaMes").textContent = `${Math.round(taxaEconomia)}%`;
  document.getElementById("scoreFinanceiro").textContent = score;
  document.getElementById("scoreRing").style.setProperty("--score", `${score * 3.6}deg`);

  const nivel = score >= 80 ? ["Excelente direção", "Sua estrutura financeira está forte. Mantenha os limites e dê destino ao excedente."]
    : score >= 60 ? ["No caminho certo", "Há uma boa base. Ajustes pequenos podem aumentar sua folga e acelerar seus objetivos."]
    : score >= 40 ? ["Mês de atenção", "Priorize o saldo previsto, corte excessos nas maiores categorias e evite novos compromissos."]
    : score > 0 ? ["Hora de reorganizar", "Seu plano precisa de proteção. Comece pelas despesas essenciais e renegocie o que pressiona o caixa."]
    : ["Comece a registrar", "O placar aparece assim que existirem receitas ou despesas no mês selecionado."];
  document.getElementById("tituloScore").textContent = nivel[0];
  document.getElementById("textoScore").textContent = nivel[1];

  const alerta = document.getElementById("alertaFinanceiro");
  alerta.className = `alert-box ${saldoPrevisto < 0 ? "alert-danger" : taxaEconomia < 10 ? "alert-warning" : receitas ? "alert-success" : "alert-neutral"}`;
  alerta.textContent = saldoPrevisto < 0
    ? `Plano de proteção: faltam ${formatarMoeda(Math.abs(saldoPrevisto))} para cobrir os compromissos previstos.`
    : receitas ? `Sua folga prevista é ${formatarMoeda(saldoPrevisto)}. Direcione parte dela para uma meta antes que vire gasto sem intenção.`
      : "Adicione os lançamentos deste mês para receber uma análise personalizada.";

  atualizarMetaMensal();
  atualizarGraficoTendencia();
  atualizarInsights({ receitas, despesas, saldoPrevisto, taxaEconomia, orcamentosMes });
  atualizarCompromissos();
  atualizarReserva();
}

function dividaCartoesTotal() {
  return cartoesParcelados.reduce((total, item) => {
    const parcelasRestantes = Math.max(0, Number(item.total_parcelas) - Number(item.parcelas_pagas));
    return total + (Number(item.valor_total) / Number(item.total_parcelas)) * parcelasRestantes;
  }, 0);
}

function atualizarResumoGeral() {
  const totais = lancamentos.reduce((resumo, item) => {
    resumo[item.tipo] += Number(item.valor);
    return resumo;
  }, { receita: 0, despesa: 0 });
  const saldoAcumulado = totais.receita - totais.despesa;
  const contasEmAberto = contasFixas.reduce((total, conta) => total + Number(conta.valor), 0);
  const compromissos = contasEmAberto + dividaCartoesTotal();
  const saldoLiquido = saldoAcumulado - compromissos;

  const campos = {
    saldoAcumuladoGeral: saldoAcumulado,
    receitasAcumuladas: totais.receita,
    despesasAcumuladas: totais.despesa,
    dividasAbertasGeral: compromissos,
    saldoLiquidoGeral: saldoLiquido
  };

  Object.entries(campos).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);
    elemento.textContent = formatarMoeda(valor);
    const representaSaida = id === "despesasAcumuladas" || id === "dividasAbertasGeral";
    const representaEntrada = id === "receitasAcumuladas";
    elemento.classList.toggle("negative", representaSaida || (!representaEntrada && valor < 0));
    elemento.classList.toggle("positive", representaEntrada || (!representaSaida && valor >= 0));
  });
}

function atualizarMetaMensal() {
  const valorMetaInput = document.getElementById("valorMeta");
  const barraMeta = document.getElementById("barraMeta");
  const porcentagemMeta = document.getElementById("porcentagemMeta");
  const textoMeta = document.getElementById("textoMeta");

  if (!valorMetaInput || !barraMeta || !porcentagemMeta || !textoMeta) return;

  const metaSelecionada = Number(metasMensais.find(meta => meta.mes?.slice(0, 7) === mesDashboard)?.valor || 0);
  valorMetaInput.value = metaSelecionada > 0 ? metaSelecionada : "";
  const resumo = resumoDoMes(mesDashboard);
  const economia = resumo.receita - resumo.despesa;
  const progresso = metaSelecionada > 0 ? Math.min((economia / metaSelecionada) * 100, 100) : 0;

  barraMeta.style.width = `${Math.max(progresso, 0)}%`;
  porcentagemMeta.textContent = `${Math.round(Math.max(progresso, 0))}%`;

  if (metaSelecionada <= 0) {
    textoMeta.textContent = "Defina uma meta mensal para acompanhar seu progresso.";
  } else if (economia >= metaSelecionada) {
    textoMeta.textContent = "Parabéns! Você atingiu sua meta mensal.";
  } else {
    textoMeta.textContent = `Faltam ${formatarMoeda(metaSelecionada - economia)} para atingir sua meta.`;
  }
}

document.getElementById("formMeta").addEventListener("submit", async function(e) {
  e.preventDefault();

  const novoValor = Number(document.getElementById("valorMeta").value);

  if (novoValor <= 0) {
    alert("Digite uma meta maior que zero.");
    return;
  }

  const { error } = await supabaseClient
    .from("metas")
    .upsert([{
      valor: novoValor,
      user_id: usuarioAtual.id,
      mes: `${mesDashboard}-01`
    }], { onConflict: "user_id,mes" });

  if (error) {
    alert(mensagemErro(error, "Erro ao salvar meta."));
    return;
  }

  await carregarDados();
  atualizarDashboard();
});

function gastoCategoria(categoria, mes) {
  const chave = String(categoria).trim().toLocaleLowerCase("pt-BR");
  return lancamentos
    .filter(item => item.tipo === "despesa" && item.data?.slice(0, 7) === mes && String(item.categoria).trim().toLocaleLowerCase("pt-BR") === chave)
    .reduce((total, item) => total + Number(item.valor), 0);
}

function atualizarGraficoTendencia() {
  const grafico = document.getElementById("graficoTendencia");
  const meses = [];
  let cursor = mesDashboard;
  for (let i = 0; i < 6; i += 1) { meses.unshift(cursor); cursor = mesAnterior(cursor); }
  const dados = meses.map(mes => ({ mes, ...resumoDoMes(mes) }));
  const maior = Math.max(1, ...dados.flatMap(item => [item.receita, item.despesa]));
  grafico.innerHTML = dados.map(item => `
    <div class="trend-column" title="${nomeDoMes(item.mes)}">
      <div class="trend-bars">
        <span class="trend-income" style="height:${Math.max(item.receita ? 5 : 0, item.receita / maior * 100)}%"></span>
        <span class="trend-expense" style="height:${Math.max(item.despesa ? 5 : 0, item.despesa / maior * 100)}%"></span>
      </div>
      <small>${nomeDoMes(item.mes).split(" ")[0].slice(0, 3)}</small>
    </div>`).join("");
}

function atualizarInsights({ receitas, despesas, saldoPrevisto, taxaEconomia, orcamentosMes }) {
  const lista = document.getElementById("listaInsights");
  const anterior = resumoDoMes(mesAnterior(mesDashboard));
  const variacao = anterior.despesa > 0 ? ((despesas - anterior.despesa) / anterior.despesa) * 100 : null;
  const categorias = {};
  lancamentos.filter(item => item.tipo === "despesa" && item.data?.slice(0, 7) === mesDashboard)
    .forEach(item => { categorias[item.categoria] = (categorias[item.categoria] || 0) + Number(item.valor); });
  const maiorCategoria = Object.entries(categorias).sort((a, b) => b[1] - a[1])[0];
  const estourados = orcamentosMes.filter(item => gastoCategoria(item.categoria, mesDashboard) > Number(item.limite));
  const insights = [];

  if (receitas > 0) insights.push({ icon: taxaEconomia >= 20 ? "↗" : "◎", title: `Você preservou ${Math.round(taxaEconomia)}% da renda`, text: taxaEconomia >= 20 ? "Faixa saudável: automatize uma parte para seus objetivos." : "Tente chegar gradualmente a 20%, começando por 5% automáticos." });
  if (maiorCategoria) insights.push({ icon: "◫", title: `${maiorCategoria[0]} lidera os gastos`, text: `${formatarMoeda(maiorCategoria[1])} no mês. É a categoria com maior potencial de ajuste.` });
  if (variacao !== null) insights.push({ icon: variacao <= 0 ? "↓" : "↑", title: `Despesas ${variacao <= 0 ? "caíram" : "subiram"} ${Math.abs(Math.round(variacao))}%`, text: `Comparação com ${nomeDoMes(mesAnterior(mesDashboard))}.` });
  if (estourados.length) insights.push({ icon: "!", title: `${estourados.length} orçamento(s) acima do limite`, text: `Revise ${estourados.map(item => item.categoria).join(", ")}.` });
  if (saldoPrevisto < 0) insights.unshift({ icon: "!", title: "Compromissos superam sua folga", text: `Reduza ou adie ${formatarMoeda(Math.abs(saldoPrevisto))} para fechar o mês no azul.` });
  if (!insights.length) insights.push({ icon: "+", title: "Alimente seu histórico", text: "Registre receitas, despesas e orçamentos para receber recomendações úteis." });

  lista.innerHTML = insights.slice(0, 4).map(item => `<div class="insight-item"><span>${item.icon}</span><div><strong>${escaparHTML(item.title)}</strong><p>${escaparHTML(item.text)}</p></div></div>`).join("");
}

function dataParcelaPorIndice(item, indiceParcela) {
  const [anoBase, mesBase] = item.data_primeira_parcela.split("-").map(Number);
  const indiceMes = anoBase * 12 + (mesBase - 1) + indiceParcela;
  const ano = Math.floor(indiceMes / 12);
  const mes = indiceMes % 12;
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const dia = Math.min(Number(item.dia_vencimento), ultimoDia);
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function definirFiltroCompromissos(filtro) {
  filtroCompromissos = filtro === "todos" ? "todos" : "mes";
  compromissosExpandidos = false;
  atualizarCompromissos();
}

function alternarCompromissosExpandidos() {
  compromissosExpandidos = !compromissosExpandidos;
  atualizarCompromissos();
}

function atualizarCompromissos() {
  const container = document.getElementById("proximosCompromissos");
  const compromissos = contasFixas.map(conta => ({
    nome: conta.nome,
    data: conta.vencimento,
    valor: Number(conta.valor),
    tipo: "Conta fixa"
  }));

  cartoesParcelados.forEach(item => {
    const totalParcelas = Number(item.total_parcelas);
    const parcelasPagas = Number(item.parcelas_pagas);
    const valorParcela = Number(item.valor_total) / totalParcelas;
    for (let indice = parcelasPagas; indice < totalParcelas; indice += 1) {
      compromissos.push({
        nome: `${item.cartao_nome} · ${item.descricao}`,
        data: dataParcelaPorIndice(item, indice),
        valor: valorParcela,
        tipo: `Parcela ${indice + 1}/${totalParcelas}`
      });
    }
  });

  compromissos.sort((a, b) => a.data.localeCompare(b.data));
  const filtrados = filtroCompromissos === "mes"
    ? compromissos.filter(item => item.data?.slice(0, 7) === mesDashboard)
    : compromissos;
  const exibidos = compromissosExpandidos ? filtrados : filtrados.slice(0, 4);

  document.getElementById("filtroCompromissosMes").classList.toggle("active", filtroCompromissos === "mes");
  document.getElementById("filtroCompromissosTodos").classList.toggle("active", filtroCompromissos === "todos");
  document.getElementById("resumoCompromissos").textContent = `${filtrados.length} ${filtrados.length === 1 ? "compromisso" : "compromissos"}`;
  document.getElementById("periodoCompromissos").textContent = filtroCompromissos === "mes"
    ? nomeDoMes(mesDashboard).replace(/^./, letra => letra.toUpperCase())
    : "Todos os períodos";

  container.innerHTML = exibidos.length ? exibidos.map(item => `
    <div class="commitment-item"><div class="commitment-date"><strong>${item.data.slice(8, 10)}</strong><span>${nomeDoMes(item.data.slice(0, 7)).split(" ")[0].slice(0, 3)}</span></div><div><strong>${escaparHTML(item.nome)}</strong><p>${item.tipo} · ${formatarData(item.data)}</p></div><strong>${formatarMoeda(item.valor)}</strong></div>`).join("")
    : `<p class="empty-state">Nenhum compromisso encontrado ${filtroCompromissos === "mes" ? "no mês selecionado" : ""}.</p>`;

  const botaoExpandir = document.getElementById("botaoExpandirCompromissos");
  botaoExpandir.classList.toggle("hidden", filtrados.length <= 4);
  botaoExpandir.textContent = compromissosExpandidos
    ? "Mostrar menos"
    : `Mostrar mais (${filtrados.length - 4})`;
}

function atualizarReserva() {
  const objetivo = objetivosFinanceiros.find(item => item.tipo === "reserva_emergencia" && item.status !== "pausado");
  const custoEssencial = contasFixas.reduce((total, conta) => total + Number(conta.valor), 0);
  const recomendado = custoEssencial * 6;
  const alvo = Number(objetivo?.valor_alvo || recomendado || 0);
  const atual = Number(objetivo?.valor_atual || 0);
  const percentual = alvo > 0 ? Math.min(100, atual / alvo * 100) : 0;
  document.getElementById("reservaAtual").textContent = `${formatarMoeda(atual)} guardados`;
  document.getElementById("reservaPercentual").textContent = `${Math.round(percentual)}%`;
  document.getElementById("barraReserva").style.width = `${percentual}%`;
  document.getElementById("textoReserva").textContent = objetivo
    ? `Alvo de ${formatarMoeda(alvo)}. ${atual >= alvo ? "Sua proteção está completa." : `Faltam ${formatarMoeda(alvo - atual)}.`}`
    : recomendado > 0 ? `Sugestão: acumule ${formatarMoeda(recomendado)}, equivalente a 6 meses de contas fixas.` : "Cadastre suas contas e crie uma meta de reserva no Planejamento.";
}

function atualizarGrafico() {
  const grafico = document.getElementById("grafico");
  grafico.innerHTML = "";

  const despesas = lancamentos.filter(item => item.tipo === "despesa");
  const categorias = {};

  despesas.forEach(item => {
    categorias[item.categoria] = (categorias[item.categoria] || 0) + Number(item.valor);
  });

  const maior = Math.max(...Object.values(categorias), 0);

  if (despesas.length === 0) {
    grafico.innerHTML = "<p>Nenhuma despesa cadastrada ainda.</p>";
    return;
  }

  Object.keys(categorias).forEach(categoria => {
    const valor = categorias[categoria];
    const largura = maior > 0 ? (valor / maior) * 100 : 0;

    const div = document.createElement("div");
    div.className = "bar";

    div.innerHTML = `
      <div class="bar-label">
        <span>${escaparHTML(categoria)}</span>
        <span>${formatarMoeda(valor)}</span>
      </div>
      <div class="bar-fill" style="width:${largura}%"></div>
    `;

    grafico.appendChild(div);
  });
}

async function limparTudo() {
  if (!confirm("Tem certeza que deseja apagar todos os seus dados?")) return;

  const { error } = await supabaseClient.rpc("limpar_meus_dados");
  if (error) {
    alert(mensagemErro(error, "Não foi possível apagar os dados."));
    return;
  }

  await carregarDados();
  atualizarTudo();
}

function exportarDados() {
  const dados = JSON.stringify({
    versao: 4,
    exportadoEm: new Date().toISOString(),
    lancamentos,
    contasFixas: contasFixas.map(conta => ({
      ...conta,
      grupo_nome: gruposContas.find(grupo => Number(grupo.id) === Number(conta.grupo_id))?.nome || null
    })),
    gruposContas,
    metaMensal,
    metasMensais,
    orcamentos,
    objetivosFinanceiros,
    cartoesParcelados
  }, null, 2);
  const blob = new Blob([dados], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "minhas-financas.json";
  a.click();

  URL.revokeObjectURL(url);
}

async function importarDados(event) {
  const arquivo = event.target.files?.[0];
  event.target.value = "";
  if (!arquivo) return;

  try {
    const dados = JSON.parse(await arquivo.text());
    if (!Array.isArray(dados.lancamentos) || !Array.isArray(dados.contasFixas)) {
      throw new Error("O arquivo não possui um formato de backup válido.");
    }

    if (!confirm("Os dados do arquivo serão adicionados à sua conta. Deseja continuar?")) return;

    const nomesGruposBackup = [...new Set([
      ...(dados.gruposContas || []).map(grupo => grupo.nome),
      ...dados.contasFixas.map(conta => conta.grupo_nome)
    ].filter(Boolean).map(nome => String(nome).trim()).filter(Boolean))];
    const nomesExistentes = new Set(gruposContas.map(grupo => grupo.nome.trim().toLocaleLowerCase("pt-BR")));
    const gruposNovos = nomesGruposBackup
      .filter(nome => !nomesExistentes.has(nome.toLocaleLowerCase("pt-BR")))
      .map(nome => ({ user_id: usuarioAtual.id, nome }));

    let gruposDisponiveis = [...gruposContas];
    if (gruposNovos.length) {
      const respostaGrupos = await supabaseClient.from("grupos_contas").insert(gruposNovos).select("*");
      if (respostaGrupos.error) throw respostaGrupos.error;
      gruposDisponiveis = [...gruposDisponiveis, ...(respostaGrupos.data || [])];
    }
    const idGrupoPorNome = new Map(gruposDisponiveis.map(grupo => [grupo.nome.trim().toLocaleLowerCase("pt-BR"), grupo.id]));

    const novosLancamentos = dados.lancamentos.map(({ tipo, categoria, descricao, valor, data, origem, origem_id }) => ({
      tipo,
      categoria,
      descricao,
      valor: Number(valor),
      data,
      origem: origem || null,
      origem_id: origem_id || null,
      user_id: usuarioAtual.id
    }));

    const novasContas = dados.contasFixas.map(item => ({
      nome: item.nome,
      valor: Number(item.valor),
      vencimento: item.vencimento,
      grupo_id: item.grupo_nome ? idGrupoPorNome.get(String(item.grupo_nome).trim().toLocaleLowerCase("pt-BR")) || null : null,
      user_id: usuarioAtual.id
    }));

    const novosCartoes = (dados.cartoesParcelados || []).map(item => ({
      cartao_nome: item.cartao_nome,
      cartao_final: item.cartao_final || "",
      descricao: item.descricao,
      valor_total: Number(item.valor_total),
      total_parcelas: Number(item.total_parcelas),
      parcelas_pagas: Number(item.parcelas_pagas || 0),
      data_primeira_parcela: item.data_primeira_parcela,
      dia_vencimento: Number(item.dia_vencimento),
      status: item.status === "quitado" ? "quitado" : "ativo",
      user_id: usuarioAtual.id
    }));

    const novosOrcamentos = (dados.orcamentos || []).map(item => ({
      user_id: usuarioAtual.id,
      mes: item.mes,
      categoria: item.categoria,
      limite: Number(item.limite)
    }));

    const novosObjetivos = (dados.objetivosFinanceiros || []).map(item => ({
      user_id: usuarioAtual.id,
      nome: item.nome,
      tipo: item.tipo === "reserva_emergencia" ? "reserva_emergencia" : "objetivo",
      valor_alvo: Number(item.valor_alvo),
      valor_atual: Number(item.valor_atual || 0),
      prazo: item.prazo || null,
      status: ["ativo", "concluido", "pausado"].includes(item.status) ? item.status : "ativo"
    }));

    const operacoes = [];
    if (novosLancamentos.length) operacoes.push(supabaseClient.from("lancamentos").insert(novosLancamentos));
    if (novasContas.length) operacoes.push(supabaseClient.from("contas_fixas").insert(novasContas));
    if (novosCartoes.length) operacoes.push(supabaseClient.from("cartoes_parcelas").insert(novosCartoes));
    if (novosOrcamentos.length) operacoes.push(supabaseClient.from("orcamentos").insert(novosOrcamentos));
    if (novosObjetivos.length) operacoes.push(supabaseClient.from("objetivos_financeiros").insert(novosObjetivos));
    if (Array.isArray(dados.metasMensais) && dados.metasMensais.length) {
      operacoes.push(supabaseClient.from("metas").upsert(dados.metasMensais.map(item => ({ user_id: usuarioAtual.id, mes: item.mes, valor: Number(item.valor) })), { onConflict: "user_id,mes" }));
    }
    if (!Array.isArray(dados.metasMensais) && Number(dados.metaMensal) > 0) {
      operacoes.push(supabaseClient.from("metas").upsert([{
        user_id: usuarioAtual.id,
        mes: primeiroDiaMesAtual(),
        valor: Number(dados.metaMensal)
      }], { onConflict: "user_id,mes" }));
    }

    const resultados = await Promise.all(operacoes);
    const erro = resultados.find(resultado => resultado.error)?.error;
    if (erro) throw erro;

    await carregarDados();
    atualizarTudo();
    alert("Backup importado com sucesso.");
  } catch (error) {
    alert(mensagemErro(error, "Não foi possível importar o arquivo."));
  }
}

verificarSessao();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").then(function(registration) {
    registration.update();
  });
}

function prepararImagemPerfil(arquivo) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();

    leitor.onload = function(evento) {
      const img = new Image();

      img.onload = function() {
        const canvas = document.createElement("canvas");
        const tamanho = 300;

        canvas.width = tamanho;
        canvas.height = tamanho;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, tamanho, tamanho);

        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error("Não foi possível preparar a imagem."));
        }, "image/jpeg", 0.82);
      };

      img.src = evento.target.result;
    };

    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

async function carregarPerfil() {
  const { data, error } = await supabaseClient
    .from("perfis")
    .select(COLUNAS_PERFIL)
    .eq("user_id", usuarioAtual.id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const nomeInicial = usuarioAtual.user_metadata?.nome || usuarioAtual.email?.split("@")[0] || "Usuário";
    const { data: perfilCriado, error: erroCriacao } = await supabaseClient
      .from("perfis")
      .insert([{ user_id: usuarioAtual.id, nome: nomeInicial, avatar_url: "" }])
      .select(COLUNAS_PERFIL)
      .single();
    if (erroCriacao) throw erroCriacao;
    perfilAtual = perfilCriado;
  } else {
    perfilAtual = data;
  }

  const nome = perfilAtual?.nome || usuarioAtual.email;
  const avatar = perfilAtual?.avatar_url || "";

  document.getElementById("usuarioLogado").textContent = nome;

  const fotoTopo = document.getElementById("fotoPerfilTopo");

  if (avatar) {
    fotoTopo.src = avatar;
    fotoTopo.classList.remove("hidden");
  } else {
    fotoTopo.classList.add("hidden");
  }
}

function abrirPerfil() {
  document.getElementById("modalPerfil").classList.remove("hidden");

  document.getElementById("perfilNome").value = perfilAtual?.nome || "";
  document.getElementById("perfilNovoPin").value = "";
  document.getElementById("perfilConfirmarPin").value = "";

  const preview = document.getElementById("previewPerfil");

  if (perfilAtual?.avatar_url) {
    preview.src = perfilAtual.avatar_url;
    preview.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
  }
}

function fecharPerfil() {
  document.getElementById("modalPerfil").classList.add("hidden");
}

async function salvarPerfil() {

  const nome = document.getElementById("perfilNome").value.trim();
  const novoPin = document.getElementById("perfilNovoPin").value;
  const confirmarNovoPin = document.getElementById("perfilConfirmarPin").value;

  if (!nome) {
    alert("Digite seu nome.");
    return;
  }

  if (novoPin && !/^\d{4,8}$/.test(novoPin)) {
    alert("O novo PIN deve ter entre 4 e 8 números.");
    return;
  }

  if (novoPin !== confirmarNovoPin) {
    alert("A confirmação do novo PIN está diferente.");
    return;
  }

  let avatarUrl = perfilAtual?.avatar_url || "";
  const foto = document.getElementById("perfilFoto").files[0];

  if (foto) {
    if (!foto.type.startsWith("image/")) {
      alert("Selecione um arquivo de imagem.");
      return;
    }

    const imagem = await prepararImagemPerfil(foto);
    const caminho = `${usuarioAtual.id}/avatar.jpg`;
    const { error: uploadError } = await supabaseClient.storage
      .from("avatars")
      .upload(caminho, imagem, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      alert(mensagemErro(uploadError, "Não foi possível enviar a foto."));
      return;
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from("avatars")
      .getPublicUrl(caminho);
    avatarUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;
  }

  const dados = {
    user_id: usuarioAtual.id,
    nome,
    avatar_url: avatarUrl
  };

  const { data: perfilExistente } = await supabaseClient
    .from("perfis")
    .select("id")
    .eq("user_id", usuarioAtual.id)
    .maybeSingle();

  let error;

  if (perfilExistente) {

    const resultado = await supabaseClient
      .from("perfis")
      .update({
        nome,
        avatar_url: avatarUrl
      })
      .eq("user_id", usuarioAtual.id);

    error = resultado.error;

  } else {

    const resultado = await supabaseClient
      .from("perfis")
      .insert([dados]);

    error = resultado.error;
  }

  if (error) {
    alert(error.message);
    return;
  }

  if (novoPin) {
    const { error: erroPin } = await supabaseClient.rpc("configurar_pin_acesso", { p_pin: novoPin });
    if (erroPin) {
      alert(mensagemErro(erroPin, "O perfil foi salvo, mas não foi possível alterar o PIN."));
      return;
    }
  }

  await carregarPerfil();

  fecharPerfil();

  alert("Perfil atualizado com sucesso.");
}

async function excluirPerfil() {
  const publicIdExcluido = perfilAtual?.public_id;
  const confirmar = confirm(
    "Tem certeza que deseja excluir seu perfil e todos os seus dados financeiros?\n\nEssa ação não poderá ser desfeita."
  );

  if (!confirmar) return;

  const { error } = await supabaseClient.functions.invoke("delete-account", {
    body: { confirmar: true }
  });

  if (error) {
    alert(mensagemErro(error, "Não foi possível excluir sua conta."));
    return;
  }

  await supabaseClient.auth.signOut({ scope: "local" });
  usuarioAtual = null;
  perfilAtual = null;
  appContainer.classList.add("hidden");
  if (publicIdExcluido) salvarIdsContas(idsContasLembradas().filter(id => id !== publicIdExcluido));
  await mostrarSeletorContas();

  alert("Sua conta e seus dados foram excluídos.");
}

const formCartao = document.getElementById("formCartao");

const botaoCancelarEdicaoCartao =
  document.getElementById("cancelarEdicaoCartao");

if (botaoCancelarEdicaoCartao) {
  botaoCancelarEdicaoCartao.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();

    cancelarEdicaoCartao();
  });
}

formCartao.addEventListener("submit", async function(e) {
  e.preventDefault();

  const totalParcelas = Number(document.getElementById("cartaoTotalParcelas").value);
  const parcelasPagas = Number(document.getElementById("cartaoParcelasPagas").value);

  if (parcelasPagas > totalParcelas) {
    alert("Parcelas pagas não pode ser maior que o total de parcelas.");
    return;
  }

  const dadosParcelamento = {
    user_id: usuarioAtual.id,
    cartao_nome: document.getElementById("cartaoNome").value.trim(),
    cartao_final: document.getElementById("cartaoFinal").value.trim(),
    descricao: document.getElementById("cartaoDescricao").value.trim(),
    valor_total: Number(document.getElementById("cartaoValorTotal").value),
    total_parcelas: totalParcelas,
    parcelas_pagas: parcelasPagas,
    data_primeira_parcela: document.getElementById("cartaoDataPrimeiraParcela").value,
    dia_vencimento: Number(document.getElementById("cartaoDiaVencimento").value),
    status: parcelasPagas >= totalParcelas ? "quitado" : "ativo"
  };

  let resposta;

  if (editandoCartaoId) {
    resposta = await supabaseClient
      .from("cartoes_parcelas")
      .update(dadosParcelamento)
      .eq("id", editandoCartaoId)
      .eq("user_id", usuarioAtual.id);
  } else {
    resposta = await supabaseClient
      .from("cartoes_parcelas")
      .insert([dadosParcelamento]);
  }

  if (resposta.error) {
    alert("Erro ao salvar parcelamento.");
    return;
  }

 const estavaEditando = !!editandoCartaoId;

await carregarDados();

atualizarTudo();
limparFormularioCartao();

alert(
  estavaEditando
    ? "Parcelamento atualizado!"
    : "Compra parcelada adicionada!"
);
});

function atualizarCartoes() {
  const listaCartoes = document.getElementById("listaCartoes");
  listaCartoes.innerHTML = "";

  let totalAberto = 0;
  let parcelasPendentes = 0;
  let comprasQuitadas = 0;

  const hoje = hojeTexto();

  if (!cartoesParcelados || cartoesParcelados.length === 0) {
    listaCartoes.innerHTML = "<p>Nenhuma compra parcelada cadastrada ainda.</p>";
  }

  const ordenados = [...cartoesParcelados]
    .map(item => {
      const proximoVencimento = calcularProximoVencimento(item);
      let prioridade = 2;

      if (!proximoVencimento) {
        prioridade = 3;
      } else if (proximoVencimento < hoje) {
        prioridade = 0;
      } else if (proximoVencimento === hoje) {
        prioridade = 1;
      }

      return {
        ...item,
        proximoVencimento,
        prioridade
      };
    })
    .sort((a, b) => {
      if (a.prioridade !== b.prioridade) {
        return a.prioridade - b.prioridade;
      }

      if (!a.proximoVencimento) return 1;
      if (!b.proximoVencimento) return -1;

      return new Date(a.proximoVencimento) - new Date(b.proximoVencimento);
    });

  ordenados.forEach(item => {
    const valorParcela = Number(item.valor_total) / Number(item.total_parcelas);
    const restantes = Number(item.total_parcelas) - Number(item.parcelas_pagas);
    const valorRestante = valorParcela * restantes;
    const percentualPago = (Number(item.parcelas_pagas) / Number(item.total_parcelas)) * 100;

    let statusTexto = "Em andamento";
    let statusClasse = "status-open";

    if (restantes <= 0 || item.status === "quitado") {
      comprasQuitadas += 1;
      statusTexto = "Quitado";
      statusClasse = "status-open";
    } else {
      totalAberto += valorRestante;
      parcelasPendentes += restantes;

      if (item.proximoVencimento < hoje) {
        statusTexto = "Parcela vencida";
        statusClasse = "status-late";
      } else if (item.proximoVencimento === hoje) {
        statusTexto = "Vence hoje";
        statusClasse = "status-today";
      } else {
        statusTexto = "Em andamento";
        statusClasse = "status-open";
      }
    }

    const div = document.createElement("div");
    const mesAtual = hojeTexto().slice(0, 7);
const parcelaEhDoMesAtual =
  item.proximoVencimento &&
  item.proximoVencimento.slice(0, 7) === mesAtual;

div.className = parcelaEhDoMesAtual || restantes <= 0
  ? "fixed-bill"
  : "fixed-bill cartao-futuro";

    div.innerHTML = `
      <div>
        <strong>${escaparHTML(item.descricao)}</strong>
        <p>
          Cartão: ${escaparHTML(item.cartao_nome)}
          ${item.cartao_final ? " • Final " + escaparHTML(item.cartao_final) : ""}
        </p>

      <p>
  Próxima fatura:
  ${item.proximoVencimento ? formatarData(item.proximoVencimento) : "Quitado"}
</p>

<p>
  ${
    item.proximoVencimento && item.proximoVencimento.slice(0, 7) === hojeTexto().slice(0, 7)
      ? "Esta parcela entra nas pendências deste mês."
      : "Esta parcela ainda não entra nas pendências deste mês."
  }
</p>

        <p>
          ${item.total_parcelas}x de ${formatarMoeda(valorParcela)}
          • Pagas: ${item.parcelas_pagas}
          • Restantes: ${Math.max(restantes, 0)}
        </p>

        <p>
          Total: ${formatarMoeda(item.valor_total)}
          • Em aberto: ${formatarMoeda(Math.max(valorRestante, 0))}
        </p>

        <div class="meta-bar">
          <div class="meta-fill" style="width:${Math.min(percentualPago, 100)}%"></div>
        </div>

        <span class="status ${statusClasse}">
          ${statusTexto}
        </span>
      </div>

      <div class="bill-actions">
        ${
          restantes > 0
            ? `<button type="button" onclick="pagarParcelaCartao(${item.id})">Pagar próxima parcela</button>`
            : ""
        }
        <button type="button" onclick="editarParcelamento(${item.id})">Editar</button>
        <button type="button" class="danger" onclick="excluirParcelamento(${item.id})">Excluir</button>
      </div>
    `;

    listaCartoes.appendChild(div);
  });

  document.getElementById("totalCartoesAberto").textContent = formatarMoeda(totalAberto);
  document.getElementById("totalParcelasPendentes").textContent = parcelasPendentes;
  document.getElementById("totalComprasQuitadas").textContent = comprasQuitadas;
}

async function pagarParcelaCartao(id) {
  const item = cartoesParcelados.find(p => p.id === id);
  if (!item) return;

  const { error } = await supabaseClient.rpc("pagar_parcela_cartao", {
    p_parcelamento_id: id
  });

  if (error) {
    alert(mensagemErro(error, "Erro ao pagar parcela."));
    return;
  }

  await carregarDados();
  atualizarTudo();

  alert("Parcela paga e adicionada aos lançamentos!");
}

async function excluirParcelamento(id) {
  const confirmar = confirm(
    "Deseja excluir este parcelamento?\n\nAs parcelas lançadas por ele também serão removidas dos lançamentos."
  );

  if (!confirmar) return;

  const { error } = await supabaseClient.rpc("excluir_parcelamento_cartao", {
    p_parcelamento_id: id
  });

  if (error) {
    alert(mensagemErro(error, "Erro ao excluir parcelamento."));
    return;
  }

  await carregarDados();
  atualizarTudo();
}

function calcularProximoVencimento(item) {
  const totalParcelas = Number(item.total_parcelas);
  const pagas = Number(item.parcelas_pagas);

  if (pagas >= totalParcelas) {
    return null;
  }

  const diaVencimento = Number(item.dia_vencimento);
  const [anoBase, mesBase] = item.data_primeira_parcela.split("-").map(Number);
  const indiceMes = anoBase * 12 + (mesBase - 1) + pagas;
  const ano = Math.floor(indiceMes / 12);
  const mes = indiceMes % 12;

  const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();
  const diaFinal = Math.min(diaVencimento, ultimoDiaMes);

  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;
}

function limparFormularioCartao() {
  document.getElementById("formCartao").reset();

  if (calendarioCartaoPrimeiraParcela) {
    calendarioCartaoPrimeiraParcela.setDate(hojeTexto(), true);
  }

  editandoCartaoId = null;

  document.getElementById("botaoCartao").textContent = "Adicionar compra parcelada";
  document.getElementById("cancelarEdicaoCartao").classList.add("hidden");
}

function cancelarEdicaoCartao() {

  editandoCartaoId = null;

  document.getElementById("cartaoNome").value = "";
  document.getElementById("cartaoFinal").value = "";
  document.getElementById("cartaoDescricao").value = "";
  document.getElementById("cartaoValorTotal").value = "";
  document.getElementById("cartaoTotalParcelas").value = "";
  document.getElementById("cartaoParcelasPagas").value = 0;
  document.getElementById("cartaoDiaVencimento").value = "";

  if (calendarioCartaoPrimeiraParcela) {
    calendarioCartaoPrimeiraParcela.setDate(hojeTexto(), true);
  } else {
    document.getElementById("cartaoDataPrimeiraParcela").value = hojeTexto();
  }

  document.getElementById("botaoCartao").textContent =
    "Adicionar compra parcelada";

  document
    .getElementById("cancelarEdicaoCartao")
    .classList.add("hidden");

  mostrarAba("cartoes");
}

function editarParcelamento(id) {
  const item = cartoesParcelados.find(p => p.id === id);
  if (!item) return;

  editandoCartaoId = id;

  document.getElementById("cartaoNome").value = item.cartao_nome || "";
  document.getElementById("cartaoFinal").value = item.cartao_final || "";
  document.getElementById("cartaoDescricao").value = item.descricao || "";
  document.getElementById("cartaoValorTotal").value = item.valor_total || "";
  document.getElementById("cartaoTotalParcelas").value = item.total_parcelas || "";
  document.getElementById("cartaoParcelasPagas").value = item.parcelas_pagas || 0;
  document.getElementById("cartaoDiaVencimento").value = item.dia_vencimento || "";

  if (calendarioCartaoPrimeiraParcela) {
    calendarioCartaoPrimeiraParcela.setDate(item.data_primeira_parcela, true);
  } else {
    document.getElementById("cartaoDataPrimeiraParcela").value = item.data_primeira_parcela;
  }

  document.getElementById("botaoCartao").textContent = "Salvar alterações";
  document.getElementById("cancelarEdicaoCartao").classList.remove("hidden");

  mostrarAba("cartoes");

  document.getElementById("formCartao").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function parcelasCartaoDoMes(mesReferencia = hojeTexto().slice(0, 7)) {
  let total = 0;

  cartoesParcelados.forEach(item => {
    const proximoVencimento = calcularProximoVencimento(item);

    if (!proximoVencimento) return;

    const mesParcela = proximoVencimento.slice(0, 7);

    if (mesParcela === mesReferencia) {
      const valorParcela = Number(item.valor_total) / Number(item.total_parcelas);
      total += valorParcela;
    }
  });

  return total;
}

function parcelasCartaoDoMesAtual() {
  return parcelasCartaoDoMes(hojeTexto().slice(0, 7));
}

function limparFormularioContaFixa() {
  formContaFixa.reset();
  document.getElementById("grupoConta").value = "";

  if (calendarioVencimento) {
    calendarioVencimento.setDate(hojeTexto(), true);
  } else {
    document.getElementById("dataVencimentoConta").value = hojeTexto();
  }

  editandoContaFixaId = null;

  document.getElementById("botaoContaFixa").textContent = "Adicionar conta fixa";
  document.getElementById("cancelarEdicaoContaFixa").classList.add("hidden");
}

function cancelarEdicaoContaFixa() {
  limparFormularioContaFixa();
}

function editarContaFixa(id) {
  const conta = contasFixas.find(c => c.id === id);
  if (!conta) return;

  editandoContaFixaId = id;

  document.getElementById("nomeConta").value = conta.nome || "";
  document.getElementById("valorConta").value = conta.valor || "";
  document.getElementById("grupoConta").value = conta.grupo_id || "";

  if (calendarioVencimento) {
    calendarioVencimento.setDate(conta.vencimento, true);
  } else {
    document.getElementById("dataVencimentoConta").value = conta.vencimento;
  }

  document.getElementById("botaoContaFixa").textContent = "Salvar alterações";
  document.getElementById("cancelarEdicaoContaFixa").classList.remove("hidden");

  mostrarAba("contas");

  formContaFixa.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

document.getElementById("formOrcamento").addEventListener("submit", async function(event) {
  event.preventDefault();
  const dados = {
    user_id: usuarioAtual.id,
    mes: `${mesDashboard}-01`,
    categoria: document.getElementById("orcamentoCategoria").value.trim(),
    limite: Number(document.getElementById("orcamentoLimite").value)
  };
  if (!dados.categoria || dados.limite <= 0) return alert("Preencha uma categoria e um limite maior que zero.");
  const resposta = editandoOrcamentoId
    ? await supabaseClient.from("orcamentos").update(dados).eq("id", editandoOrcamentoId).eq("user_id", usuarioAtual.id)
    : await supabaseClient.from("orcamentos").insert([dados]);
  if (resposta.error) return alert(mensagemErro(resposta.error, "Não foi possível salvar o orçamento."));
  cancelarEdicaoOrcamento();
  await carregarDados();
  atualizarTudo();
});

function editarOrcamento(id) {
  const item = orcamentos.find(o => o.id === id);
  if (!item) return;
  editandoOrcamentoId = id;
  document.getElementById("orcamentoCategoria").value = item.categoria;
  document.getElementById("orcamentoLimite").value = item.limite;
  document.getElementById("tituloFormOrcamento").textContent = "Editar limite";
  document.getElementById("botaoOrcamento").textContent = "Salvar alterações";
  document.getElementById("cancelarOrcamento").classList.remove("hidden");
}

function cancelarEdicaoOrcamento() {
  editandoOrcamentoId = null;
  document.getElementById("formOrcamento").reset();
  document.getElementById("tituloFormOrcamento").textContent = "Criar limite mensal";
  document.getElementById("botaoOrcamento").textContent = "Salvar orçamento";
  document.getElementById("cancelarOrcamento").classList.add("hidden");
}

async function removerOrcamento(id) {
  if (!confirm("Excluir este orçamento?")) return;
  const { error } = await supabaseClient.from("orcamentos").delete().eq("id", id).eq("user_id", usuarioAtual.id);
  if (error) return alert(mensagemErro(error, "Não foi possível excluir."));
  await carregarDados(); atualizarTudo();
}

document.getElementById("formObjetivo").addEventListener("submit", async function(event) {
  event.preventDefault();
  const valorAlvo = Number(document.getElementById("objetivoValorAlvo").value);
  const valorAtual = Number(document.getElementById("objetivoValorAtual").value);
  const dados = {
    user_id: usuarioAtual.id,
    nome: document.getElementById("objetivoNome").value.trim(),
    tipo: document.getElementById("objetivoTipo").value,
    valor_alvo: valorAlvo,
    valor_atual: valorAtual,
    prazo: document.getElementById("objetivoPrazo").value || null,
    status: valorAtual >= valorAlvo ? "concluido" : "ativo"
  };
  if (!dados.nome || valorAlvo <= 0 || valorAtual < 0) return alert("Revise os dados do objetivo.");
  const resposta = editandoObjetivoId
    ? await supabaseClient.from("objetivos_financeiros").update(dados).eq("id", editandoObjetivoId).eq("user_id", usuarioAtual.id)
    : await supabaseClient.from("objetivos_financeiros").insert([dados]);
  if (resposta.error) return alert(mensagemErro(resposta.error, "Não foi possível salvar o objetivo."));
  cancelarEdicaoObjetivo();
  await carregarDados(); atualizarTudo();
});

function editarObjetivo(id) {
  const item = objetivosFinanceiros.find(o => o.id === id);
  if (!item) return;
  editandoObjetivoId = id;
  document.getElementById("objetivoNome").value = item.nome;
  document.getElementById("objetivoTipo").value = item.tipo;
  document.getElementById("objetivoValorAlvo").value = item.valor_alvo;
  document.getElementById("objetivoValorAtual").value = item.valor_atual;
  document.getElementById("objetivoPrazo").value = item.prazo || "";
  document.getElementById("tituloFormObjetivo").textContent = "Editar objetivo";
  document.getElementById("botaoObjetivo").textContent = "Salvar alterações";
  document.getElementById("cancelarObjetivo").classList.remove("hidden");
}

function cancelarEdicaoObjetivo() {
  editandoObjetivoId = null;
  document.getElementById("formObjetivo").reset();
  document.getElementById("objetivoValorAtual").value = 0;
  document.getElementById("tituloFormObjetivo").textContent = "Transforme um plano em número";
  document.getElementById("botaoObjetivo").textContent = "Salvar objetivo";
  document.getElementById("cancelarObjetivo").classList.add("hidden");
}

async function aportarObjetivo(id) {
  const valor = Number(prompt("Quanto você quer adicionar a este objetivo?"));
  if (!valor || valor <= 0) return;
  const { error } = await supabaseClient.rpc("aportar_objetivo", { p_objetivo_id: id, p_valor: valor });
  if (error) return alert(mensagemErro(error, "Não foi possível registrar o aporte."));
  await carregarDados(); atualizarTudo();
}

async function removerObjetivo(id) {
  if (!confirm("Excluir este objetivo e todo o seu progresso?")) return;
  const { error } = await supabaseClient.from("objetivos_financeiros").delete().eq("id", id).eq("user_id", usuarioAtual.id);
  if (error) return alert(mensagemErro(error, "Não foi possível excluir."));
  await carregarDados(); atualizarTudo();
}

function atualizarPlanejamento() {
  if (!mesDashboard) return;
  const listaOrcamentos = document.getElementById("listaOrcamentos");
  const orcamentosMes = orcamentos.filter(item => item.mes?.slice(0, 7) === mesDashboard);
  let totalLimites = 0;
  let totalGasto = 0;
  listaOrcamentos.innerHTML = orcamentosMes.length ? orcamentosMes.map(item => {
    const limite = Number(item.limite);
    const gasto = gastoCategoria(item.categoria, mesDashboard);
    const percentual = limite > 0 ? gasto / limite * 100 : 0;
    totalLimites += limite; totalGasto += gasto;
    const classe = percentual > 100 ? "budget-danger" : percentual >= 80 ? "budget-warning" : "budget-ok";
    return `<div class="budget-item"><div class="bar-label"><strong>${escaparHTML(item.categoria)}</strong><span>${formatarMoeda(gasto)} de ${formatarMoeda(limite)}</span></div><div class="budget-track"><span class="${classe}" style="width:${Math.min(percentual, 100)}%"></span></div><div class="budget-footer"><small>${Math.round(percentual)}% utilizado</small><div><button class="link-button" onclick="editarOrcamento(${item.id})">Editar</button><button class="link-button danger-text" onclick="removerOrcamento(${item.id})">Excluir</button></div></div></div>`;
  }).join("") : '<p class="empty-state">Crie seu primeiro limite para o mês selecionado.</p>';
  document.getElementById("saldoOrcamentos").textContent = formatarMoeda(totalLimites - totalGasto);
  document.getElementById("resumoOrcamentos").textContent = orcamentosMes.length ? `${orcamentosMes.length} categoria(s)` : "Nenhum criado";

  const listaObjetivos = document.getElementById("listaObjetivos");
  listaObjetivos.innerHTML = objetivosFinanceiros.length ? objetivosFinanceiros.map(item => {
    const alvo = Number(item.valor_alvo), atual = Number(item.valor_atual), progresso = Math.min(100, atual / alvo * 100);
    return `<div class="goal-item ${item.status === "concluido" ? "goal-complete" : ""}"><div class="goal-heading"><div><span class="goal-type">${item.tipo === "reserva_emergencia" ? "Reserva" : "Objetivo"}</span><h3>${escaparHTML(item.nome)}</h3></div><strong>${Math.round(progresso)}%</strong></div><div class="budget-track"><span class="goal-progress" style="width:${progresso}%"></span></div><p>${formatarMoeda(atual)} de ${formatarMoeda(alvo)}${item.prazo ? ` · até ${formatarData(item.prazo)}` : ""}</p><div class="goal-actions"><button onclick="aportarObjetivo(${item.id})" ${item.status === "concluido" ? "disabled" : ""}>+ Adicionar valor</button><button class="secondary" onclick="editarObjetivo(${item.id})">Editar</button><button class="link-button danger-text" onclick="removerObjetivo(${item.id})">Excluir</button></div></div>`;
  }).join("") : '<p class="empty-state">Cadastre uma reserva, uma viagem ou qualquer plano que mereça prioridade.</p>';
  document.getElementById("resumoObjetivos").textContent = objetivosFinanceiros.length ? `${objetivosFinanceiros.filter(item => item.status === "concluido").length}/${objetivosFinanceiros.length} concluídos` : "Nenhum criado";
}

function atualizarTudo() {
  atualizarTela();
  atualizarContasFixas();
  atualizarGruposContas();
  atualizarCartoes();
  atualizarDashboard();
  atualizarPlanejamento();
}
