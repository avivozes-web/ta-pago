import { createClient } from '@supabase/supabase-js'
export const SUPABASE_URL = 'https://lmycoesvfulfrtrehayn.supabase.co'
export const SUPABASE_KEY = 'sb_publishable_OSFMAzJhomuj7lRk5-ZXDg_0diIHs-M'
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'tapago-auth' } })
export const userEmail = (u: string) => (u.includes('@') ? u.trim().toLowerCase() : `${u.trim().toLowerCase()}@tapago.app`)
