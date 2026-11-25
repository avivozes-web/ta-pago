import { cycleData, expectedFor, txCycleKey, isCardPaymentCat, fixedInCycle } from './calc.ts'
import { shiftKey, cycleKeyOf, addMonthsYM, keyParts, ymKey, splitInstallments } from './cycle.ts'

export function r2(n: number) { return Math.round((Number(n) || 0) * 100) / 100 }
export function rulePct(hh: any) { const v = Number(hh?.buy_rule_pct); return v > 0 && v <= 100 ? v : 90 }
export function interestPct(hh: any) { const v = Number(hh?.buy_interest_pct); return v >= 0 && v <= 100 ? v : 3 }

/** Parcela com juros compostos (Price). */
export function pmt(principal: number, monthlyRate: number, n: number) {
  const p = Number(principal) || 0
  if (n <= 1) return r2(p)
  if (monthlyRate <= 0) return r2(p / n)
  const i = monthlyRate, f = Math.pow(1 + i, n)
  return r2(p * i * f / (f - 1))
}

export function installmentOf(amount: number, n: number, interest: 'sim' | 'nao' | 'nao_sei', knownPmt?: number, ratePct = 3) {
  const a = r2(amount), times = Math.max(1, Math.round(n) || 1)
  if (times <= 1) return { n: 1, inst: a, total: a, juros: 0, parts: [a] }
  if (interest === 'sim' && knownPmt && knownPmt > 0) {
    const inst = r2(knownPmt), total = r2(inst * times)
    return { n: times, inst, total, juros: r2(total - a), parts: Array(times).fill(inst) }
  }
  if (interest === 'nao') {
    const parts = splitInstallments(a, times)
    return { n: times, inst: parts[0], total: a, juros: 0, parts }
  }
  const inst = pmt(a, ratePct / 100, times), total = r2(inst * times)
  return { n: times, inst, total, juros: r2(Math.max(0, total - a)), parts: Array(times).fill(inst) }
}

function catOf(db: any, id: string | null) { return (db.categories || []).find((c: any) => c.id === id) }
export function isDailyTx(t: any, db: any) {
  if (!t || t.kind !== 'saida' || t.payment === 'credito' || t.invest_goal_id) return false
  const c = catOf(db, t.category_id)
  if (c?.is_invest || isCardPaymentCat(c)) return false
  return true
}

/** Média do dia a dia (pix, débito, dinheiro; sem crédito, sem guardar, sem pagamento de fatura) nos últimos ciclos com dados. */
export function dayToDayAvg(db: any, today: string, n = 3) {
  const S = db.hh.cycle_start_day, N = db.hh.cycle_naming
  const cur = cycleKeyOf(today, S)
  const sums: number[] = []
  for (let i = 0; i < Math.max(1, n); i++) {
    const k = shiftKey(cur, -i)
    const v = (db.tx || []).filter((t: any) => isDailyTx(t, db) && txCycleKey(t, S, N) === k).reduce((s: number, t: any) => s + Number(t.amount), 0)
    if (v > 0 || i === 0) sums.push(v)
  }
  const used = sums.filter((v, i) => v > 0 || i === 0)
  const pos = used.filter((v) => v > 0)
  if (!pos.length) return 0
  return r2(pos.reduce((a, b) => a + b, 0) / pos.length)
}

export function incomeOf(db: any, key: string) {
  return r2((db.income || []).reduce((s: number, src: any) => s + (src.is_salary ? expectedFor(src, key) : Number(src.expected_amount) || 0), 0))
}

function savedToward(db: any, goalId: string, key?: string) {
  const S = db.hh.cycle_start_day, N = db.hh.cycle_naming
  return r2((db.tx || []).filter((t: any) => t.kind === 'saida' && t.invest_goal_id === goalId && (!key || txCycleKey(t, S, N) === key)).reduce((s: number, t: any) => s + Number(t.amount), 0))
}

export function savedInCycle(db: any, key: string) {
  const S = db.hh.cycle_start_day, N = db.hh.cycle_naming
  const investCat = (db.categories || []).find((c: any) => c.is_invest)
  return r2((db.tx || []).filter((t: any) => t.kind === 'saida' && (t.invest_goal_id || (investCat && t.category_id === investCat.id)) && txCycleKey(t, S, N) === key).reduce((s: number, t: any) => s + Number(t.amount), 0))
}

export function monthsUntil(deadline: string | null | undefined, fromKey: string) {
  if (!deadline) return null
  const a = keyParts(fromKey), b = keyParts(deadline)
  return (b.y - a.y) * 12 + (b.m - a.m)
}

