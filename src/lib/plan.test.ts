import test from 'node:test'
import assert from 'node:assert/strict'
import { setCycleStarts } from './cycle.ts'
import { isFuelCat, isFuelText, needsVehicle, fixedInCycle } from './calc.ts'
import { pmt, installmentOf, incomeOf, committedOf, analyzeBuy, verdictText, leftoverAfterLiveEnjoy, projection, parseMonthGoal, monthGoalDone, r2 } from './plan.ts'

test('Gasolina e Combustível são categoria de combustível', () => {
  assert.equal(isFuelCat({ name: 'Gasolina' }), true)
  assert.equal(isFuelCat({ name: 'gasolina' }), true)
  assert.equal(isFuelCat({ name: 'Combustível' }), true)
  assert.equal(isFuelCat({ name: 'COMBUSTIVEL' }), true)
  assert.equal(isFuelCat({ name: 'Uber' }), false)
  assert.equal(isFuelCat({ name: 'Transporte' }), false)
})
test('palavras gasolina/combustível/abastecer/posto pedem moto ou carro', () => {
  assert.equal(isFuelText('gasolina 50'), true)
  assert.equal(isFuelText('Gasolina'), true)
  assert.equal(isFuelText('abastecer no posto'), true)
  assert.equal(isFuelText('Combustível 80'), true)
  assert.equal(isFuelText('combustivel'), true)
  assert.equal(isFuelText('uber 18'), false)
  assert.equal(isFuelText('imposto 200'), false)
  assert.equal(isFuelText('depósito'), false)
  const transporte = { name: 'Transporte' }
  assert.equal(needsVehicle(transporte, 'gasolina 50'), true)
  assert.equal(needsVehicle(transporte, 'uber 18'), false)
  assert.equal(needsVehicle({ name: 'Gasolina' }, 'qualquer coisa'), true)
})

test('fixo só deste mês aparece só naquele ciclo', () => {
  const list = [
    { id: 'a', name: 'Aluguel', amount: 1000 },
    { id: 'b', name: 'Material escolar', amount: 200, only_cycle: '2026-12' },
  ]
  assert.deepEqual(fixedInCycle(list, '2026-11').map((f: any) => f.id), ['a'])
  assert.deepEqual(fixedInCycle(list, '2026-12').map((f: any) => f.id), ['a', 'b'])
})

test('parcela com 3% ao mês (Não sei) usa juros Price', () => {
  const inst = pmt(1000, 0.03, 3)
  assert.equal(inst, 353.53)
  const x = installmentOf(1000, 3, 'nao_sei', undefined, 3)
  assert.equal(x.n, 3)
  assert.equal(x.inst, 353.53)
  assert.ok(x.juros > 0)
  const y = installmentOf(1000, 3, 'nao', undefined, 3)
  assert.equal(y.total, 1000)
  assert.equal(y.juros, 0)
  const z = installmentOf(900, 3, 'sim', 350, 3)
  assert.equal(z.inst, 350)
  assert.equal(z.total, 1050)
  assert.equal(z.juros, 150)
})

function db(over: any = {}) {
  const hh = { cycle_start_day: 15, cycle_naming: 'start', buy_rule_pct: 90, buy_interest_pct: 3, ...(over.hh || {}) }
  return {
    hh,
    categories: over.categories || [
      { id: 'c1', name: 'Mercado', macro: 'viver' },
      { id: 'c2', name: 'Lazer', macro: 'curtir' },
      { id: 'c3', name: 'Guardar', macro: 'crescer', is_invest: true },
    ],
    income: over.income || [{ id: 's1', name: 'Salário', is_salary: true, expected_amount: 5000, rates: [{ from: '2026-01', amount: 5000 }] }],
    fixed: over.fixed || [{ id: 'f1', name: 'Aluguel', amount: 1500, category_id: 'c1' }],
    fixedPaid: over.fixedPaid || [],
    tx: over.tx || [],
    manualBills: over.manualBills || [],
    cards: over.cards || [],
    loans: over.loans || [],
    overdraft: over.overdraft || [],
    investGoals: over.investGoals || [],
  }
}

