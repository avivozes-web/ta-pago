import { billCycleKey, cycleKeyOf, cycleRange, diffDays, addDays, shiftKey, parts, ds, monthLen, addMonthsDate, type Naming } from './cycle'
export type DBx = any
export interface CardBill { card: any; due: string; amount: number; manual: number; items: any[] }

export function txCycleKey(t: any, startDay: number, naming: Naming) {
  if (t.for_cycle) return t.for_cycle
  if (t.kind === 'saida' && t.payment === 'credito' && t.bill_due) return billCycleKey(t.bill_due, naming)
  // Adiantamento é dinheiro do PRÓXIMO salário: entra no ciclo desse salário (o mesmo em que caem as faturas que ele paga)
  if (t.kind === 'entrada' && t.is_advance) return shiftKey(cycleKeyOf(t.date, startDay), 1)
  return cycleKeyOf(t.date, startDay)
}
/** Valor do salário/entrada previsto para um ciclo: mudanças valem daquele ciclo para frente. */
export function expectedFor(s: any, key: string) {
  const rates = (Array.isArray(s.rates) ? s.rates : []).filter((r: any) => r.from <= key).sort((a: any, b: any) => a.from.localeCompare(b.from))
  return rates.length ? Number(rates[rates.length - 1].amount) || 0 : Number(s.expected_amount) || 0
}
/** Dia em que um fixo vence dentro do ciclo (ou null se não tem dia). */
export function fixedDueIn(f: any, range: { start: string; end: string }) {
  if (!f.due_day) return null
  const s = parts(range.start); let d = ds(s.y, s.m, Math.min(f.due_day, monthLen(s.y, s.m)))
  if (d < range.start) { const n = s.m === 12 ? { y: s.y + 1, m: 1 } : { y: s.y, m: s.m + 1 }; d = ds(n.y, n.m, Math.min(f.due_day, monthLen(n.y, n.m))) }
  return d
}
/** Quando o cheque especial usado vai ser pago (padrão: no próximo dia de salário). */
export function overdraftPayDate(od: any, today: string, startDay: number) {
  return od.pay_date || cycleRange(shiftKey(cycleKeyOf(today, startDay), 1), startDay).start
}

