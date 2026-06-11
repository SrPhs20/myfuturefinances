SUPABASE_URL = "https://hjafylznpribmpumcgtk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqYWZ5bHpucHJpYm1wdW1jZ3RrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMzA1NzcsImV4cCI6MjA5NjcwNjU3N30.a1Tg7EAsusekhQ3gdUopSE4b0MDSbP-YQEiv3khQeI4";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioAtual = null;
let lancamentos = [];
let contasFixas = [];
let metaMensal = 0;
let perfilAtual = null;

let editandoId = null;
let calendarioData;
let calendarioVencimento;

const appContainer = document.querySelector(".container");
appContainer.classList.add("hidden");

document.body.insertAdjacentHTML("afterbegin", `
<section id="authScreen" class="auth-screen">

  <div class="auth-card" id="loginBox">

    <h1>Minhas Finanças</h1>
    <p>Entre na sua conta</p>

    <label>Email</label>
    <input id="authEmail" type="email" placeholder="Seu email" />

    <label>Senha</label>
    <input id="authSenha" type="password" placeholder="Sua senha" />

    <button onclick="entrar()">Entrar</button>

    <button class="secondary" onclick="mostrarCadastro()">
      Criar conta
    </button>

    <p id="authMensagem"></p>

  </div>

  <div class="auth-card hidden" id="cadastroBox">

    <h1>Criar conta</h1>

    <label>Nome</label>
    <input id="authNome" type="text" placeholder="Seu nome" />

    <label>Email</label>
    <input id="authEmailCadastro" type="email" placeholder="Seu email" />

    <label>Senha</label>
    <input id="authSenhaCadastro" type="password" placeholder="Sua senha" />

    <button onclick="cadastrar()">
      Criar conta
    </button>

    <button class="secondary" onclick="mostrarLogin()">
      Voltar para login
    </button>

  </div>

</section>
`);

document.getElementById("loginBox").classList.remove("hidden");
document.getElementById("cadastroBox").classList.add("hidden");

function mostrarCadastro() {
  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("cadastroBox").classList.remove("hidden");
}

function mostrarLogin() {
  document.getElementById("cadastroBox").classList.add("hidden");
  document.getElementById("loginBox").classList.remove("hidden");
}

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
const botaoLancamento = document.getElementById("botaoLancamento");
const avisoEdicao = document.getElementById("avisoEdicao");

function hojeTexto() {
  return new Date().toISOString().split("T")[0];
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
  document.getElementById("authMensagem").textContent = texto;
}

async function cadastrar() {
  const nome = document.getElementById("authNome").value.trim();

const email = document
  .getElementById("authEmailCadastro")
  .value.trim();

const senha = document
  .getElementById("authSenhaCadastro")
  .value.trim();

  if (!nome || !email || !senha) {
    mostrarMensagemAuth("Preencha todos os campos.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password: senha
  });

  if (error) {
    mostrarMensagemAuth(error.message);
    return;
  }

  if (data.user) {
    await supabaseClient.from("perfis").insert([{
      user_id: data.user.id,
      nome: nome,
      avatar_url: ""
    }]);
  }

  document.getElementById("authSenha").value = "";

  alert("Conta criada com sucesso.");

mostrarLogin();

document.getElementById("authSenhaCadastro").value = "";
}

async function entrar() {
  const email = document.getElementById("authEmail").value.trim();
  const senha = document.getElementById("authSenha").value.trim();

  if (!email || !senha) {
    mostrarMensagemAuth("Digite email e senha.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password: senha
  });

  if (error) {
    mostrarMensagemAuth(error.message);
    return;
  }

  usuarioAtual = data.user;
  await iniciarApp();
}

async function sair() {
  await supabaseClient.auth.signOut();
  usuarioAtual = null;
  appContainer.classList.add("hidden");
  authScreen.classList.remove("hidden");
}

async function verificarSessao() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    document.getElementById("modalPerfil").classList.add("hidden");
    usuarioAtual = data.session.user;
    await iniciarApp();
  } else {
    appContainer.classList.add("hidden");
    authScreen.classList.remove("hidden");
  }
}

