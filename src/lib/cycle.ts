// Ciclo do mês (ex.: dia 15 a dia 14) e regra das faturas. Funções puras, sem dependências.
export const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
export type Naming = 'start' | 'end'
const pad = (n: number) => String(n).padStart(2, '0')
export function parts(s: string) { const [y, m, d] = s.split('-').map(Number); return { y, m, d } }
export function ds(y: number, m: number, d: number) { return `${y}-${pad(m)}-${pad(d)}` }
export function monthLen(y: number, m: number) { return new Date(y, m, 0).getDate() }
export function addMonthsYM(y: number, m: number, n: number) { const t = y * 12 + (m - 1) + n; return { y: Math.floor(t / 12), m: (t % 12) + 1 } }
export function ymKey(y: number, m: number) { return `${y}-${pad(m)}` }
export function keyParts(k: string) { const [y, m] = k.split('-').map(Number); return { y, m } }
export function shiftKey(k: string, n: number) { const { y, m } = keyParts(k); const r = addMonthsYM(y, m, n); return ymKey(r.y, r.m) }
export function todayStr(now = new Date()) { return ds(now.getFullYear(), now.getMonth() + 1, now.getDate()) }
export function addDays(s: string, n: number) { const { y, m, d } = parts(s); const t = new Date(y, m - 1, d + n); return ds(t.getFullYear(), t.getMonth() + 1, t.getDate()) }
export function diffDays(a: string, b: string) { const A = parts(a), B = parts(b); return Math.round((Date.UTC(B.y, B.m - 1, B.d) - Date.UTC(A.y, A.m - 1, A.d)) / 86400000) }
export function dow(s: string) { const { y, m, d } = parts(s); return new Date(y, m - 1, d).getDay() }

/** Chave do ciclo = ano-mês em que o ciclo COMEÇA (ex.: 15/11–14/12 → "2026-11"). */
export function cycleKeyOf(date: string, startDay: number) {
  const { y, m, d } = parts(date)
  if (d >= startDay) return ymKey(y, m)
  const p = addMonthsYM(y, m, -1); return ymKey(p.y, p.m)
}
export function cycleRange(key: string, startDay: number) {
  const { y, m } = keyParts(key); const n = addMonthsYM(y, m, 1)
  const start = ds(y, m, startDay)
  const end = addDays(ds(n.y, n.m, startDay), -1)
  return { start, end }
}
/** Nome do ciclo. 'start' = mês em que começa (escolha da Isa). */
export function cycleName(key: string, naming: Naming) {
  const { y, m } = keyParts(key); const r = naming === 'start' ? { y, m } : addMonthsYM(y, m, 1)
  return MESES[r.m - 1]
}
export function cycleLabel(key: string, naming: Naming) { const { y } = keyParts(key); return `${cycleName(key, naming)} ${y}` }
/** Regra da fatura: entra no ciclo com o NOME do mês em que vence. */
export function billCycleKey(due: string, naming: Naming) {
  const { y, m } = parts(due)
  return naming === 'start' ? ymKey(y, m) : shiftKey(ymKey(y, m), -1)
}
/** Data de vencimento da fatura em que cai uma compra feita em `purchase`. */
export function billDueFor(purchase: string, closingDay: number, dueDay: number) {
  const { y, m, d } = parts(purchase)
  const close = d <= Math.min(closingDay, monthLen(y, m)) ? { y, m } : addMonthsYM(y, m, 1)
  const dm = dueDay > closingDay ? close : addMonthsYM(close.y, close.m, 1)
  return ds(dm.y, dm.m, Math.min(dueDay, monthLen(dm.y, dm.m)))
}
export function addMonthsDate(s: string, n: number, day?: number) {
  const { y, m, d } = parts(s); const r = addMonthsYM(y, m, n); return ds(r.y, r.m, Math.min(day ?? d, monthLen(r.y, r.m)))
}
/** Parcelas: valor dividido, centavos que sobram vão na 1ª parcela. */
export function splitInstallments(total: number, n: number) {
  const cents = Math.round(total * 100); const base = Math.floor(cents / n); const first = cents - base * (n - 1)
  return Array.from({ length: n }, (_, i) => (i === 0 ? first : base) / 100)
}
export function installmentDues(purchase: string, closingDay: number, dueDay: number, n: number) {
  const first = billDueFor(purchase, closingDay, dueDay)
  return Array.from({ length: n }, (_, i) => addMonthsDate(first, i, dueDay))
}
