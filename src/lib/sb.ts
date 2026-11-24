import { createClient } from '@supabase/supabase-js'
// Projeto Supabase próprio do Tá Pago! (sem login). A chave publishable é pública por natureza.
// VITE_SB_URL só existe no build de TESTE (banco local isolado); o deploy usa sempre o projeto real.
export const SUPABASE_URL = import.meta.env.VITE_SB_URL || 'https://zwofofifmxhyxzpbrgud.supabase.co'
export const SUPABASE_KEY = import.meta.env.VITE_SB_URL ? 'teste-local' : 'sb_publishable_bNpWEfSlH28D6b4Yo6LpIg_cofbuzzJ'
export const IS_TEST = !!import.meta.env.VITE_SB_URL
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