async function iniciarApp() {

  authScreen.classList.add("hidden");

  appContainer.classList.remove("hidden");

  await carregarPerfil();
  await carregarDados();

  configurarCalendarios();

  atualizarTela();
  atualizarContasFixas();

  fecharPerfil();
}

async function carregarDados() {
  const { data: dadosLancamentos } = await supabaseClient
    .from("lancamentos")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .order("data", { ascending: false });

  const { data: dadosContas } = await supabaseClient
    .from("contas_fixas")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .order("vencimento", { ascending: true });

  const { data: dadosMetas } = await supabaseClient
    .from("metas")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .limit(1);

  lancamentos = dadosLancamentos || [];
  contasFixas = dadosContas || [];
  metaMensal = dadosMetas && dadosMetas.length > 0 ? Number(dadosMetas[0].valor) : 0;
}

function mostrarAba(aba) {
  document.getElementById("abaDashboard").classList.toggle("hidden", aba !== "dashboard");
  document.getElementById("abaLancamentos").classList.toggle("hidden", aba !== "lancamentos");
  document.getElementById("abaContas").classList.toggle("hidden", aba !== "contas");

  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(tab => tab.classList.remove("active"));

  if (aba === "dashboard") tabs[0].classList.add("active");
  if (aba === "lancamentos") tabs[1].classList.add("active");
  if (aba === "contas") tabs[2].classList.add("active");
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
      <td>${item.categoria}</td>
      <td>${item.descricao}</td>
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

  const novaConta = {
    nome: document.getElementById("nomeConta").value.trim(),
    valor: Number(document.getElementById("valorConta").value),
    vencimento: document.getElementById("dataVencimentoConta").value || hojeTexto(),
    user_id: usuarioAtual.id
  };

  if (!novaConta.nome) {
    alert("Digite o nome da conta.");
    return;
  }

  if (novaConta.valor <= 0) {
    alert("Digite um valor maior que zero.");
    return;
  }

  const { error } = await supabaseClient
    .from("contas_fixas")
    .insert([novaConta]);

  if (error) {
    alert("Erro ao adicionar conta fixa.");
    return;
  }

  await carregarDados();
  atualizarContasFixas();
  atualizarDashboard();

  formContaFixa.reset();

  if (calendarioVencimento) {
    calendarioVencimento.setDate(hojeTexto(), true);
  }
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

  await carregarDados();
  atualizarContasFixas();
  atualizarDashboard();
}

async function pagarContaFixa(id) {
  const conta = contasFixas.find(c => c.id === id);
  if (!conta) return;

  const novoLancamento = {
    tipo: "despesa",
    categoria: "Conta fixa",
    descricao: conta.nome,
    valor: Number(conta.valor),
    data: hojeTexto(),
    user_id: usuarioAtual.id
  };

  const dataAtual = new Date(conta.vencimento + "T00:00:00");
  dataAtual.setMonth(dataAtual.getMonth() + 1);
  const novoVencimento = dataAtual.toISOString().split("T")[0];

  const { error: erroLancamento } = await supabaseClient
    .from("lancamentos")
    .insert([novoLancamento]);

  if (erroLancamento) {
    alert("Erro ao lançar pagamento.");
    return;
  }

  const { error: erroConta } = await supabaseClient
    .from("contas_fixas")
    .update({ vencimento: novoVencimento })
    .eq("id", id)
    .eq("user_id", usuarioAtual.id);

  if (erroConta) {
    alert("Erro ao atualizar vencimento.");
    return;
  }

  await carregarDados();
  atualizarTela();
  atualizarContasFixas();

  alert("Conta paga! Ela foi adicionada nas despesas e voltou para o próximo mês.");
}

