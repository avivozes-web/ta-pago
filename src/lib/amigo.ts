import { cycleData, billsDueSoon } from './calc.ts'
import { addDays, dow, parts, diffDays } from './cycle.ts'
import { brl } from './fmt.ts'
import { leftoverAfterLiveEnjoy, savedInCycle } from './plan.ts'

export function clockHM(hm?: string) {
  if (hm && /^\d{2}:\d{2}$/.test(hm)) return hm
  try {
    const q = new URLSearchParams((typeof location !== 'undefined' ? location.hash.split('?')[1] : '') || (typeof location !== 'undefined' ? location.search : '') || '')
    const p = q.get('agora')
    if (p && /^\d{2}:\d{2}$/.test(p)) return p
  } catch { /* */ }
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "Bom dia/Boa tarde/Boa noite, <apelido>!" — só se houver apelido. */
export function greeting(nick: string | null | undefined, hm?: string) {
  const n = (nick || '').trim()
  if (!n) return ''
  const h = Number(clockHM(hm).slice(0, 2))
  const hi = h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${hi}, ${n}!`
}

export function loggingStreak(db: any, today: string) {
  const days = new Set((db.tx || []).filter((t: any) => t.kind === 'saida' && t.date).map((t: any) => t.date))
  let start = days.has(today) ? today : addDays(today, -1)
  let n = 0
  for (let d = start, i = 0; i < 400; i++, d = addDays(d, -1)) {
    if (!days.has(d)) break
    n++
  }
  return n
}

export function biggestExpense(cd: any) {
  const seen = new Set<string>()
  let best: { name: string; v: number } | null = null
  for (const t of cd.spendOuts || cd.outs || []) {
    const id = String(t.group_id || t.id)
    if (seen.has(id)) continue
    seen.add(id)
    const v = Number(t.total_amount ?? t.amount) || 0
    if (!best || v > best.v) best = { name: t.description || 'Gasto', v }
  }
  return best
}

export type Pesa = { name: string; unit: number; n: number; month: number; year: number }

function foldName(s: string) {
  return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Gastos pequenos que se repetem, projetados no mês e no ano. Sem IA. */
export function pequenoPesa(spend: any[], dayN: number, daysTotal: number, minN = 3, maxUnit = 40): Pesa[] {
  const g: Record<string, { name: string; amounts: number[] }> = {}
  for (const t of spend || []) {
    const name = String(t.description || '').trim()
    const v = Number(t.amount) || 0
    if (!name || v <= 0 || v > maxUnit) continue
    const k = foldName(name)
    if (!g[k]) g[k] = { name, amounts: [] }
    g[k].amounts.push(v)
  }
  const dn = Math.max(1, dayN || 1)
  const dt = Math.max(dn, daysTotal || 30)
  const out: Pesa[] = []
  for (const x of Object.values(g)) {
    if (x.amounts.length < minN) continue
    const sum = x.amounts.reduce((a, b) => a + b, 0)
    const unit = Math.round((sum / x.amounts.length) * 100) / 100
    const month = Math.round((sum / dn) * dt * 100) / 100
    out.push({ name: x.name, unit, n: x.amounts.length, month, year: Math.round(month * 12 * 100) / 100 })
  }
  return out.sort((a, b) => b.year - a.year)
}

export function pesaLine(p: Pesa) {
  return `${p.name} ${brl(p.unit, false)} × ${p.n} = ${brl(p.month, false)}/mês, ${brl(p.year, false)}/ano`
}

export function encouragement(db: any, cd: any, today: string) {
  const saved = savedInCycle(db, cd.key)
  if (cd.cap > 0 && cd.isCurrent && cd.daysTotal) {
    const used = cd.saidas / cd.cap
    const pace = cd.dayN / cd.daysTotal
    if (used <= pace + 0.02) return `Você gastou ${Math.round(used * 100)}% do teto e já passou ${Math.round(pace * 100)}% do mês. Vai bem.`
    if (used > pace + 0.1) return 'O ritmo está um pouco acima. Ainda dá tempo de ajustar.'
  }
  if (saved > 0) return `Você já guardou ${brl(saved, false)} neste ciclo. Isso é um passo.`
  const live = leftoverAfterLiveEnjoy(db, cd.key, today)
  if (live.leftover > 0) return `Depois de Viver e Curtir, ainda sobra ${brl(live.leftover, false)}.`
  const st = loggingStreak(db, today)
  if (st >= 3) return `${st} dias seguidos lançando. Isso já é constância.`
  return 'Anote o que gastar. Pequenos registros fazem o mês ficar claro.'
}

/** Nota 0–100: ritmo do teto (40), cartões (30), reserva no ciclo (30). Só conta, sem IA. */
export function healthScore(db: any, cd: any) {
  let pace = 20
  if (cd.cap > 0 && cd.isCurrent && cd.daysTotal) {
    const used = cd.saidas / cd.cap
    const p = cd.dayN / cd.daysTotal
    if (used <= p) pace = 40
    else if (used >= 1) pace = used > 1.1 ? 0 : 8
    else pace = Math.max(0, Math.round(40 - (used - p) * 200))
  } else if ((cd.saldo ?? 0) >= 0) pace = 28
  else pace = 10

  const scored = (db.cards || []).filter((c: any) => Number(c.goal) > 0 || Number(c.limit_amount) > 0)
  let cards = scored.length ? 0 : 15
  if (scored.length) {
    let pts = 0
    for (const c of scored) {
      const b = (cd.bills || []).filter((x: any) => x.card.id === c.id).reduce((s: number, x: any) => s + x.amount, 0)
      const cap = Number(c.goal) > 0 ? Number(c.goal) : Number(c.limit_amount)
      if (!cap) continue
      const r = b / cap
      pts += r <= 0.85 ? 1 : r <= 1 ? 0.5 : 0
    }
    cards = Math.round(30 * (pts / scored.length))
  }

  const saved = savedInCycle(db, cd.key)
  let reserve = 10
  if (saved > 0) reserve = (db.investGoals || []).length ? 30 : 22
  else if ((db.tx || []).some((t: any) => t.invest_goal_id)) reserve = 18

  const score = Math.max(0, Math.min(100, pace + cards + reserve))
  return {
    score, pace, cards, reserve,
    how: [
      'O número vai de 0 a 100 e sai só das suas contas, sem IA.',
      `Ritmo do teto: ${pace} de 40 pontos. Gastar no ritmo dos dias do ciclo deixa esta parte cheia; passar do ritmo ou do teto tira pontos.`,
      `Cartões: ${cards} de 30 pontos. Cada cartão com meta ou limite entra. Até 85% da meta dá a nota cheia; passar da meta zera aquela parte.`,
      `Reserva: ${reserve} de 30 pontos. Se você guarda alguma coisa no ciclo (investir ou meta), esta parte sobe.`,
    ],
  }
}

export function missingForGoal(db: any) {
  let best: { name: string; left: number } | null = null
  for (const g of db.investGoals || []) {
    const already = Number(g.start_amount) || 0
    const got = (db.tx || []).filter((t: any) => t.invest_goal_id === g.id).reduce((s: number, t: any) => s + Number(t.amount), 0)
    const left = Math.max(0, Number(g.target) - already - got)
    if (left > 0 && (!best || left < best.left)) best = { name: g.name, left }
  }
  return best
}

export function weekStart(today: string) { return addDays(today, -((dow(today) + 6) % 7)) }
export function shouldShowWeekly(hh: any, today: string) {
  if (hh?.analyses_on === false || !hh?.analyses_weekly) return false
  const want = hh.analyses_weekly_dow
  if (want == null) return false
  const mon = weekStart(today)
  const day = addDays(mon, (Number(want) + 6) % 7) // dow 0=dom … convert to offset from monday
  return today >= day
}
export function shouldShowMonthly(hh: any, today: string) {
  if (hh?.analyses_on === false || !hh?.analyses_monthly) return false
  const day = Number(hh.analyses_monthly_day)
  if (!day) return false
  return parts(today).d >= day
}

export type InboxMsg = { id: string; kind: 'alert' | 'analysis' | 'note'; lvl: 'neg' | 'warn' | 'acc'; t: string; d: string; to?: string; analysis?: boolean }

export function limitAlerts(db: any, cd: any): InboxMsg[] {
  const out: InboxMsg[] = []
  const al = db.hh.alerts || {}
  if (al.cat90 !== false) (db.categories || []).filter((c: any) => c.goal > 0).forEach((c: any) => {
    const v = cd.byCat[c.id] || 0; const p = v / c.goal
    if (p > 1) out.push({ id: `cat:${c.id}:${cd.key}`, kind: 'alert', lvl: 'neg', t: `Passou do limite de ${c.name}`, d: `${brl(v, false)} de ${brl(c.goal, false)} · ${brl(v - c.goal, false)} acima`, to: '/dinheiro/metas' })
    else if (p >= 0.95) out.push({ id: `cat:${c.id}:${cd.key}`, kind: 'alert', lvl: 'warn', t: `${Math.round(p * 100)}% do limite de ${c.name}`, d: `${brl(v, false)} de ${brl(c.goal, false)}${cd.daysLeft ? ` · faltam ${cd.daysLeft} dias` : ''}`, to: '/dinheiro/metas' })
    else if (p >= 0.9) out.push({ id: `cat:${c.id}:${cd.key}`, kind: 'alert', lvl: 'warn', t: `${c.name} em ${Math.round(p * 100)}%`, d: `${brl(v, false)} de ${brl(c.goal, false)}${cd.daysLeft ? ` · faltam ${cd.daysLeft} dias` : ''}`, to: '/dinheiro/metas' })
  })
  if (al.leisure !== false && cd.leisureCount > db.hh.leisure_max) out.push({ id: `leisure:${cd.key}`, kind: 'alert', lvl: 'warn', t: `${cd.leisureCount}ª saída de lazer no ciclo`, d: `O combinado é até ${db.hh.leisure_max} por ciclo`, to: '/dinheiro/metas' })
  if (al.card !== false) (db.cards || []).filter((c: any) => c.goal != null).forEach((c: any) => {
    const b = (cd.bills || []).filter((x: any) => x.card.id === c.id).reduce((s: number, x: any) => s + x.amount, 0)
    if (Number(c.goal) === 0 && b > 0) out.push({ id: `card:${c.id}:${cd.key}`, kind: 'alert', lvl: 'warn', t: `${c.name} com gasto novo`, d: `Meta é R$ 0 (parando de usar) · ${brl(b)} neste ciclo`, to: '/dinheiro/cartoes' })
    else if (c.goal > 0 && b / c.goal >= 0.85) out.push({ id: `card:${c.id}:${cd.key}`, kind: 'alert', lvl: b > c.goal ? 'neg' : 'warn', t: `Cartão ${c.name} em ${Math.round((b / c.goal) * 100)}% da meta`, d: `${brl(b, false)} de ${brl(Number(c.goal), false)}`, to: '/dinheiro/cartoes' })
  })
  if (al.pace !== false && cd.cap > 0 && cd.isCurrent && cd.saidas / cd.cap > cd.dayN / cd.daysTotal + 0.1) out.push({ id: `pace:${cd.key}`, kind: 'alert', lvl: 'warn', t: 'Gastando acima do ritmo', d: `${Math.round((cd.saidas / cd.cap) * 100)}% do teto em ${Math.round((cd.dayN / cd.daysTotal) * 100)}% do ciclo`, to: '/dinheiro/metas' })
  return out
}

function analysisFrom(list: Pesa[], id: string, title: string): InboxMsg | null {
  const p = list[0]
  if (!p) return null
  return { id, kind: 'analysis', lvl: 'acc', analysis: true, t: title, d: `${pesaLine(p)}. Vale olhar se isso ainda cabe.` }
}

export function inboxMessages(db: any, today: string, key: string): InboxMsg[] {
  const cd = cycleData(db, key, today)
  const ignored = new Set(db.hh.inbox_ignored || [])
  const out: InboxMsg[] = [...limitAlerts(db, cd)]
  if (db.hh.alerts?.bills !== false) {
    for (const b of billsDueSoon(db, today)) {
      const n = diffDays(today, b.due)
      out.push({ id: `bill:${b.card.id}:${b.due}`, kind: 'alert', lvl: n === 0 ? 'neg' : 'warn', t: n === 0 ? `Fatura ${b.card.name} vence HOJE` : `Fatura ${b.card.name} vence em ${n} dia${n > 1 ? 's' : ''}`, d: brl(b.amount), to: '/dinheiro/cartoes' })
    }
  }
  if (db.hh.analyses_on !== false) {
    if (shouldShowWeekly(db.hh, today)) {
      const mon = weekStart(today)
      const spend = (db.tx || []).filter((t: any) => t.kind === 'saida' && t.date >= mon && t.date <= today)
      const msg = analysisFrom(pequenoPesa(spend, 7, 30), `week:${mon}`, 'Análise da semana')
      if (msg) out.push(msg)
    }
    if (shouldShowMonthly(db.hh, today)) {
      const mk = today.slice(0, 7)
      const msg = analysisFrom(pequenoPesa(cd.spendOuts || [], cd.dayN, cd.daysTotal), `month:${mk}`, 'Análise do mês')
      if (msg) out.push(msg)
    }
  }
  return out.filter((m) => !ignored.has(m.id))
}

export function unseenCount(db: any, today: string, key: string) {
  const seen = new Set(db.hh.inbox_seen || [])
  return inboxMessages(db, today, key).filter((m) => !seen.has(m.id)).length
}

export function goalBarLabel(v: number, g: number) {
  const p = g ? Math.round((v / g) * 100) : 0
  return `${brl(v, false)} / ${brl(g, false)} · ${p}%`
}