function plannedGoals(db: any, key: string) {
  let sum = 0
  for (const g of db.investGoals || []) {
    const already = Number(g.start_amount) || 0
    const got = savedToward(db, g.id)
    const left = Math.max(0, Number(g.target) - already - got)
    if (left <= 0) continue
    let plan = Number(g.monthly_amount) || 0
    if (!plan && g.deadline) {
      const m = monthsUntil(g.deadline, key)
      if (m != null && m > 0) plan = left / m
      else if (m != null && m <= 0) plan = left
    }
    const thisCycle = savedToward(db, g.id, key)
    sum += Math.max(plan, thisCycle)
  }
  return r2(sum)
}

export function committedOf(db: any, key: string, today: string) {
  const cd = cycleData(db, key, today)
  const fixosList = fixedInCycle(db.fixed, key)
  const paidBy = Object.fromEntries(cd.paid.map((p: any) => [p.fixed_id, p]))
  const fixos = r2(fixosList.reduce((s: number, f: any) => s + Number(paidBy[f.id] ? paidBy[f.id].amount : f.amount), 0))
  const faturas = r2(cd.bills.reduce((s, b) => s + b.amount, 0))
  const loans = r2(cd.loanPaidOut + cd.pendingLoanSum)
  const avg = dayToDayAvg(db, today)
  const actualDaily = r2(cd.spendOuts.filter((t: any) => isDailyTx(t, db)).reduce((s: number, t: any) => s + Number(t.amount), 0))
  const daily = cd.isCurrent ? Math.max(actualDaily, avg) : avg
  const goals = plannedGoals(db, key)
  const total = r2(fixos + faturas + loans + daily + goals)
  return { key, income: incomeOf(db, key), fixos, faturas, loans, daily, actualDaily, avg, goals, total, cd }
}

export function purchaseHit(amount: number, pay: 'vista' | 'parcelado', n: number, interest: 'sim' | 'nao' | 'nao_sei', knownPmt: number | undefined, ratePct: number) {
  if (pay === 'vista') return { pay: 'vista' as const, n: 1, inst: r2(amount), total: r2(amount), juros: 0, parts: [r2(amount)] }
  return { pay: 'parcelado' as const, ...installmentOf(amount, n, interest, knownPmt, ratePct) }
}

export function delayGoals(db: any, key: string, monthlySaveNow: number, monthlySaveAfter: number) {
  const out: { id: string; name: string; left: number; monthsNow: number | null; monthsAfter: number | null; delay: number | null }[] = []
  for (const g of db.investGoals || []) {
    const left = Math.max(0, Number(g.target) - (Number(g.start_amount) || 0) - savedToward(db, g.id))
    if (left <= 0) continue
    const monthsNow = monthlySaveNow > 0 ? Math.ceil(left / monthlySaveNow) : null
    const monthsAfter = monthlySaveAfter > 0 ? Math.ceil(left / monthlySaveAfter) : null
    const delay = monthsNow != null && monthsAfter != null ? Math.max(0, monthsAfter - monthsNow) : (monthsAfter == null && monthsNow != null ? null : 0)
    out.push({ id: g.id, name: g.name, left: r2(left), monthsNow, monthsAfter, delay })
  }
  return out
}

export type BuyInput = {
  name: string; amount: number; pay: 'vista' | 'parcelado' | 'melhor'
  n: number; interest: 'sim' | 'nao' | 'nao_sei'; knownPmt?: number; motive?: string
}

function scoreOption(income: number, committed: number, hit: number, rule: number, delays: { delay: number | null }[]) {
  const ratio = income > 0 ? (committed + hit) / income : 1
  const over = ratio - rule / 100
  const delaySum = delays.reduce((s, d) => s + (d.delay == null ? 24 : d.delay), 0)
  return { ratio, over, delaySum, ok: over <= 0.0001 }
}

function analyzeOne(db: any, today: string, amount: number, pay: 'vista' | 'parcelado', n: number, interest: 'sim' | 'nao' | 'nao_sei', knownPmt: number | undefined) {
  const key = cycleKeyOf(today, db.hh.cycle_start_day)
  const c = committedOf(db, key, today)
  const rate = interestPct(db.hh)
  const rule = rulePct(db.hh)
  const hit = purchaseHit(amount, pay, n, interest, knownPmt, rate)
  const withHit = r2(c.total + hit.inst)
  const pctNow = c.income > 0 ? r2((c.total / c.income) * 100) : 0
  const pctAfter = c.income > 0 ? r2((withHit / c.income) * 100) : 0
  const surplus = r2(Math.max(0, c.income - (c.fixos + c.faturas + c.loans + c.daily)))
  const surplusAfter = r2(Math.max(0, surplus - hit.inst))
  const delays = delayGoals(db, key, surplus, surplusAfter)
  const sc = scoreOption(c.income, c.total, hit.inst, rule, delays)
  return { key, c, hit, withHit, pctNow, pctAfter, rule, surplus, surplusAfter, delays, ok: sc.ok, score: sc }
}

