// ══════════════════════════════════════════
//  GARAGEM 10 — APP PRINCIPAL
// ══════════════════════════════════════════

let session = null;
let veiculos = [];
let manutencoesCache = {}; // veiculoId -> array
let atualId = null;
let filtroAtual = "todos";
let lembreteOn = false;
let melembreteOn = false;
let fotoFile = null;
let arquivoFile = null;
let manutEditId = null;
let origemManutDetalhe = "screen-historico"; // para onde voltar ao saiir da tela de detalhe da manutenção
let authMode = "login"; // 'login' | 'cadastro' | 'recuperar'

const catIcons = { motor: "🛢", freio: "🛑", pneu: "🔄", suspensao: "🔩", eletrico: "⚡", outro: "📝" };

const capasVeiculo = {
  sedan: "images/capas/capa-sedan.webp",
  suv: "images/capas/capa-suv.webp",
  pickup: "images/capas/capa-pickup.webp",
  moto: "images/capas/capa-moto.webp"
};

function imagemCapaVeiculo(v) {
  // Foto própria do usuário tem prioridade; senão usa a capa ilustrada pelo tipo
  if (v.foto_url) return `<img src="${v.foto_url}">`;
  const capa = capasVeiculo[v.tipo_veiculo] || capasVeiculo.sedan;
  return `<img src="${capa}" style="opacity:.92">`;
}

// ─────────────────────────────────────────
//  BOOTSTRAP / AUTH STATE
// ─────────────────────────────────────────

async function bootstrap() {
  setLoading(true);
  try {
    session = await db.getSession();
  } catch (err) {
    session = null;
    toast('Não foi possível conectar. Verifique sua internet.', 'error');
  } finally {
    setLoading(false);
  }

  if (session) {
    mostrarAppLogado();
  } else {
    mostrarTelaAuth('login');
  }

  try {
    db.onAuthChange((newSession) => {
      const wasLoggedIn = !!session;
      session = newSession;
      if (session && !wasLoggedIn) {
        mostrarAppLogado();
      } else if (!session && wasLoggedIn) {
        veiculos = [];
        manutencoesCache = {};
        mostrarTelaAuth('login');
      }
    });
  } catch (err) {
    // Supabase indisponível — app continua usável na tela de login/dados já carregados
    console.warn('Não foi possível registrar listener de autenticação:', err);
  }
}

function mostrarAppLogado() {
  document.getElementById('auth-screens').style.display = 'none';
  document.getElementById('app-screens').style.display = '';
  goTo('screen-home');
}

function mostrarTelaAuth(mode) {
  document.getElementById('app-screens').style.display = 'none';
  document.getElementById('auth-screens').style.display = '';
  setAuthMode(mode);
}

// ─────────────────────────────────────────
//  AUTH UI
// ─────────────────────────────────────────

function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('auth-error').classList.remove('show');
  document.querySelectorAll('.auth-panel').forEach(p => p.style.display = 'none');
  document.getElementById('auth-panel-' + mode).style.display = '';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.classList.add('show');
}

async function fazerLogin() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  if (!email) { shake('login-email'); return; }
  if (!senha) { shake('login-senha'); return; }

  setLoading(true);
  try {
    const { error } = await db.signIn(email, senha);
    if (error) { showAuthError(friendlyError(error)); return; }
    // onAuthChange cuida da transição de tela
  } catch (err) {
    showAuthError(friendlyError(err));
  } finally {
    setLoading(false);
  }
}

async function fazerCadastro() {
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  const senha2 = document.getElementById('cad-senha2').value;
  if (!email) { shake('cad-email'); return; }
  if (!senha || senha.length < 6) { shake('cad-senha'); showAuthError('A senha deve ter pelo menos 6 caracteres.'); return; }
  if (senha !== senha2) { shake('cad-senha2'); showAuthError('As senhas não coincidem.'); return; }

  setLoading(true);
  try {
    const { data, error } = await db.signUp(email, senha);
    if (error) { showAuthError(friendlyError(error)); return; }

    if (data.session) {
      // confirmação de e-mail desativada no projeto -> já loga
      return;
    }
    toast('Verifique seu e-mail para confirmar o cadastro.', 'success');
    setAuthMode('login');
  } catch (err) {
    showAuthError(friendlyError(err));
  } finally {
    setLoading(false);
  }
}