function atualizarContasFixas() {
  const listaContas = document.getElementById("listaContasFixas");
  listaContas.innerHTML = "";

  let totalFixas = 0;
  let totalAbertas = 0;
  let totalVencidas = 0;

  const hoje = hojeTexto();

  if (contasFixas.length === 0) {
    listaContas.innerHTML = "<p>Nenhuma conta fixa cadastrada ainda.</p>";
  }

  const contasOrdenadas = [...contasFixas]
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
    totalFixas += Number(conta.valor);

    let status = "Em aberto";
    let classeStatus = "status-open";

    if (conta.vencimento < hoje) {
      status = "Vencida";
      classeStatus = "status-late";
      totalVencidas += Number(conta.valor);
      totalAbertas += Number(conta.valor);
    } else if (conta.vencimento === hoje) {
      status = "Vence hoje";
      classeStatus = "status-today";
      totalAbertas += Number(conta.valor);
    } else {
      totalAbertas += Number(conta.valor);
    }

    const div = document.createElement("div");
    div.className = "fixed-bill";

    div.innerHTML = `
      <div>
        <strong>${conta.nome}</strong>
        <p>${formatarMoeda(conta.valor)} • Vencimento: ${formatarData(conta.vencimento)}</p>
        <span class="status ${classeStatus}">${status}</span>
      </div>

      <div class="bill-actions">
        <button type="button" onclick="pagarContaFixa(${conta.id})">Marcar como paga</button>
        <button type="button" class="danger" onclick="removerContaFixa(${conta.id})">Excluir</button>
      </div>
    `;

    listaContas.appendChild(div);
  });

  document.getElementById("totalFixas").textContent = formatarMoeda(totalFixas);
  document.getElementById("totalFixasAbertas").textContent = formatarMoeda(totalAbertas);
  document.getElementById("totalFixasVencidas").textContent = formatarMoeda(totalVencidas);
}

function atualizarDashboard() {
  let receitas = 0;
  let despesas = 0;
  let contasPendentes = 0;

  const mesAtual = hojeTexto().slice(0, 7);

  lancamentos.forEach(item => {
    if (item.data && item.data.slice(0, 7) === mesAtual) {
      if (item.tipo === "receita") receitas += Number(item.valor);
      if (item.tipo === "despesa") despesas += Number(item.valor);
    }
  });

  contasFixas.forEach(conta => {
    contasPendentes += Number(conta.valor);
  });

  const saldoAtual = receitas - despesas;
  const saldoPrevisto = saldoAtual - contasPendentes;
  const economiaMes = receitas - despesas;

  document.getElementById("dashSaldoAtual").textContent = formatarMoeda(saldoAtual);
  document.getElementById("dashContasPendentes").textContent = formatarMoeda(contasPendentes);
  document.getElementById("dashSaldoPrevisto").textContent = formatarMoeda(saldoPrevisto);
  document.getElementById("dashEconomiaMes").textContent = formatarMoeda(economiaMes);

  const alerta = document.getElementById("alertaFinanceiro");

  if (receitas === 0 && despesas === 0) {
    alerta.className = "alert-box alert-neutral";
    alerta.innerHTML = "Adicione seus lançamentos para gerar uma análise financeira.";
  } else if (saldoPrevisto < 0) {
    alerta.className = "alert-box alert-danger";
    alerta.innerHTML = "Atenção: considerando suas contas pendentes, seu saldo previsto está negativo.";
  } else if (despesas > receitas * 0.8) {
    alerta.className = "alert-box alert-warning";
    alerta.innerHTML = "Cuidado: suas despesas já estão consumindo grande parte das receitas do mês.";
  } else {
    alerta.className = "alert-box alert-success";
    alerta.innerHTML = "Boa! Seu saldo previsto está positivo considerando suas contas pendentes.";
  }

  atualizarMetaMensal();
}

function atualizarMetaMensal() {
  const valorMetaInput = document.getElementById("valorMeta");
  const barraMeta = document.getElementById("barraMeta");
  const porcentagemMeta = document.getElementById("porcentagemMeta");
  const textoMeta = document.getElementById("textoMeta");

  if (!valorMetaInput || !barraMeta || !porcentagemMeta || !textoMeta) return;

  valorMetaInput.value = metaMensal > 0 ? metaMensal : "";

  let receitas = 0;
  let despesas = 0;
  const mesAtual = hojeTexto().slice(0, 7);

  lancamentos.forEach(item => {
    if (item.data && item.data.slice(0, 7) === mesAtual) {
      if (item.tipo === "receita") receitas += Number(item.valor);
      if (item.tipo === "despesa") despesas += Number(item.valor);
    }
  });

  const economia = receitas - despesas;
  const progresso = metaMensal > 0 ? Math.min((economia / metaMensal) * 100, 100) : 0;

  barraMeta.style.width = `${Math.max(progresso, 0)}%`;
  porcentagemMeta.textContent = `${Math.round(Math.max(progresso, 0))}%`;

  if (metaMensal <= 0) {
    textoMeta.textContent = "Defina uma meta mensal para acompanhar seu progresso.";
  } else if (economia >= metaMensal) {
    textoMeta.textContent = "Parabéns! Você atingiu sua meta mensal.";
  } else {
    textoMeta.textContent = `Faltam ${formatarMoeda(metaMensal - economia)} para atingir sua meta.`;
  }
}

