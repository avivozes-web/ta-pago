import { createClient } from '@supabase/supabase-js'
// Projeto Supabase próprio do Tá Pago! (sem login). A chave publishable é pública por natureza.
export const SUPABASE_URL = 'https://zwofofifmxhyxzpbrgud.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_bNpWEfSlH28D6b4Yo6LpIg_cofbuzzJ'
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
