let lancamentos = JSON.parse(localStorage.getItem("lancamentos")) || [];
let contasFixas = JSON.parse(localStorage.getItem("contasFixas")) || [];
let metaMensal = Number(localStorage.getItem("metaMensal")) || 0;

let editandoIndex = null;
let calendarioData;
let calendarioVencimento;

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

function salvar() {
  localStorage.setItem("lancamentos", JSON.stringify(lancamentos));
  localStorage.setItem("contasFixas", JSON.stringify(contasFixas));
  localStorage.setItem("metaMensal", metaMensal);
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

function limparFormularioLancamento() {
  form.reset();

  if (calendarioData) {
    calendarioData.setDate(hojeTexto(), true);
  } else {
    document.getElementById("data").value = hojeTexto();
  }

  editandoIndex = null;
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
    const indexOriginal = lancamentos.indexOf(item);
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
        <button type="button" onclick="editarLancamento(${indexOriginal})">Editar</button>
        <button type="button" class="danger" onclick="remover(${indexOriginal})">Excluir</button>
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

form.addEventListener("submit", function(e) {
  e.preventDefault();

  const novo = {
    tipo: document.getElementById("tipo").value,
    categoria: document.getElementById("categoria").value.trim(),
    descricao: document.getElementById("descricao").value.trim(),
    valor: Number(document.getElementById("valor").value),
    data: document.getElementById("data").value || hojeTexto()
  };

  if (!novo.categoria || !novo.descricao) {
    alert("Preencha categoria e descrição.");
    return;
  }

  if (novo.valor <= 0) {
    alert("Digite um valor maior que zero.");
    return;
  }

  if (editandoIndex !== null) {
    lancamentos[editandoIndex] = novo;
  } else {
    lancamentos.push(novo);
  }

  salvar();
  atualizarTela();
  limparFormularioLancamento();
});

function editarLancamento(index) {
  const item = lancamentos[index];

  if (!item) return;

  editandoIndex = index;

  document.getElementById("tipo").value = item.tipo;
  document.getElementById("categoria").value = item.categoria;
  document.getElementById("descricao").value = item.descricao;
  document.getElementById("valor").value = item.valor;

  if (calendarioData) {
    calendarioData.setDate(item.data, true);
  } else {
    document.getElementById("data").value = item.data;
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

function remover(index) {
  const confirmar = confirm(
    "Tem certeza que deseja excluir este lançamento?\n\nEssa ação não poderá ser desfeita."
  );

  if (!confirmar) return;

  lancamentos.splice(index, 1);

  if (editandoIndex === index) {
    limparFormularioLancamento();
  }

  salvar();
  atualizarTela();
}

formContaFixa.addEventListener("submit", function(e) {
  e.preventDefault();

  const novaConta = {
    nome: document.getElementById("nomeConta").value.trim(),
    valor: Number(document.getElementById("valorConta").value),
    vencimento: document.getElementById("dataVencimentoConta").value || hojeTexto()
  };

  if (!novaConta.nome) {
    alert("Digite o nome da conta.");
    return;
  }

  if (novaConta.valor <= 0) {
    alert("Digite um valor maior que zero.");
    return;
  }

  contasFixas.push(novaConta);
  salvar();
  atualizarContasFixas();
  atualizarDashboard();

  formContaFixa.reset();

  if (calendarioVencimento) {
    calendarioVencimento.setDate(hojeTexto(), true);
  } else {
    document.getElementById("dataVencimentoConta").value = hojeTexto();
  }
});

function removerContaFixa(index) {
  if (confirm("Deseja excluir esta conta fixa?")) {
    contasFixas.splice(index, 1);
    salvar();
    atualizarContasFixas();
    atualizarDashboard();
  }
}

function pagarContaFixa(index) {
  const conta = contasFixas[index];

  lancamentos.push({
    tipo: "despesa",
    categoria: "Conta fixa",
    descricao: conta.nome,
    valor: Number(conta.valor),
    data: hojeTexto()
  });

  const dataAtual = new Date(conta.vencimento + "T00:00:00");
  dataAtual.setMonth(dataAtual.getMonth() + 1);
  conta.vencimento = dataAtual.toISOString().split("T")[0];

  salvar();
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

  const contasOrdenadas = contasFixas
    .map((conta, indexOriginal) => {
      let prioridade = 2;

      if (conta.vencimento < hoje) prioridade = 0;
      if (conta.vencimento === hoje) prioridade = 1;

      return { ...conta, indexOriginal, prioridade };
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
        <button type="button" onclick="pagarContaFixa(${conta.indexOriginal})">Marcar como paga</button>
        <button type="button" class="danger" onclick="removerContaFixa(${conta.indexOriginal})">Excluir</button>
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

  const hoje = hojeTexto();
  const mesAtual = hoje.slice(0, 7);

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

document.getElementById("formMeta").addEventListener("submit", function(e) {
  e.preventDefault();

  metaMensal = Number(document.getElementById("valorMeta").value);

  if (metaMensal <= 0) {
    alert("Digite uma meta maior que zero.");
    return;
  }

  salvar();
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

function limparTudo() {
  if (confirm("Tem certeza que deseja apagar todos os dados?")) {
    lancamentos = [];
    contasFixas = [];
    metaMensal = 0;
    salvar();
    atualizarTela();
    atualizarContasFixas();
  }
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

function importarDados(event) {
  const arquivo = event.target.files[0];
  if (!arquivo) return;

  const leitor = new FileReader();

  leitor.onload = function(e) {
    try {
      const dados = JSON.parse(e.target.result);

      if (Array.isArray(dados)) {
        lancamentos = dados;
        contasFixas = [];
        metaMensal = 0;
      } else {
        lancamentos = dados.lancamentos || [];
        contasFixas = dados.contasFixas || [];
        metaMensal = Number(dados.metaMensal) || 0;
      }

      salvar();
      atualizarTela();
      atualizarContasFixas();
      alert("Dados importados com sucesso!");
    } catch {
      alert("Erro ao importar arquivo.");
    }
  };

  leitor.readAsText(arquivo);
}

calendarioData = flatpickr("#data", {
  dateFormat: "Y-m-d",
  altInput: true,
  altFormat: "d/m/Y",
  locale: "pt",
  defaultDate: hojeTexto()
});

calendarioVencimento = flatpickr("#dataVencimentoConta", {
  dateFormat: "Y-m-d",
  altInput: true,
  altFormat: "d/m/Y",
  locale: "pt",
  defaultDate: hojeTexto()
});

atualizarTela();
atualizarContasFixas();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").then(function(registration) {
    registration.update();
  });
}