export function analyzeBuy(db: any, today: string, input: BuyInput) {
  const rate = interestPct(db.hh)
  if (input.pay !== 'melhor') return analyzeOne(db, today, input.amount, input.pay, input.n || 1, input.interest, input.knownPmt)
  const opts = [
    analyzeOne(db, today, input.amount, 'vista', 1, 'nao', undefined),
    ...([3, 6, 10, 12].map((n) => analyzeOne(db, today, input.amount, 'parcelado', n, 'nao', undefined))),
  ]
  const ok = opts.filter((o) => o.ok)
  const pickFrom = ok.length ? ok : opts
  pickFrom.sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? -1 : 1) || a.score.delaySum - b.score.delaySum || a.score.ratio - b.score.ratio || a.hit.juros - b.hit.juros)
  return pickFrom[0]
}

export function verdictText(a: ReturnType<typeof analyzeOne>, motive?: string) {
  if (!a.c.income) return 'Não dá para responder com segurança: não achei uma renda neste ciclo.'
  if (!a.ok) return 'Eu não compraria agora.'
  const badDelay = a.delays.some((d) => d.delay != null && d.delay >= 2) || a.delays.some((d) => d.monthsAfter == null && d.left > 0)
  if (badDelay) return 'Dá para caber, mas atrasa suas metas.'
  if (motive === 'impulso') return 'Cabe no mês, mas é impulso: eu esperaria um dia.'
  return 'Pode comprar, se fizer sentido para você.'
}

export function pathsToFit(db: any, today: string, a: ReturnType<typeof analyzeOne>) {
  const need = r2(Math.max(0, a.withHit - (a.rule / 100) * a.c.income))
  const catBy = Object.fromEntries((db.categories || []).map((c: any) => [c.id, c]))
  const curtirViver: { id: string; name: string; v: number; macro: string }[] = []
  Object.entries(a.c.cd.byCat || {}).forEach(([id, v]) => {
    const c = catBy[id]; const m = c?.macro
    if ((m === 'curtir' || m === 'viver') && Number(v) > 0) curtirViver.push({ id, name: c.name, v: Number(v), macro: m })
  })
  curtirViver.sort((x, y) => y.v - x.v)
  const cutNames = curtirViver.slice(0, 3).map((x) => x.name).join(' e ')
  const cut = need > 0
    ? { title: `Gastar ${brlTxt(need)} a menos por mês`, d: cutNames ? `em ${cutNames} · a parcela fica abaixo dos ${a.rule}%` : `nas categorias de viver e curtir · a parcela fica abaixo dos ${a.rule}%`, need }
    : { title: 'Já cabe no mês', d: `com a regra dos ${a.rule}%, não precisa cortar`, need: 0 }
  const save = a.surplus
  const monthsVista = inputMonthsToSave(a.hit.total || a.hit.inst, Math.max(save, need > 0 ? save + need : save), a.key)
  const faster = {
    title: monthsVista.months <= 1 ? 'Guardar e comprar à vista neste mês' : `Guardar e comprar à vista em ${monthsVista.label}`,
    d: save > 0 ? `${brlTxt(monthsVista.per)} por mês · sem juros` : 'quando sobrar um pouco, dá para ir guardando e comprar à vista',
    months: monthsVista.months, per: monthsVista.per, key: monthsVista.key,
  }
  const zMonths = 6
  const z = r2((a.hit.total || a.c.income && a.hit.inst) / zMonths) || r2((a.hit.total || 0) / zMonths)
  const zPer = z > 0 ? z : r2((a.hit.total || 0) / zMonths)
  const slow = inputMonthsToSave(a.hit.total || a.hit.inst, zPer || 1, a.key)
  const later = {
    title: `Guardar ${brlTxt(slow.per)} por mês e comprar à vista`,
    d: `em ${slow.label} · você evita os juros` + (a.hit.juros > 0 ? ` de ${brlTxt(a.hit.juros)}` : ''),
    months: slow.months, per: slow.per, key: slow.key,
  }
  return { cut, faster, later }
}

