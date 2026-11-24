// Botões rápidos: os gastos que mais se repetem + os que ela fixou.
import { norm, guessCategory } from './parse.ts'
export interface Quick { label: string; description: string; category_id: string | null; payment: string | null; card_id: string | null; pinned: boolean; count: number }
export const QUICK_DEFAULT = ['Docinho', 'Mercado do dia a dia', 'Uber', 'Farmácia', 'Lanche'].map((l) => ({ label: l, description: l }))
function stats(db: any) {
  const m: Record<string, { desc: string; n: number; cats: Record<string, number>; pays: Record<string, number>; cards: Record<string, number> }> = {}
  for (const t of db.tx) {
    if (t.kind !== 'saida' || (t.installment_no && t.installment_no > 1) || !t.description) continue
    const k = norm(t.description); const x = (m[k] = m[k] || { desc: t.description, n: 0, cats: {}, pays: {}, cards: {} })
    x.n++; if (t.category_id) x.cats[t.category_id] = (x.cats[t.category_id] || 0) + 1
    if (t.payment) x.pays[t.payment] = (x.pays[t.payment] || 0) + 1
    if (t.card_id) x.cards[t.card_id] = (x.cards[t.card_id] || 0) + 1
  }
  return m
}
const top = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || null
const only = (o: Record<string, number>) => (Object.keys(o).length === 1 ? Object.keys(o)[0] : null)
export function quickList(db: any, max = 8): Quick[] {
  const st = stats(db)
  const pinnedRaw: any[] = Array.isArray(db.hh.quick_buttons) ? db.hh.quick_buttons : QUICK_DEFAULT
  const hidden = new Set((db.hh.quick_hidden || []).map(norm))
  const fill = (b: any, pinned: boolean): Quick => {
    const s = st[norm(b.description || b.label)]
    const g = guessCategory(b.description || b.label, db.keywords)
    return { label: b.label, description: b.description || b.label, pinned, count: s?.n || 0,
      category_id: b.category_id || (s && top(s.cats)) || g?.category_id || null,
      payment: b.payment || (s && only(s.pays)) || null,
      card_id: b.card_id || (s && only(s.cards)) || null }
  }
  const pinned = pinnedRaw.map((b) => fill(b, true))
  const have = new Set(pinned.map((p) => norm(p.description)))
  const auto = Object.entries(st).filter(([k, v]) => v.n >= 2 && !have.has(k) && !hidden.has(k)).sort((a, b) => b[1].n - a[1].n).slice(0, 4).map(([, v]) => fill({ label: v.desc, description: v.desc }, false))
  // fixados primeiro, ordenados pelo uso; depois os do histórico
  return [...pinned.sort((a, b) => b.count - a.count), ...auto].slice(0, max)
}
