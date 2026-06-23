// ══════════════════════════════════════════
//  GARAGEM 10 — CAMADA DE DADOS (Supabase)
// ══════════════════════════════════════════

const db = {

  // ───────── AUTH ─────────
  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async signUp(email, password) {
    return supabase.auth.signUp({ email, password });
  },

  async signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  },

  async signInWithGoogle() {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
  },

  async signOut() {
    return supabase.auth.signOut();
  },

  async resetPassword(email) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
  },

  onAuthChange(callback) {
    supabase.auth.onAuthStateChange((_event, session) => callback(session));
  },

  // ───────── VEÍCULOS ─────────
  async listVeiculos(userId) {
    const { data, error } = await supabase
      .from('veiculos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getVeiculo(id) {
    const { data, error } = await supabase
      .from('veiculos')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async criarVeiculo(userId, payload) {
    const { data, error } = await supabase
      .from('veiculos')
      .insert({ ...payload, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarVeiculo(id, payload) {
    const { data, error } = await supabase
      .from('veiculos')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async excluirVeiculo(id) {
    const { error } = await supabase.from('veiculos').delete().eq('id', id);
    if (error) throw error;
  },

  // ───────── MANUTENÇÕES ─────────
  async listManutencoes(veiculoId) {
    const { data, error } = await supabase
      .from('manutencoes')
      .select('*')
      .eq('veiculo_id', veiculoId)
      .order('data', { ascending: false });
    if (error) throw error;
    return data;
  },

  async listManutencoesDoUsuario(userId) {
    const { data, error } = await supabase
      .from('manutencoes')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    return data;
  },

  async criarManutencao(userId, payload) {
    const { data, error } = await supabase
      .from('manutencoes')
      .insert({ ...payload, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarManutencao(id, payload) {
    const { data, error } = await supabase
      .from('manutencoes')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async excluirManutencao(id) {
    const { error } = await supabase.from('manutencoes').delete().eq('id', id);
    if (error) throw error;
  },

  // ───────── STORAGE: FOTOS DE VEÍCULO (bucket público) ─────────
  async uploadFotoVeiculo(userId, file) {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('fotos-veiculos').upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('fotos-veiculos').getPublicUrl(path);
    return data.publicUrl;
  },

  // ───────── STORAGE: COMPROVANTES (bucket privado) ─────────
  async uploadComprovante(userId, file) {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('comprovantes').upload(path, file, { upsert: true });
    if (error) throw error;
    return path; // guardamos o path; geramos URL assinada na hora de abrir
  },

  async getComprovanteUrl(path) {
    const { data, error } = await supabase.storage.from('comprovantes').createSignedUrl(path, 60 * 5);
    if (error) throw error;
    return data.signedUrl;
  }
};