async function fazerLoginGoogle() {
  setLoading(true);
  try {
    const { error } = await db.signInWithGoogle();
    if (error) showAuthError(friendlyError(error));
  } catch (err) {
    showAuthError(friendlyError(err));
  } finally {
    setLoading(false);
  }
}

async function enviarRecuperacao() {
  const email = document.getElementById('rec-email').value.trim();
  if (!email) { shake('rec-email'); return; }
  setLoading(true);
  try {
    const { error } = await db.resetPassword(email);
    if (error) { showAuthError(friendlyError(error)); return; }
    toast('Link de recuperação enviado para seu e-mail.', 'success');
    setAuthMode('login');
  } catch (err) {
    showAuthError(friendlyError(err));
  } finally {
    setLoading(false);
  }
}

async function fazerLogout() {
  if (!confirm('Deseja realmente sair?')) return;
  setLoading(true);
  try {
    await db.signOut();
  } catch (err) {
    toast(friendlyError(err), 'error');
  } finally {
    setLoading(false);
  }
}

// ─────────────────────────────────────────
//  NAVEGAÇÃO
// ─────────────────────────────────────────

function goTo(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  window.scrollTo(0, 0);
  if (id === "screen-home") renderHome();
  if (id === "screen-veiculo") renderVehicleDetail();
  if (id === "screen-historico") renderHistorico();
  if (id === "screen-add-manutencao") initManutForm();
  if (id === "screen-add-veiculo") initVeiculoForm();
  if (id === "screen-editar-veiculo") initEditarVeiculoForm();
  if (id === "screen-perfil") renderPerfil();
}

// ─────────────────────────────────────────
//  HOME
// ─────────────────────────────────────────