test('comprometido do ciclo inclui fixo do mês e não o de outro mês', () => {
  setCycleStarts({})
  const d = db({
    fixed: [
      { id: 'f1', name: 'Aluguel', amount: 1500, category_id: 'c1' },
      { id: 'f2', name: 'Material', amount: 400, category_id: 'c1', only_cycle: '2026-12' },
    ],
  })
  const nov = committedOf(d, '2026-11', '2026-11-20')
  const dez = committedOf(d, '2026-12', '2026-11-20')
  assert.equal(nov.income, 5000)
  assert.equal(nov.fixos, 1500)
  assert.equal(dez.fixos, 1900)
})

test('regra dos 90%: parcela que estoura vira “eu não compraria agora”', () => {
  setCycleStarts({})
  // 1500 fixos. Sem dia a dia. 90% de 5000 = 4500. Folga 3000.
  const d = db()
  const ok = analyzeBuy(d, '2026-11-20', { name: 'Fone', amount: 200, pay: 'vista', n: 1, interest: 'nao' })
  assert.equal(verdictText(ok), 'Pode comprar, se fizer sentido para você.')
  assert.equal(ok.ok, true)
  const no = analyzeBuy(d, '2026-11-20', { name: 'Celular', amount: 4000, pay: 'vista', n: 1, interest: 'nao' })
  assert.equal(no.ok, false)
  assert.equal(verdictText(no), 'Eu não compraria agora.')
  // parcelado 3x sem juros: 4000/3 ≈ 1333, total comprometido 1500+1333=2833 < 4500, cabe
  const par = analyzeBuy(d, '2026-11-20', { name: 'Celular', amount: 4000, pay: 'parcelado', n: 3, interest: 'nao' })
  assert.equal(par.ok, true)
  assert.ok(par.hit.inst < 1400)
})

test('só recomenda guardar quando sobra depois de Viver e Curtir', () => {
  setCycleStarts({})
  const folga = leftoverAfterLiveEnjoy(db(), '2026-11', '2026-11-20')
  assert.ok(folga.leftover > 0)
  const apertado = leftoverAfterLiveEnjoy(db({
    income: [{ id: 's1', name: 'Salário', is_salary: true, expected_amount: 1400, rates: [{ from: '2026-01', amount: 1400 }] }],
  }), '2026-11', '2026-11-20')
  assert.ok(apertado.leftover <= 0)
  const p1 = projection(db(), '2026-11', '2026-11-20', 3)
  assert.equal(p1.canRecommend, true)
  assert.ok(p1.recommended > 0)
  const p2 = projection(db({
    income: [{ id: 's1', name: 'Salário', is_salary: true, expected_amount: 1400, rates: [{ from: '2026-01', amount: 1400 }] }],
  }), '2026-11', '2026-11-20', 3)
  assert.equal(p2.canRecommend, false)
  assert.equal(p2.recommended, 0)
})

test('meta do mês “guardar R$800” fecha sozinha quando o ciclo já guardou isso', () => {
  const p = parseMonthGoal('Guardar R$ 800 em novembro')
  assert.equal(p.kind, 'guardar')
  assert.equal(p.target, 800)
  const d = db({
    tx: [{ kind: 'saida', amount: 800, date: '2026-11-20', invest_goal_id: 'g1', category_id: 'c3', payment: 'pix' }],
    investGoals: [{ id: 'g1', name: 'Reserva', target: 6000, start_amount: 0 }],
  })
  const auto = monthGoalDone({ name: 'Guardar R$ 800 em novembro', kind: 'guardar', target: 800, done_manual: false, skipped: false }, d, '2026-11')
  assert.equal(auto.done, true)
  assert.equal(auto.auto, true)
  const no = monthGoalDone({ name: 'Guardar R$ 800 em novembro', kind: 'guardar', target: 800, done_manual: false, skipped: false }, db(), '2026-11')
  assert.equal(no.done, false)
  const manual = monthGoalDone({ name: 'Caminhar 10 dias', kind: 'livre', done_manual: true }, db(), '2026-11')
  assert.equal(manual.done, true)
})

test('r2 arredonda para centavos', () => {
  assert.equal(r2(1.225), 1.23)
  assert.equal(incomeOf(db(), '2026-11'), 5000)
})
