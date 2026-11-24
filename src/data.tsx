import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { sb } from './lib/sb'
import { cycleKeyOf, todayStr, addDays, setCycleStarts, type Naming } from './lib/cycle'

export const TABLES = {
  categories: 'tp_categories', keywords: 'tp_keywords', cards: 'tp_cards', income: 'tp_income_sources', investGoals: 'tp_invest_goals',
  tx: 'tp_transactions', manualBills: 'tp_manual_bills', fixed: 'tp_fixed', fixedPaid: 'tp_fixed_paid', wishCats: 'tp_wish_categories',
  wish: 'tp_wishlist', shopSections: 'tp_shop_sections', shopItems: 'tp_shop_items', shopChecks: 'tp_shop_checks', habits: 'tp_habits',
  habitLogs: 'tp_habit_logs', tasks: 'tp_tasks', taskDone: 'tp_task_done', overdraft: 'tp_overdraft',
} as const
export type TKey = keyof typeof TABLES
export type DB = { [K in TKey]: any[] } & { hh: any }
const ORDER: Partial<Record<TKey, string>> = { categories: 'sort', cards: 'sort', income: 'sort', investGoals: 'sort', fixed: 'sort', wishCats: 'sort', wish: 'sort', shopSections: 'sort', shopItems: 'sort', habits: 'sort', tasks: 'sort', tx: 'date', overdraft: 'sort' }

interface Ctx {
  db: DB | null; loading: boolean; error: string | null; today: string; currentKey: string; key: string; setKey: (k: string) => void
  naming: Naming; startDay: number; reload: (...t: (TKey | 'hh')[]) => Promise<void>
  ins: (t: TKey, row: any) => Promise<any>; upd: (t: TKey, id: string, patch: any) => Promise<boolean>; del: (t: TKey, id: string) => Promise<boolean>
  updHH: (patch: any) => Promise<boolean>; toast: (m: string) => void; msg: string | null
}
const C = createContext<Ctx>(null as any)
export const useData = () => useContext(C)

function fakeToday() { try { const p = new URLSearchParams(location.hash.split('?')[1] || location.search).get('hoje'); if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p } catch { /* */ } return null }

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const today = useMemo(() => fakeToday() || todayStr(), [])
  const [keySel, setKeySel] = useState<string | null>(null)
  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg((x) => (x === m ? null : x)), 2600) }, [])

  const fetchTable = useCallback(async (t: TKey) => {
    let q = sb.from(TABLES[t]).select('*')
    if (t === 'habitLogs') q = q.gte('day', addDays(today, -200))
    if (ORDER[t]) q = q.order(ORDER[t]!, { ascending: true })
    q = q.order('id')
    const { data, error } = await q
    if (error) throw error
    return data || []
  }, [today])
  const fetchHH = useCallback(async () => { const { data, error } = await sb.from('tp_households').select('*').limit(1).maybeSingle(); if (error) throw error; return data }, [])

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      const keys = Object.keys(TABLES) as TKey[]
      const [hh, ...rows] = await Promise.all([fetchHH(), ...keys.map(fetchTable)])
      const next: any = { hh }; keys.forEach((k, i) => (next[k] = rows[i]))
      setDb(next); setError(hh ? null : 'Não encontrei os dados da casa.')
    } catch (e: any) { setError(e.message || String(e)) } finally { setLoading(false) }
  }, [fetchHH, fetchTable])
  useEffect(() => { loadAll() }, [loadAll])
  useEffect(() => { const f = () => { if (document.visibilityState === 'visible') loadAll() }; document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f) }, [loadAll])

  const reload = useCallback(async (...ts: (TKey | 'hh')[]) => {
    try {
      const res = await Promise.all(ts.map((t) => (t === 'hh' ? fetchHH() : fetchTable(t))))
      setDb((d) => { if (!d) return d; const n: any = { ...d }; ts.forEach((t, i) => (n[t] = res[i])); return n })
    } catch (e: any) { toast('Não consegui atualizar: ' + (e.message || e)) }
  }, [fetchHH, fetchTable, toast])
  const ins = useCallback(async (t: TKey, row: any) => {
    const { data, error } = await sb.from(TABLES[t]).insert(row).select()
    if (error) { toast('Erro ao salvar: ' + error.message); return null }
    await reload(t); return Array.isArray(row) ? data : data?.[0]
  }, [reload, toast])
  const upd = useCallback(async (t: TKey, id: string, patch: any) => {
    const { error } = await sb.from(TABLES[t]).update(patch).eq('id', id)
    if (error) { toast('Erro ao salvar: ' + error.message); return false }
    await reload(t); return true
  }, [reload, toast])
  const del = useCallback(async (t: TKey, id: string) => {
    const { error } = await sb.from(TABLES[t]).delete().eq('id', id)
    if (error) { toast('Erro ao apagar: ' + error.message); return false }
    await reload(t); return true
  }, [reload, toast])
  const updHH = useCallback(async (patch: any) => {
    const { error } = await sb.from('tp_households').update(patch).eq('id', db?.hh?.id)
    if (error) { toast('Erro ao salvar: ' + error.message); return false }
    await reload('hh'); return true
  }, [db, reload, toast])

  const startDay = db?.hh?.cycle_start_day ?? 15
  const naming: Naming = db?.hh?.cycle_naming ?? 'start'
  setCycleStarts(db?.hh?.cycle_starts)
  const currentKey = cycleKeyOf(today, startDay)
  const value: Ctx = { db, loading, error, today, currentKey, key: keySel || currentKey, setKey: setKeySel, naming, startDay, reload, ins, upd, del, updHH, toast, msg }
  return <C.Provider value={value}>{children}</C.Provider>
}