async function renderHome() {
  document.getElementById("header-sub").textContent = "Minha garagem";
  const vl = document.getElementById("vehicle-list");
  const dg = document.getElementById("dash-grid");

  dg.innerHTML = `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;
  vl.innerHTML = `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;

  try {
    veiculos = await db.listVeiculos(session.user.id);
    const todasManut = await db.listManutencoesDoUsuario(session.user.id);

    // organiza cache por veículo
    manutencoesCache = {};
    todasManut.forEach(m => {
      if (!manutencoesCache[m.veiculo_id]) manutencoesCache[m.veiculo_id] = [];
      manutencoesCache[m.veiculo_id].push(m);
    });

    const totalVeiculos = veiculos.length;
    const totalManut = todasManut.length;
    const totalGasto = todasManut.reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    const hoje = new Date();
    const proximas = todasManut.filter(m => {
      if (!m.proxima || !m.lembrete) return false;
      const diff = (new Date(m.proxima) - hoje) / (1000 * 60 * 60 * 24);
      return diff <= 7 && diff >= 0;
    }).length;

    dg.innerHTML = `
      <div class="dash-card orange">
        <div class="icon">🚗</div><div class="label">Veículos</div>
        <div class="value">${totalVeiculos}</div>
      </div>
      <div class="dash-card blue">
        <div class="icon">🔧</div><div class="label">Manutenções</div>
        <div class="value">${totalManut}</div>
      </div>
      <div class="dash-card green">
        <div class="icon">💰</div><div class="label">Total Gasto</div>
        <div class="value" style="font-size:17px">R$&nbsp;${totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
      <div class="dash-card yellow">
        <div class="icon">⚠️</div><div class="label">Alertas</div>
        <div class="value">${proximas}</div><div class="sub">próx. 7 dias</div>
      </div>
    `;

    if (!veiculos.length) {
      vl.innerHTML = `<div class="empty"><img src="images/estados/empty-state.webp" style="max-width:240px;width:100%;border-radius:14px;margin-bottom:14px"><p>Nenhum veículo cadastrado ainda.<br>Adicione seu primeiro veículo!</p></div>`;
      return;
    }
    vl.innerHTML = veiculos.map(v => {
      const mts = manutencoesCache[v.id] || [];
      const gasto = mts.reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
      return `
        <div class="vehicle-card" onclick="abrirVeiculo('${v.id}')">
          <div class="vehicle-photo">${imagemCapaVeiculo(v)}</div>
          <div class="vehicle-info">
            <div class="vehicle-name">${escapeHtml(v.nome)}</div>
            <div class="vehicle-meta">${[v.marca, v.modelo, v.ano ? '· ' + v.ano : ''].filter(Boolean).map(escapeHtml).join(' ')}</div>
            <div class="vehicle-meta" style="margin-top:2px">💰 R$ ${gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · ${mts.length} serviços</div>
            ${v.placa ? `<div class="vehicle-badge">${escapeHtml(v.placa.toUpperCase())}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    toast(friendlyError(err), 'error');
    vl.innerHTML = `<div class="empty"><div class="ei">⚠️</div><p>Não foi possível carregar seus veículos.</p></div>`;
  }
}

function abrirVeiculo(id) {
  atualId = id;
  goTo("screen-veiculo");
}

// ─────────────────────────────────────────
//  ADD / EDIT VEÍCULO
// ─────────────────────────────────────────

function initVeiculoForm() {
  fotoFile = null;
  ["v-nome", "v-marca", "v-modelo", "v-ano", "v-cor", "v-placa", "v-renavam", "v-km"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("v-tipo-veiculo").value = "sedan";
  const fp = document.getElementById("foto-preview");
  fp.innerHTML = `<input type="file" id="vfoto" accept="image/*" style="display:none" onchange="previewFoto(this)"><div style="font-size:32px">📷</div><div>Toque para adicionar foto</div>`;
  fp.onclick = () => document.getElementById("vfoto").click();
}

function previewFoto(input) {
  if (!input.files[0]) return;
  fotoFile = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    const fp = document.getElementById("foto-preview");
    fp.innerHTML = `<img src="${e.target.result}" style="position:absolute;width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
  };
  reader.readAsDataURL(fotoFile);
}

async function salvarVeiculo() {
  const nome = document.getElementById("v-nome").value.trim();
  if (!nome) { shake("v-nome"); return; }

  const btn = event.target;
  btn.disabled = true;
  setLoading(true);
  try {
    let foto_url = null;
    if (fotoFile) {
      foto_url = await db.uploadFotoVeiculo(session.user.id, fotoFile);
    }
    const v = await db.criarVeiculo(session.user.id, {
      nome,
      tipo_veiculo: document.getElementById("v-tipo-veiculo").value,
      marca: document.getElementById("v-marca").value.trim(),
      modelo: document.getElementById("v-modelo").value.trim(),
      ano: document.getElementById("v-ano").value,
      cor: document.getElementById("v-cor").value.trim(),
      placa: document.getElementById("v-placa").value.trim(),
      renavam: document.getElementById("v-renavam").value,
      km: document.getElementById("v-km").value,
      foto_url
    });
    atualId = v.id;
    veiculos.unshift(v);
    toast('Veículo adicionado!', 'success');
    goTo("screen-veiculo");
  } catch (err) {
    toast(friendlyError(err), 'error');
  } finally {
    btn.disabled = false;
    setLoading(false);
  }
}

async function initEditarVeiculoForm() {
  const v = veiculos.find(x => x.id === atualId) || await db.getVeiculo(atualId);
  if (!v) return;
  fotoFile = null;
  document.getElementById("ve-nome").value = v.nome || "";
  document.getElementById("ve-tipo-veiculo").value = v.tipo_veiculo || "sedan";
  document.getElementById("ve-marca").value = v.marca || "";
  document.getElementById("ve-modelo").value = v.modelo || "";
  document.getElementById("ve-ano").value = v.ano || "";
  document.getElementById("ve-cor").value = v.cor || "";
  document.getElementById("ve-placa").value = v.placa || "";
  document.getElementById("ve-renavam").value = v.renavam || "";
  document.getElementById("ve-km").value = v.km || "";

  const fp = document.getElementById("foto-preview-edit");
  fp.innerHTML = v.foto_url
    ? `<img src="${v.foto_url}" style="position:absolute;width:100%;height:100%;object-fit:cover;border-radius:12px;">`
    : `<div style="font-size:32px">📷</div><div>Toque para adicionar foto</div>`;
  fp.onclick = () => document.getElementById("vfoto-edit").click();
}

function previewFotoEdit(input) {
  if (!input.files[0]) return;
  fotoFile = input.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    const fp = document.getElementById("foto-preview-edit");
    fp.innerHTML = `<img src="${e.target.result}" style="position:absolute;width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
  };
  reader.readAsDataURL(fotoFile);
}

async function salvarEdicaoVeiculo() {
  const nome = document.getElementById("ve-nome").value.trim();
  if (!nome) { shake("ve-nome"); return; }

  const btn = event.target;
  btn.disabled = true;
  setLoading(true);
  try {
    const payload = {
      nome,
      tipo_veiculo: document.getElementById("ve-tipo-veiculo").value,
      marca: document.getElementById("ve-marca").value.trim(),
      modelo: document.getElementById("ve-modelo").value.trim(),
      ano: document.getElementById("ve-ano").value,
      cor: document.getElementById("ve-cor").value.trim(),
      placa: document.getElementById("ve-placa").value.trim(),
      renavam: document.getElementById("ve-renavam").value,
      km: document.getElementById("ve-km").value,
    };
    if (fotoFile) {
      payload.foto_url = await db.uploadFotoVeiculo(session.user.id, fotoFile);
    }
    const atualizado = await db.atualizarVeiculo(atualId, payload);
    const idx = veiculos.findIndex(x => x.id === atualId);
    if (idx !== -1) veiculos[idx] = atualizado;
    toast('Veículo atualizado!', 'success');
    goTo("screen-veiculo");
  } catch (err) {
    toast(friendlyError(err), 'error');
  } finally {
    btn.disabled = false;
    setLoading(false);
  }
}

async function excluirVeiculo() {
  if (!confirm("Excluir este veículo e todo seu histórico? Esta ação não pode ser desfeita.")) return;
  setLoading(true);
  try {
    await db.excluirVeiculo(atualId);
    toast('Veículo excluído.', 'success');
    goTo("screen-home");
  } catch (err) {
    toast(friendlyError(err), 'error');
  } finally {
    setLoading(false);
  }
}

// ─────────────────────────────────────────
//  DETALHE DO VEÍCULO
// ─────────────────────────────────────────

async function renderVehicleDetail() {
  const v = veiculos.find(x => x.id === atualId);
  if (!v) { goTo('screen-home'); return; }
  document.getElementById("header-sub").textContent = v.nome;

  document.getElementById("vd-header").innerHTML = `
    <div class="vehicle-detail-header">
      <div class="vehicle-cover">${imagemCapaVeiculo(v)}</div>
      <div class="vehicle-detail-info">
        <div class="vehicle-detail-name">${escapeHtml(v.nome)}</div>
        <div class="vehicle-detail-meta">${[v.marca, v.modelo, v.ano].filter(Boolean).map(escapeHtml).join(' · ')}</div>
        <div class="vehicle-tags">
          ${v.placa ? `<div class="vtag">Placa<span>${escapeHtml(v.placa.toUpperCase())}</span></div>` : ''}
          ${v.renavam ? `<div class="vtag">RENAVAM<span>${escapeHtml(v.renavam)}</span></div>` : ''}
          ${v.cor ? `<div class="vtag">Cor<span>${escapeHtml(v.cor)}</span></div>` : ''}
          ${v.km ? `<div class="vtag">KM<span>${Number(v.km).toLocaleString('pt-BR')}</span></div>` : ''}
        </div>
      </div>
    </div>
    <button class="add-btn outline" style="margin-bottom:16px" onclick="goTo('screen-editar-veiculo')">✏️ Editar Veículo</button>
  `;

  let mts = manutencoesCache[v.id];
  if (!mts) {
    document.getElementById("vd-stats").innerHTML = `<div class="skeleton skeleton-card" style="height:60px"></div>`;
    try {
      mts = await db.listManutencoes(v.id);
      manutencoesCache[v.id] = mts;
    } catch (err) {
      toast(friendlyError(err), 'error');
      mts = [];
    }
  }

  const totalGasto = mts.reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
  const sorted = [...mts].sort((a, b) => new Date(b.data) - new Date(a.data));
  const ultima = sorted[0];

  document.getElementById("vd-stats").innerHTML = `
    <div class="stat-box"><div class="sv">${mts.length}</div><div class="sl">Manutenções</div></div>
    <div class="stat-box"><div class="sv" style="font-size:13px">R$ ${totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div class="sl">Total Gasto</div></div>
    <div class="stat-box"><div class="sv" style="font-size:13px">${ultima ? formatDate(ultima.data) : '—'}</div><div class="sl">Última Rev.</div></div>
  `;

  const hoje = new Date();
  const alertas = mts.filter(m => {
    if (!m.proxima || !m.lembrete) return false;
    const diff = (new Date(m.proxima) - hoje) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff >= 0;
  });
  document.getElementById("vd-alertas").innerHTML = alertas.map(m =>
    `<div class="alert-banner">⚠️ Manutenção próxima: <strong>${escapeHtml(m.tipo)}</strong> em ${formatDate(m.proxima)}</div>`
  ).join('');

  const recentes = sorted.slice(0, 3);
  document.getElementById("vd-recent").innerHTML = recentes.length
    ? recentes.map(m => manutCard(m, true, 'screen-veiculo')).join('')
    : `<div class="empty"><div class="ei">🔧</div><p>Nenhuma manutenção registrada ainda.</p></div>`;
}

// ─────────────────────────────────────────
//  ADD MANUTENÇÃO
// ─────────────────────────────────────────

function initManutForm() {
  const v = veiculos.find(x => x.id === atualId);
  if (v) document.getElementById("manut-sub").textContent = v.nome;
  document.getElementById("m-data").value = new Date().toISOString().split('T')[0];
  lembreteOn = false;
  document.getElementById("lembrete-toggle").classList.remove("on");
  arquivoFile = null;
  const arqInput = document.getElementById("m-arquivo");
  if (arqInput) arqInput.value = "";
  document.getElementById("arquivo-label").textContent = "Toque para anexar";
  const preview = document.getElementById("arquivo-preview");
  preview.style.borderColor = "";
  preview.style.color = "";
  ["m-km", "m-valor", "m-proxima", "m-oficina", "m-obs"].forEach(id => document.getElementById(id).value = "");
}

function toggleLembrete() {
  lembreteOn = !lembreteOn;
  document.getElementById("lembrete-toggle").classList.toggle("on", lembreteOn);
}

function triggerArquivo(e) {
  e.stopPropagation();
  document.getElementById("m-arquivo").click();
}

function previewArquivo(input) {
  if (!input.files[0]) return;
  arquivoFile = input.files[0];
  const isPdf = arquivoFile.type === "application/pdf";
  const preview = document.getElementById("arquivo-preview");
  const label = document.getElementById("arquivo-label");
  label.textContent = (isPdf ? "PDF: " : "Img: ") + arquivoFile.name;
  preview.style.borderColor = "var(--green)";
  preview.style.color = "var(--green)";
}

async function salvarManutencao() {
  const tipoRaw = document.getElementById("m-tipo").value;
  const [tipo, cat] = tipoRaw.split("|");
  const data = document.getElementById("m-data").value;
  if (!data) { shake("m-data"); return; }

  const btn = event.target;
  btn.disabled = true;
  setLoading(true);
  try {
    let arquivo_url = null;
    if (arquivoFile) {
      arquivo_url = await db.uploadComprovante(session.user.id, arquivoFile);
    }
    const valorRaw = document.getElementById("m-valor").value;
    await db.criarManutencao(session.user.id, {
      veiculo_id: atualId, tipo, cat,
      km: document.getElementById("m-km").value,
      valor: valorRaw ? parseFloat(valorRaw) : null,
      data,
      proxima: document.getElementById("m-proxima").value || null,
      oficina: document.getElementById("m-oficina").value.trim(),
      obs: document.getElementById("m-obs").value.trim(),
      lembrete: lembreteOn,
      arquivo_url
    });
    delete manutencoesCache[atualId]; // força recarregar
    toast('Manutenção registrada!', 'success');
    goTo("screen-veiculo");
  } catch (err) {
    toast(friendlyError(err), 'error');
  } finally {
    btn.disabled = false;
    setLoading(false);
  }
}

// ─────────────────────────────────────────
//  HISTÓRICO
// ─────────────────────────────────────────

async function renderHistorico() {
  const v = veiculos.find(x => x.id === atualId);
  if (v) document.getElementById("hist-sub").textContent = v.nome;
  filtroAtual = "todos";
  document.querySelectorAll("#hist-tabs .tab").forEach((t, i) => t.classList.toggle("active", i === 0));

  if (!manutencoesCache[atualId]) {
    document.getElementById("hist-list").innerHTML = `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;
    try {
      manutencoesCache[atualId] = await db.listManutencoes(atualId);
    } catch (err) {
      toast(friendlyError(err), 'error');
      manutencoesCache[atualId] = [];
    }
  }
  renderFiltrado();
}

function setFiltro(f, el) {
  filtroAtual = f;
  document.querySelectorAll("#hist-tabs .tab").forEach(t => t.classList.remove("active"));
  el.classList.add("active");
  renderFiltrado();
}

function renderFiltrado() {
  const todas = manutencoesCache[atualId] || [];
  const lista = todas
    .filter(m => filtroAtual === "todos" || m.cat === filtroAtual)
    .sort((a, b) => new Date(b.data) - new Date(a.data));
  const totalFiltro = lista.reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
  document.getElementById("hist-total").innerHTML = lista.length
    ? `${lista.length} registro(s) · Total: <strong style="color:var(--green)">R$ ${totalFiltro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>`
    : '';
  document.getElementById("hist-list").innerHTML = lista.length
    ? lista.map(m => manutCard(m, true, 'screen-historico')).join('')
    : `<div class="empty"><div class="ei">📋</div><p>Nenhuma manutenção nessa categoria.</p></div>`;
}

function manutCard(m, clicavel, origem) {
  const icon = catIcons[m.cat] || "🔧";
  return `
    <div class="maint-card" ${clicavel ? `onclick="abrirManutDetalhe('${m.id}', '${origem}')" style="cursor:pointer"` : ''}>
      <div class="maint-icon ${m.cat}">${icon}</div>
      <div class="maint-info">
        <div class="maint-title">${escapeHtml(m.tipo)}</div>
        <div class="maint-meta">${m.km ? 'KM ' + Number(m.km).toLocaleString('pt-BR') : ''}${m.km && m.oficina ? ' · ' : ''}${escapeHtml(m.oficina || '')}</div>
        ${m.obs ? `<div class="maint-meta" style="font-style:italic;margin-top:2px">${escapeHtml(m.obs)}</div>` : ''}
        ${m.arquivo_url ? `<a href="#" onclick="abrirArquivo('${m.id}');return false;" style="font-size:12px;color:var(--blue);text-decoration:none;margin-top:4px;display:inline-block">📎 Ver comprovante</a>` : ''}
      </div>
      <div style="min-width:80px">
        <div class="maint-value">${m.valor ? 'R$ ' + parseFloat(m.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</div>
        <div class="maint-date">${m.data ? formatDate(m.data) : ''}</div>
        ${m.proxima ? `<div class="maint-date" style="color:var(--yellow)">Próx: ${formatDate(m.proxima)}</div>` : ''}
      </div>
    </div>`;
}

async function abrirArquivo(manutId) {
  const todas = manutencoesCache[atualId] || [];
  const m = todas.find(x => x.id === manutId);
  if (!m || !m.arquivo_url) return;
  setLoading(true);
  try {
    const url = await db.getComprovanteUrl(m.arquivo_url);
    window.open(url, '_blank');
  } catch (err) {
    toast(friendlyError(err), 'error');
  } finally {
    setLoading(false);
  }
}

// ─────────────────────────────────────────
//  DETALHE / EDIÇÃO DE MANUTENÇÃO
// ─────────────────────────────────────────

function abrirManutDetalhe(id, origem) {
  manutEditId = id;
  origemManutDetalhe = origem || "screen-historico";
  goTo("screen-manut-detalhe");
  renderManutView();
  document.getElementById("manut-view").style.display = "";
  document.getElementById("manut-edit").style.display = "none";
  document.getElementById("btn-editar-manut").textContent = "✏️ Editar";
}

function voltarDoDetalheManut() {
  goTo(origemManutDetalhe);
}

const imagensCategoria = {
  motor: "images/categorias/icon-motor.webp",
  freio: "images/categorias/icon-freio.webp",
  pneu: "images/categorias/icon-pneu.webp",
  suspensao: "images/categorias/icon-suspensao.webp",
  eletrico: "images/categorias/icon-eletrico.webp"
};

function renderManutView() {
  const todas = manutencoesCache[atualId] || [];
  const m = todas.find(x => x.id === manutEditId);
  if (!m) return;
  const icon = catIcons[m.cat] || "🔧";
  const imagemCategoria = imagensCategoria[m.cat];
  document.getElementById("mv-content").innerHTML = `
    ${imagemCategoria
      ? `<div style="width:100%;height:160px;background:var(--surface);border:1px solid var(--border);border-radius:16px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;overflow:hidden">
           <img src="${imagemCategoria}" style="width:130px;height:130px;object-fit:contain">
         </div>`
      : ''}
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <div class="maint-icon ${m.cat}" style="width:52px;height:52px;font-size:24px">${icon}</div>
      <div>
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:18px">${escapeHtml(m.tipo)}</div>
        <div style="font-size:13px;color:var(--muted2)">${escapeHtml(m.cat)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
      <div class="stat-box"><div class="sv" style="font-size:15px">${m.valor ? 'R$ ' + parseFloat(m.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</div><div class="sl">Valor Gasto</div></div>
      <div class="stat-box"><div class="sv" style="font-size:15px">${m.km ? Number(m.km).toLocaleString('pt-BR') : '—'}</div><div class="sl">KM</div></div>
    </div>
    <div class="vehicle-detail-header" style="padding:0">
      <div class="vehicle-detail-info">
        ${m.data ? `<div style="margin-bottom:8px"><span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Data</span><div style="font-size:15px;margin-top:2px">${formatDate(m.data)}</div></div>` : ''}
        ${m.proxima ? `<div style="margin-bottom:8px"><span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Próxima Revisão</span><div style="font-size:15px;margin-top:2px;color:var(--yellow)">${formatDate(m.proxima)}</div></div>` : ''}
        ${m.oficina ? `<div style="margin-bottom:8px"><span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Oficina</span><div style="font-size:15px;margin-top:2px">${escapeHtml(m.oficina)}</div></div>` : ''}
        ${m.obs ? `<div style="margin-bottom:8px"><span style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Observações</span><div style="font-size:14px;margin-top:2px;color:var(--muted2);font-style:italic">${escapeHtml(m.obs)}</div></div>` : ''}
        ${m.lembrete ? `<div style="margin-top:4px"><span style="background:rgba(249,115,22,.15);color:var(--accent);border-radius:8px;padding:3px 10px;font-size:12px">🔔 Lembrete ativo</span></div>` : ''}
      </div>
    </div>
    ${m.arquivo_url ? `<button onclick="abrirArquivo('${m.id}')" style="width:100%;margin-top:14px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;color:var(--blue);font-family:'DM Sans',sans-serif;font-size:14px;cursor:pointer">📎 Ver comprovante</button>` : ''}
    <button onclick="deletarManutencaoDetalhe('${m.id}')" style="width:100%;margin-top:10px;padding:12px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:12px;color:var(--red);font-family:'DM Sans',sans-serif;font-size:14px;cursor:pointer">🗑 Excluir manutenção</button>
  `;
}

function toggleEditManut() {
  const viewEl = document.getElementById("manut-view");
  const editEl = document.getElementById("manut-edit");
  const btn = document.getElementById("btn-editar-manut");
  const editing = editEl.style.display === "none" || editEl.style.display === "";
  if (editing) {
    const todas = manutencoesCache[atualId] || [];
    const m = todas.find(x => x.id === manutEditId);
    if (!m) return;
    const sel = document.getElementById("me-tipo");
    for (let o of sel.options) { if (o.value.startsWith(m.tipo + "|")) { sel.value = o.value; break; } }
    document.getElementById("me-km").value = m.km || "";
    document.getElementById("me-valor").value = m.valor || "";
    document.getElementById("me-data").value = m.data || "";
    document.getElementById("me-proxima").value = m.proxima || "";
    document.getElementById("me-oficina").value = m.oficina || "";
    document.getElementById("me-obs").value = m.obs || "";
    melembreteOn = !!m.lembrete;
    document.getElementById("me-lembrete-toggle").classList.toggle("on", melembreteOn);
    viewEl.style.display = "none";
    editEl.style.display = "";
    btn.textContent = "← Cancelar";
  } else {
    viewEl.style.display = "";
    editEl.style.display = "none";
    btn.textContent = "✏️ Editar";
  }
}

function toggleEditLembrete() {
  melembreteOn = !melembreteOn;
  document.getElementById("me-lembrete-toggle").classList.toggle("on", melembreteOn);
}

async function salvarEdicaoManut() {
  const data = document.getElementById("me-data").value;
  if (!data) { shake("me-data"); return; }
  const tipoRaw = document.getElementById("me-tipo").value;
  const [tipo, cat] = tipoRaw.split("|");
  const valorRaw = document.getElementById("me-valor").value;

  setLoading(true);
  try {
    await db.atualizarManutencao(manutEditId, {
      tipo, cat,
      km: document.getElementById("me-km").value,
      valor: valorRaw ? parseFloat(valorRaw) : null,
      data,
      proxima: document.getElementById("me-proxima").value || null,
      oficina: document.getElementById("me-oficina").value.trim(),
      obs: document.getElementById("me-obs").value.trim(),
      lembrete: melembreteOn
    });
    delete manutencoesCache[atualId];
    manutencoesCache[atualId] = await db.listManutencoes(atualId);
    toast('Alterações salvas!', 'success');
    renderManutView();
    document.getElementById("manut-view").style.display = "";
    document.getElementById("manut-edit").style.display = "none";
    document.getElementById("btn-editar-manut").textContent = "✏️ Editar";
  } catch (err) {
    toast(friendlyError(err), 'error');
  } finally {
    setLoading(false);
  }
}

async function deletarManutencaoDetalhe(id) {
  if (!confirm("Excluir esta manutenção?")) return;
  setLoading(true);
  try {
    await db.excluirManutencao(id);
    delete manutencoesCache[atualId];
    toast('Manutenção excluída.', 'success');
    goTo("screen-historico");
  } catch (err) {
    toast(friendlyError(err), 'error');
  } finally {
    setLoading(false);
  }
}

// ─────────────────────────────────────────
//  PERFIL
// ─────────────────────────────────────────

function renderPerfil() {
  const email = session?.user?.email || '';
  const inicial = email.charAt(0).toUpperCase() || '?';
  document.getElementById('perfil-avatar').textContent = inicial;
  document.getElementById('perfil-email').textContent = email;
}

// ─────────────────────────────────────────
//  UTIL
// ─────────────────────────────────────────

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────
//  START
// ─────────────────────────────────────────

bootstrap();
