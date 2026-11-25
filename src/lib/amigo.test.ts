import test from 'node:test'
import assert from 'node:assert/strict'
import { isPaused, inPause, resumePatch, dayStat } from './habit.ts'
import { greeting, loggingStreak, pequenoPesa, pesaLine, healthScore, shouldShowWeekly, shouldShowMonthly, weekStart, limitAlerts, goalBarLabel } from './amigo.ts'

test('saudação muda com a hora e some sem apelido', () => {
  assert.equal(greeting('Isa', '08:00'), 'Bom dia, Isa!')
  assert.equal(greeting('Isa', '14:30'), 'Boa tarde, Isa!')
  assert.equal(greeting('Isa', '19:00'), 'Boa noite, Isa!')
  assert.equal(greeting('Isa', '03:00'), 'Boa noite, Isa!')
  assert.equal(greeting('', '08:00'), '')
  assert.equal(greeting(null, '08:00'), '')
})

test('pausa cobre o intervalo e retomar hoje termina ontem', () => {
  assert.equal(inPause('2026-11-20', '2026-11-25', '2026-11-22'), true)
  assert.equal(inPause('2026-11-20', '2026-11-25', '2026-11-26'), false)
  assert.equal(inPause('2026-11-20', null, '2026-12-01'), true)
  assert.equal(inPause('2026-11-20', null, '2026-11-19'), false)
  const h = { paused_from: '2026-11-20', paused_until: null }
  const hh = { habits_paused_from: '2026-11-10', habits_paused_until: '2026-11-12' }
  assert.equal(isPaused(h, '2026-11-22', hh), true)
  assert.equal(isPaused({ }, '2026-11-11', hh), true)
  assert.equal(isPaused({ }, '2026-11-13', hh), false)
  assert.deepEqual(resumePatch('2026-11-25', '2026-11-25'), { paused_from: null, paused_until: null })
  assert.deepEqual(resumePatch('2026-11-20', '2026-11-25'), { paused_until: '2026-11-24' })
})

test('dia pausado não quebra a sequência e não entra na constância', () => {
  const habits = [{ id: 'a', in_grid: true, days: [0, 1, 2, 3, 4, 5, 6], kind: 'check', created_at: '2026-01-01' }]
  const logs = [{ habit_id: 'a', day: '2026-11-23', done: true }, { habit_id: 'a', day: '2026-11-24', done: true }]
  const hh = {}
  assert.deepEqual(dayStat(habits, logs, '2026-11-23', '2026-11-25', hh), { s: 1, n: 1 })
  const paused = { ...habits[0], paused_from: '2026-11-24', paused_until: '2026-11-24' }
  assert.deepEqual(dayStat([paused], logs, '2026-11-24', '2026-11-25', hh), { s: 0, n: 0 })
  // 24 pausado (pct nulo), 23 feito: sequência segue
  const pct = (d: string, list: any[]) => { const x = dayStat(list, logs, d, '2026-11-25', hh); return x.s ? x.n / x.s : null }
  assert.equal(pct('2026-11-24', [paused]), null)
  assert.equal(pct('2026-11-23', [paused]), 1)
})

test('o pequeno pesa no ano: docinhos R$12 × 9 = R$108/mês, R$1.296/ano', () => {
  const spend = Array.from({ length: 9 }, (_, i) => ({ description: 'docinhos', amount: 12, date: `2026-11-${String(i + 1).padStart(2, '0')}` }))
  const [p] = pequenoPesa(spend, 30, 30)
  assert.equal(p.n, 9)
  assert.equal(p.unit, 12)
  assert.equal(p.month, 108)
  assert.equal(p.year, 1296)
  assert.ok(pesaLine(p).includes('1.296'))
})

test('dias seguidos lançando e nota de 0 a 100', () => {
  const db = { tx: [
    { kind: 'saida', date: '2026-11-23', amount: 10 },
    { kind: 'saida', date: '2026-11-24', amount: 10 },
    { kind: 'saida', date: '2026-11-25', amount: 10 },
  ], cards: [], investGoals: [], hh: { cycle_start_day: 15, cycle_naming: 'end' }, categories: [] }
  assert.equal(loggingStreak(db, '2026-11-25'), 3)
  assert.equal(loggingStreak(db, '2026-11-26'), 3) // hoje vazio, conta a partir de ontem
  const hi = healthScore(db, { key: '2026-11', cap: 1000, isCurrent: true, daysTotal: 30, dayN: 15, saidas: 400, saldo: 200, bills: [] })
  assert.ok(hi.score >= 0 && hi.score <= 100)
  assert.equal(hi.pace, 40) // 40% do teto em 50% do ciclo
  const over = healthScore(db, { key: '2026-11', cap: 1000, isCurrent: true, daysTotal: 30, dayN: 10, saidas: 1100, saldo: -100, bills: [] })
  assert.ok(over.score < hi.score)
})

test('análises só no dia escolhido e com o interruptor ligado', () => {
  assert.equal(weekStart('2026-11-25'), '2026-11-23') // quarta
  const hh = { analyses_on: true, analyses_weekly: true, analyses_weekly_dow: 3, analyses_monthly: true, analyses_monthly_day: 25 }
  assert.equal(shouldShowWeekly(hh, '2026-11-24'), false) // terça, antes de quarta
  assert.equal(shouldShowWeekly(hh, '2026-11-25'), true)
  assert.equal(shouldShowMonthly(hh, '2026-11-24'), false)
  assert.equal(shouldShowMonthly(hh, '2026-11-25'), true)
  assert.equal(shouldShowWeekly({ ...hh, analyses_on: false }, '2026-11-25'), false)
})

test('alerta de limite a 95% e barra R$ X / R$ Y · %', () => {
  const db = { hh: { alerts: {} }, categories: [{ id: 'c', name: 'Delivery', goal: 100 }], cards: [] }
  const a = limitAlerts(db, { key: '2026-11', byCat: { c: 95 }, daysLeft: 4, bills: [], leisureCount: 0, cap: 0, isCurrent: true, saidas: 0, dayN: 1, daysTotal: 30 })
  assert.equal(a[0].t, '95% do limite de Delivery')
  assert.equal(goalBarLabel(95, 100), 'R$ 95 / R$ 100 · 95%')
})
