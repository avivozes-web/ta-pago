import { billCycleKey, cycleKeyOf, cycleRange, diffDays, addDays, shiftKey, type Naming } from './cycle'
export type DBx = any
export interface CardBill { card: any; due: string; amount: number; manual: number; items: any[] }

export function txCycleKey(t: any, startDay: number, naming: Naming) {
  if (t.kind === 'saida' && t.payment === 'credito' && t.bill_due) return billCycleKey(t.bill_due, naming)
  // Adiantamento é dinheiro do PRÓXIMO salário: entra no ciclo desse salário (o mesmo em que caem as faturas que ele paga)
  if (t.kind === 'entrada' && t.is_advance) return shiftKey(cycleKeyOf(t.date, startDay), 1)
  return cycleKeyOf(t.date, startDay)
}
export function cycleData(db: DBx, key: string, today: string) {
  const S = db.hh.cycle_start_day, N: Naming = db.hh.cycle_naming
  const range = cycleRange(key, S)
  const txs = db.tx.filter((t: any) => txCycleKey(t, S, N) === key)
  const ins = txs.filter((t: any) => t.kind === 'entrada')
  const outs = txs.filter((t: any) => t.kind === 'saida')
  const manual = db.manualBills.filter((b: any) => billCycleKey(b.due_date, N) === key)
  const paid = db.fixedPaid.filter((p: any) => p.cycle_key === key)
  const fixedById = Object.fromEntries(db.fixed.map((f: any) => [f.id, f]))
  const sum = (a: any[], f = (x: any) => Number(x.amount)) => a.reduce((s, x) => s + f(x), 0)
  const entradas = sum(ins)
  const cardOut = sum(outs.filter((t: any) => t.payment === 'credito'))
  const manualOut = sum(manual)
  const fixedOut = sum(paid)
  const saidas = sum(outs) + manualOut + fixedOut
  const pendingFixed = db.fixed.filter((f: any) => !paid.find((p: any) => p.fixed_id === f.id))
  const pendingFixedSum = sum(pendingFixed)
  const byCat: Record<string, number> = {}
  outs.forEach((t: any) => { const k = t.category_id || 'none'; byCat[k] = (byCat[k] || 0) + Number(t.amount) })
  paid.forEach((p: any) => { const k = fixedById[p.fixed_id]?.category_id || 'none'; byCat[k] = (byCat[k] || 0) + Number(p.amount) })
  if (manualOut) byCat['manual'] = (byCat['manual'] || 0) + manualOut
  const catById = Object.fromEntries(db.categories.map((c: any) => [c.id, c]))
  const macro = { viver: 0, crescer: 0, curtir: 0 }
  Object.entries(byCat).forEach(([k, v]) => { const m = catById[k]?.macro || 'viver'; (macro as any)[m] += v })
  const leisureIds = new Set(db.categories.filter((c: any) => c.is_leisure).map((c: any) => c.id))
  const leisureGroups = new Set(outs.filter((t: any) => leisureIds.has(t.category_id)).map((t: any) => t.group_id || t.id))
  const leisureCount = leisureGroups.size
  // faturas do ciclo por cartão
  const bills: CardBill[] = []
  const pushBill = (cardId: string, due: string, amt: number, isManual: boolean, item: any) => {
    const card = db.cards.find((c: any) => c.id === cardId); if (!card) return
    let b = bills.find((x) => x.card.id === cardId && x.due === due)
    if (!b) { b = { card, due, amount: 0, manual: 0, items: [] }; bills.push(b) }
    b.amount += amt; if (isManual) b.manual += amt; b.items.push(item)
  }
  outs.filter((t: any) => t.payment === 'credito' && t.card_id).forEach((t: any) => pushBill(t.card_id, t.bill_due, Number(t.amount), false, t))
  manual.forEach((m: any) => pushBill(m.card_id, m.due_date, Number(m.amount), true, m))
  bills.sort((a, b) => a.due.localeCompare(b.due))
  const cap = Number(db.hh.month_cap) || 0
  const isCurrent = today >= range.start && today <= range.end
  const daysTotal = diffDays(range.start, range.end) + 1
  const dayN = isCurrent ? diffDays(range.start, today) + 1 : (today > range.end ? daysTotal : 0)
  const daysLeft = isCurrent ? diffDays(today, range.end) + 1 : 0
  const free = cap > 0 ? cap - saidas - pendingFixedSum : null
  const perDay = free != null && daysLeft > 0 ? Math.max(0, free) / daysLeft : null
  // adiantamentos: pegos no ciclo anterior descontam do salário deste ciclo
  const incomeRows = db.income.map((s: any) => {
    const advs = ins.filter((t: any) => t.income_source_id === s.id && t.is_advance)
    const adv = sum(advs)
    const received = sum(ins.filter((t: any) => t.income_source_id === s.id && !t.is_advance))
    const expected = Number(s.expected_amount) || 0
    return { source: s, expected, adv, advs, net: Math.max(0, expected - adv), received, missing: Math.max(0, expected - adv - received) }
  })
  return { key, range, txs, ins, outs, manual, paid, entradas, saidas, saldo: entradas - saidas, cardOut, manualOut, fixedOut, pendingFixed, pendingFixedSum, byCat, macro, leisureCount, bills, cap, isCurrent, daysTotal, dayN, daysLeft, free, perDay, incomeRows }
}
/** Faturas (de qualquer ciclo) que vencem entre hoje e hoje+3. */
export function billsDueSoon(db: DBx, today: string) {
  const limit = addDays(today, 3); const map: Record<string, { card: any; due: string; amount: number }> = {}
  const add = (cardId: string, due: string, amt: number) => {
    if (!due || due < today || due > limit) return
    const card = db.cards.find((c: any) => c.id === cardId); if (!card) return
    const k = cardId + due; map[k] = map[k] || { card, due, amount: 0 }; map[k].amount += amt
  }
  db.tx.filter((t: any) => t.kind === 'saida' && t.payment === 'credito').forEach((t: any) => add(t.card_id, t.bill_due, Number(t.amount)))
  db.manualBills.forEach((m: any) => add(m.card_id, m.due_date, Number(m.amount)))
  return Object.values(map).sort((a, b) => a.due.localeCompare(b.due))
}
/** Gasto acumulado por dia do ciclo (para o gráfico de ritmo). */
export function paceSeries(db: DBx, cd: ReturnType<typeof cycleData>) {
  const pts: Record<number, number> = {}
  const at = (d: string) => Math.min(cd.daysTotal, Math.max(1, diffDays(cd.range.start, d) + 1))
  cd.outs.forEach((t: any) => { const d = t.payment === 'credito' ? (t.bill_due < cd.range.start ? cd.range.start : t.bill_due) : t.date; const i = at(d); pts[i] = (pts[i] || 0) + Number(t.amount) })
  cd.manual.forEach((m: any) => { const i = at(m.due_date < cd.range.start ? cd.range.start : m.due_date); pts[i] = (pts[i] || 0) + Number(m.amount) })
  cd.paid.forEach((p: any) => { const i = at(p.paid_on); pts[i] = (pts[i] || 0) + Number(p.amount) })
  const upto = cd.isCurrent ? cd.dayN : cd.daysTotal
  const out: number[] = []; let acc = 0
  for (let i = 1; i <= upto; i++) { acc += pts[i] || 0; out.push(acc) }
  return out
}