export function isCardPaymentCat(c: any) {
  if (!c) return false
  if (c.exclude_from_spend) return true
  const n = String(c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  return n.startsWith('pagamento de cartao')
}
export function loanInstallments(loan: any) {
  const paid = loan.paid && typeof loan.paid === 'object' ? loan.paid : {}
  return Array.from({ length: Number(loan.installments) || 0 }, (_, i) => {
    const n = i + 1
    const due = addMonthsDate(loan.first_due, i)
    return { loan, n, due, amount: Number(loan.amount), paidOn: paid[String(n)] || paid[n] || null }
  })
}
export function cycleData(db: DBx, key: string, today: string) {
  const S = db.hh.cycle_start_day, N: Naming = db.hh.cycle_naming
  const range = cycleRange(key, S)
  const realTxs = db.tx.filter((t: any) => txCycleKey(t, S, N) === key)
  // salários recorrentes: entram sozinhos no dia do salário, se ela não lançou outro valor/data
  const autoSal: any[] = []; const salPending: any[] = []
  db.income.filter((s: any) => s.is_salary).forEach((s: any) => {
    const exp = expectedFor(s, key); if (exp <= 0) return
    if (realTxs.some((t: any) => t.kind === 'entrada' && t.income_source_id === s.id && !t.is_advance)) return
    const adv = realTxs.filter((t: any) => t.kind === 'entrada' && t.income_source_id === s.id && t.is_advance).reduce((a: number, t: any) => a + Number(t.amount), 0)
    const net = Math.max(0, exp - adv); if (net <= 0) return
    const v = { id: `auto-${s.id}-${key}`, auto: true, kind: 'entrada', description: s.name, amount: net, date: range.start, income_source_id: s.id, is_advance: false, payment: 'pix', created_at: range.start }
    if (range.start <= today) autoSal.push(v); else salPending.push(v)
  })
  const txs = [...realTxs, ...autoSal]
  const ins = txs.filter((t: any) => t.kind === 'entrada')
  const outs = txs.filter((t: any) => t.kind === 'saida')
  const noSpend = new Set((db.categories || []).filter((c: any) => isCardPaymentCat(c)).map((c: any) => c.id))
  const spendOuts = outs.filter((t: any) => !noSpend.has(t.category_id))
  const payOuts = outs.filter((t: any) => noSpend.has(t.category_id))
  const manual = db.manualBills.filter((b: any) => billCycleKey(b.due_date, N) === key)
  const paid = db.fixedPaid.filter((p: any) => p.cycle_key === key)
  const fixedById = Object.fromEntries(db.fixed.map((f: any) => [f.id, f]))
  const sum = (a: any[], f = (x: any) => Number(x.amount)) => a.reduce((s, x) => s + f(x), 0)
  const entradas = sum(ins)
  const cardOut = sum(spendOuts.filter((t: any) => t.payment === 'credito'))
  const manualOut = sum(manual)
  const fixedOut = sum(paid)
  const odPending = (db.overdraft || []).filter((o: any) => Number(o.used_amount) > 0 && cycleKeyOf(overdraftPayDate(o, today, S), S) === key).map((o: any) => ({ ...o, payDate: overdraftPayDate(o, today, S), amount: Number(o.used_amount) }))
  const odOut = sum(odPending)
  const loanInst = (db.loans || []).flatMap(loanInstallments)
  const loanInCycle = loanInst.filter((x: any) => cycleKeyOf(x.due, S) === key)
  const loanPaid = loanInCycle.filter((x: any) => x.paidOn)
  const loanPending = loanInCycle.filter((x: any) => !x.paidOn)
  const loanPaidOut = sum(loanPaid)
  const pendingLoanSum = sum(loanPending)
  const saidas = sum(spendOuts) + manualOut + fixedOut + odOut + loanPaidOut
  const pendingFixed = db.fixed.filter((f: any) => !paid.find((p: any) => p.fixed_id === f.id))
  const pendingFixedSum = sum(pendingFixed)
  const byCat: Record<string, number> = {}
  spendOuts.forEach((t: any) => { const k = t.category_id || 'none'; byCat[k] = (byCat[k] || 0) + Number(t.amount) })
  paid.forEach((p: any) => { const k = fixedById[p.fixed_id]?.category_id || 'none'; byCat[k] = (byCat[k] || 0) + Number(p.amount) })
  if (manualOut) byCat['manual'] = (byCat['manual'] || 0) + manualOut
  if (odOut) byCat['cheque'] = (byCat['cheque'] || 0) + odOut
  const catById = Object.fromEntries(db.categories.map((c: any) => [c.id, c]))
  const macro = { viver: 0, crescer: 0, curtir: 0 }
  Object.entries(byCat).forEach(([k, v]) => { const m = catById[k]?.macro || 'viver'; (macro as any)[m] += v })
  const leisureIds = new Set(db.categories.filter((c: any) => c.is_leisure).map((c: any) => c.id))
  const leisureGroups = new Set(spendOuts.filter((t: any) => leisureIds.has(t.category_id)).map((t: any) => t.group_id || t.id))
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
  const free = cap > 0 ? cap - saidas - pendingFixedSum - pendingLoanSum : null
  const perDay = free != null && daysLeft > 0 ? Math.max(0, free) / daysLeft : null
  // adiantamentos: pegos no ciclo anterior descontam do salário deste ciclo
  const incomeRows = db.income.map((s: any) => {
    const advs = ins.filter((t: any) => t.income_source_id === s.id && t.is_advance)
    const adv = sum(advs)
    const received = sum(ins.filter((t: any) => t.income_source_id === s.id && !t.is_advance))
    const expected = expectedFor(s, key)
    const auto = autoSal.find((t) => t.income_source_id === s.id) || null
    const pending = salPending.find((t) => t.income_source_id === s.id) || null
    const real = ins.filter((t: any) => t.income_source_id === s.id && !t.is_advance && !t.auto)
    return { source: s, expected, adv, advs, net: Math.max(0, expected - adv), received, missing: Math.max(0, expected - adv - received), auto, pending, real }
  })
  return { key, range, txs, realTxs, autoSal, salPending, odPending, odOut, ins, outs, spendOuts, payOuts, manual, paid, entradas, saidas, saldo: entradas - saidas, cardOut, manualOut, fixedOut, pendingFixed, pendingFixedSum, byCat, macro, leisureCount, bills, cap, isCurrent, daysTotal, dayN, daysLeft, free, perDay, incomeRows, loanInst, loanInCycle, loanPaid, loanPending, loanPaidOut, pendingLoanSum }
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

export interface FlowEv { id: string; date: string; t: string; d: string; v: number; kind: 'in' | 'out'; icon: string; forecast: boolean; to?: string }
/** Fluxo de caixa do ciclo: tudo que entra e sai, no dia em que acontece, com o saldo de cada dia. */
export function cashFlow(db: DBx, key: string, today: string) {
  const cd = cycleData(db, key, today); const S = db.hh.cycle_start_day
  const r = cd.range; const ev: FlowEv[] = []
  const cardBy = Object.fromEntries(db.cards.map((c: any) => [c.id, c]))
  const fixedBy = Object.fromEntries(db.fixed.map((f: any) => [f.id, f]))
  cd.ins.forEach((t: any) => ev.push({ id: t.id, date: t.date, kind: 'in', v: Number(t.amount), icon: 'trend', t: t.is_advance ? `${t.description}` : t.description, d: t.auto ? 'salário · recebido no dia ' + S : t.is_advance ? 'adiantamento do salário' : 'entrada', forecast: false, to: '/dinheiro/extrato' }))
  cd.salPending.forEach((t: any) => ev.push({ id: t.id, date: t.date, kind: 'in', v: t.amount, icon: 'trend', t: t.description, d: `salário previsto · até dia ${S}`, forecast: true, to: '/dinheiro/extrato' }))
  cd.outs.filter((t: any) => t.payment !== 'credito').forEach((t: any) => ev.push({ id: t.id, date: t.date, kind: 'out', v: Number(t.amount), icon: 'dn', t: t.description, d: 'gasto', forecast: false, to: '/dinheiro/extrato' }))
  cd.bills.forEach((b) => ev.push({ id: 'bill' + b.card.id + b.due, date: b.due, kind: 'out', v: b.amount, icon: 'card', t: `Fatura ${b.card.name}`, d: `vence ${b.due.slice(8)}/${b.due.slice(5, 7)}`, forecast: b.due > today, to: '/dinheiro/cartoes' }))
  cd.paid.forEach((p: any) => ev.push({ id: p.id, date: p.paid_on, kind: 'out', v: Number(p.amount), icon: fixedBy[p.fixed_id]?.icon || 'repeat', t: fixedBy[p.fixed_id]?.name || 'Fixo', d: 'fixo pago', forecast: false, to: '/dinheiro/fixos' }))
  cd.pendingFixed.forEach((f: any) => { const due = fixedDueIn(f, r) || r.start; ev.push({ id: 'fx' + f.id, date: due, kind: 'out', v: Number(f.amount), icon: f.icon || 'repeat', t: f.name, d: f.due_day ? 'fixo a pagar' : 'fixo a pagar · sem dia definido', forecast: true, to: '/dinheiro/fixos' }) })
  cd.odPending.forEach((o: any) => ev.push({ id: 'od' + o.id, date: o.payDate, kind: 'out', v: o.amount, icon: 'alert', t: o.name, d: 'usado · a pagar', forecast: true, to: '/dinheiro/cartoes' }))
  ev.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'in' ? -1 : 1))
  const before = ev.filter((e) => e.date < r.start)
  const days: { date: string; items: FlowEv[]; saldo: number }[] = []
  let bal = before.reduce((a, e) => a + (e.kind === 'in' ? e.v : -e.v), 0)
  const startBal = bal
  const series: number[] = []; let minBal = Infinity, minDay = r.start
  for (let d = r.start; d <= r.end; d = addDays(d, 1)) {
    const items = ev.filter((e) => e.date === d)
    items.forEach((e) => (bal += e.kind === 'in' ? e.v : -e.v))
    if (items.length) days.push({ date: d, items, saldo: bal })
    series.push(bal); if (bal < minBal) { minBal = bal; minDay = d }
  }
  const after = ev.filter((e) => e.date > r.end)
  after.forEach((e) => (bal += e.kind === 'in' ? e.v : -e.v))
  return { cd, before, startBal, days, after, series, end: bal, minBal: minBal === Infinity ? 0 : minBal, minDay, negDays: days.filter((x) => x.saldo < 0).length }
}
/** Resumo do próximo ciclo: o que já está comprometido e o que deve sobrar. */
export function nextSummary(db: DBx, key: string, today: string) {
  const nk = shiftKey(key, 1); const cd = cycleData(db, nk, today)
  const byCard: Record<string, { card: any; amount: number; due: string }> = {}
  cd.bills.forEach((b) => { const x = (byCard[b.card.id] = byCard[b.card.id] || { card: b.card, amount: 0, due: b.due }); x.amount += b.amount })
  const faturas = cd.bills.reduce((a, b) => a + b.amount, 0)
  const fixos = db.fixed.reduce((a: number, f: any) => a + Number(f.amount), 0)
  const cheque = cd.odOut
  const salarios = cd.incomeRows.filter((r: any) => r.source.is_salary).map((r: any) => ({ name: r.source.name, expected: r.expected, adv: r.adv, net: r.net }))
  const entradas = salarios.reduce((a: number, s: any) => a + s.expected, 0)
  const outrasJa = cd.realTxs.filter((t: any) => t.kind === 'saida' && t.payment !== 'credito').reduce((a: number, t: any) => a + Number(t.amount), 0)
  const comprometido = faturas + fixos + cheque + outrasJa
  return { key: nk, cards: Object.values(byCard), faturas, fixos, cheque, outrasJa, salarios, entradas, comprometido, sobra: entradas - comprometido }
}

/** Categoria "Combustível" (nome, sem acento, minúsculas). */
export function isFuelCat(c: any) {
  return !!c && String(c.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'combustivel'
}
export function fuelCatId(db: any) { return db?.categories?.find((c: any) => isFuelCat(c))?.id || null }
/** Totais de combustível do ciclo, separados por moto e carro. */
export function fuelSplit(outs: any[], catId: string | null) {
  let moto = 0, carro = 0
  if (!catId) return { moto, carro }
  for (const t of outs) {
    if (t.category_id !== catId) continue
    if (t.vehicle === 'moto') moto += Number(t.amount) || 0
    else if (t.vehicle === 'carro') carro += Number(t.amount) || 0
  }
  return { moto, carro }
}