function brlTxt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function inputMonthsToSave(total: number, per: number, fromKey: string) {
  const p = Math.max(0, per), t0 = Math.max(0, total)
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro']
  if (t0 <= 0) return { months: 0, per: 0, key: fromKey, label: 'este mês' }
  if (p <= 0) return { months: 99, per: 0, key: '', label: 'quando der' }
  const months = Math.max(1, Math.ceil(t0 / p))
  const key = targetKeyFromMonths(fromKey, months)
  const { y, m } = keyParts(key)
  return { months, per: r2(p), key, label: `${MESES[m - 1]}/${y}` }
}

export function targetKeyFromMonths(fromKey: string, months: number) {
  const { y, m } = addMonthsYM(...(() => { const k = keyParts(fromKey); return [k.y, k.m] as [number, number] })(), Math.max(0, months - 1))
  return ymKey(y, m)
}

/** Sobra depois de Viver e Curtir (Crescer fica de fora: é guardar). */
export function leftoverAfterLiveEnjoy(db: any, key: string, today: string) {
  const c = committedOf(db, key, today)
  const catBy = Object.fromEntries((db.categories || []).map((x: any) => [x.id, x]))
  let crescer = 0
  for (const f of c.cd.pendingFixed) {
    if (catBy[f.category_id]?.macro === 'crescer') crescer += Number(f.amount) || 0
  }
  for (const [id, v] of Object.entries(c.cd.byCat || {})) {
    if (catBy[id]?.macro === 'crescer') crescer += Number(v)
  }
  const used = r2(c.fixos + c.faturas + c.loans + c.daily - crescer)
  return { income: c.income, used, leftover: r2(c.income - used), crescer: r2(crescer) }
}

export function projection(db: any, fromKey: string, today: string, months: 3 | 6 | 12) {
  const rows = Array.from({ length: months }, (_, i) => {
    const key = shiftKey(fromKey, i)
    const c = committedOf(db, key, today)
    const live = leftoverAfterLiveEnjoy(db, key, today)
    return { key, income: c.income, committed: c.total, leftover: r2(c.income - c.total), live: live.leftover, parts: { fixos: c.fixos, faturas: c.faturas, loans: c.loans, daily: c.daily, goals: c.goals } }
  })
  const tight = rows.reduce((a, b) => (b.leftover < a.leftover ? b : a), rows[0])
  const liveMin = Math.min(...rows.map((r) => r.live))
  const canRecommend = liveMin > 0
  const rec = canRecommend ? r2(Math.min(...rows.map((r) => Math.max(0, r.live))) * 0.5) : 0
  return { rows, tight, canRecommend, recommended: rec, liveMin }
}

const GUARDAR_RE = /guardar|juntar|reserva|poupar|economiz/i
const RE_VAL = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/i

export function parseMonthGoal(name: string, kind?: string, target?: number | null) {
  const k = kind && kind !== 'livre' ? kind : (GUARDAR_RE.test(name) ? 'guardar' : 'livre')
  if (target && target > 0) return { kind: k, target: r2(target) }
  if (k === 'guardar') {
    const m = name.match(RE_VAL)
    if (m) {
      const n = Number(String(m[1]).replace(/\./g, '').replace(',', '.'))
      if (n > 0) return { kind: k, target: r2(n) }
    }
  }
  return { kind: k, target: target && target > 0 ? r2(target) : null }
}

export function monthGoalDone(g: any, db: any, key: string) {
  if (g.done_manual) return { done: true, auto: false }
  if (g.skipped) return { done: false, auto: false }
  const parsed = parseMonthGoal(g.name, g.kind, g.target)
  if (parsed.kind === 'guardar' && parsed.target && parsed.target > 0) {
    const saved = savedInCycle(db, key)
    if (saved + 0.001 >= parsed.target) return { done: true, auto: true, saved, target: parsed.target }
  }
  return { done: false, auto: false }
}

export function goalMonthlyProgress(db: any, g: any, fromKey: string) {
  const already = Number(g.start_amount) || 0
  const hist: { key: string; v: number }[] = []
  // 6 cycles back through deadline or +6
  const endN = g.deadline ? Math.max(0, monthsUntil(g.deadline, fromKey) ?? 0) : 0
  for (let i = -5; i <= endN; i++) {
    const k = shiftKey(fromKey, i)
    hist.push({ key: k, v: savedToward(db, g.id, k) })
  }
  const got = already + savedToward(db, g.id)
  const target = Number(g.target) || 0
  const pct = target > 0 ? (got / target) * 100 : 0
  const left = Math.max(0, target - got)
  const mLeft = g.deadline ? monthsUntil(g.deadline, fromKey) : null
  const per = mLeft != null && mLeft > 0 ? r2(left / mLeft) : (g.monthly_amount ? r2(Number(g.monthly_amount)) : null)
  return { got: r2(got), target, pct, left: r2(left), mLeft, per, hist, already }
}
