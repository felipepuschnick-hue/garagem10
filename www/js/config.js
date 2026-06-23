// ══════════════════════════════════════════
//  GARAGEM 10 — CONFIGURAÇÃO SUPABASE
//  Preencha com os dados do SEU projeto Supabase
//  (Project Settings → API)
// ══════════════════════════════════════════

const SUPABASE_URL = "https://uufwjutdrwgciqnfdous.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dexnRbxJFG6BduXqpej3tw_axlMOJt-";

// Não precisa editar nada abaixo desta linha
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