document.getElementById("formMeta").addEventListener("submit", async function(e) {
  e.preventDefault();

  const novoValor = Number(document.getElementById("valorMeta").value);

  if (novoValor <= 0) {
    alert("Digite uma meta maior que zero.");
    return;
  }

  const { data: metasExistentes } = await supabaseClient
    .from("metas")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .limit(1);

  if (metasExistentes && metasExistentes.length > 0) {
    const { error } = await supabaseClient
      .from("metas")
      .update({ valor: novoValor })
      .eq("id", metasExistentes[0].id)
      .eq("user_id", usuarioAtual.id);

    if (error) {
      alert("Erro ao atualizar meta.");
      return;
    }
  } else {
    const { error } = await supabaseClient
      .from("metas")
      .insert([{ valor: novoValor, user_id: usuarioAtual.id }]);

    if (error) {
      alert("Erro ao salvar meta.");
      return;
    }
  }

  metaMensal = novoValor;
  await carregarDados();
  atualizarDashboard();
});

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
        <span>${categoria}</span>
        <span>${formatarMoeda(valor)}</span>
      </div>
      <div class="bar-fill" style="width:${largura}%"></div>
    `;

    grafico.appendChild(div);
  });
}

async function limparTudo() {
  if (!confirm("Tem certeza que deseja apagar todos os seus dados?")) return;

  await supabaseClient.from("lancamentos").delete().eq("user_id", usuarioAtual.id);
  await supabaseClient.from("contas_fixas").delete().eq("user_id", usuarioAtual.id);
  await supabaseClient.from("metas").delete().eq("user_id", usuarioAtual.id);

  await carregarDados();
  atualizarTela();
  atualizarContasFixas();
}

function exportarDados() {
  const dados = JSON.stringify({ lancamentos, contasFixas, metaMensal }, null, 2);
  const blob = new Blob([dados], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "minhas-financas.json";
  a.click();

  URL.revokeObjectURL(url);
}

async function importarDados(event) {
  alert("Importação será adaptada para Supabase depois. Por enquanto, use o app normalmente com login.");
}

verificarSessao();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").then(function(registration) {
    registration.update();
  });
}

function converterImagemParaBase64(arquivo) {
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

        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };

      img.src = evento.target.result;
    };

    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

async function carregarPerfil() {
  const { data } = await supabaseClient
    .from("perfis")
    .select("*")
    .eq("user_id", usuarioAtual.id)
    .single();

  perfilAtual = data;

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

  if (!nome) {
    alert("Digite seu nome.");
    return;
  }

  let avatarUrl = perfilAtual?.avatar_url || "";

  const foto = document.getElementById("perfilFoto").files[0];

  if (foto) {
    avatarUrl = await converterImagemParaBase64(foto);
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

  await carregarPerfil();

  fecharPerfil();

  alert("Perfil atualizado com sucesso.");
}

async function excluirPerfil() {
  const confirmar = confirm(
    "Tem certeza que deseja excluir seu perfil e todos os seus dados financeiros?\n\nEssa ação não poderá ser desfeita."
  );

  if (!confirmar) return;

  await supabaseClient.from("lancamentos").delete().eq("user_id", usuarioAtual.id);
  await supabaseClient.from("contas_fixas").delete().eq("user_id", usuarioAtual.id);
  await supabaseClient.from("metas").delete().eq("user_id", usuarioAtual.id);
  await supabaseClient.from("perfis").delete().eq("user_id", usuarioAtual.id);

  await sair();

  alert("Seu perfil e dados foram excluídos deste app.");
}

function mostrarCadastro() {
  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("cadastroBox").classList.remove("hidden");
}

function mostrarLogin() {
  document.getElementById("cadastroBox").classList.add("hidden");
  document.getElementById("loginBox").classList.remove("hidden");
}