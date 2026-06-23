// ══════════════════════════════════════════
//  GARAGEM 10 — HELPERS DE UI
// ══════════════════════════════════════════

function toast(msg, type = '') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

function setLoading(on) {
  let el = document.getElementById('global-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loading';
    el.className = 'auth-loading-overlay';
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
  }
  el.classList.toggle('show', on);
}

function shake(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = "var(--red)";
  el.animate(
    [{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }],
    { duration: 300 }
  );
  setTimeout(() => el.style.borderColor = "", 1500);
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}

// Trata erros do Supabase e mostra mensagem amigável
function friendlyError(error) {
  const msg = (error && error.message) || '';
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('Unable to validate email')) return 'E-mail inválido.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).';
  if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) return 'Sem conexão com a internet.';
  return msg || 'Ocorreu um erro. Tente novamente.';
}
