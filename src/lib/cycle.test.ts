import test from 'node:test'
import assert from 'node:assert/strict'
import { cycleKeyOf, cycleName, cycleRange, billCycleKey, billDueFor, splitInstallments, installmentDues } from './cycle.ts'
test('ciclo 15→14 com nome do mês em que começa', () => {
  assert.equal(cycleKeyOf('2026-11-15', 15), '2026-11')
  assert.equal(cycleKeyOf('2026-12-14', 15), '2026-11')
  assert.equal(cycleKeyOf('2026-12-15', 15), '2026-12')
  assert.equal(cycleName('2026-11', 'start'), 'Novembro')
  assert.deepEqual(cycleRange('2026-11', 15), { start: '2026-11-15', end: '2026-12-14' })
  assert.deepEqual(cycleRange('2026-12', 15), { start: '2026-12-15', end: '2027-01-14' })
})
test('fatura entra no ciclo do mês em que vence', () => {
  assert.equal(billCycleKey('2026-12-05', 'start'), '2026-12')
  assert.equal(cycleName(billCycleKey('2026-12-05', 'start'), 'start'), 'Dezembro')
  assert.equal(billCycleKey('2026-12-22', 'start'), '2026-12')
})
test('vencimento por cartão', () => {
  assert.equal(billDueFor('2026-11-26', 26, 5), '2026-12-05') // BB
  assert.equal(billDueFor('2026-11-27', 26, 5), '2027-01-05')
  assert.equal(billDueFor('2026-11-10', 15, 22), '2026-11-22') // Nubank
  assert.equal(billDueFor('2026-11-16', 15, 22), '2026-12-22')
  assert.equal(billDueFor('2026-11-16', 16, 21), '2026-11-21') // Afinz
})
test('parcelas', () => {
  assert.deepEqual(splitInstallments(100, 3), [33.34, 33.33, 33.33])
  assert.deepEqual(installmentDues('2026-11-27', 26, 5, 3), ['2027-01-05', '2027-02-05', '2027-03-05'])
})
test('mês novo começa antes quando recebe antes', async () => {
  const { setCycleStarts } = await import('./cycle.ts')
  setCycleStarts({ '2026-12': '2026-12-10' })
  assert.equal(cycleKeyOf('2026-12-09', 15), '2026-11')
  assert.equal(cycleKeyOf('2026-12-10', 15), '2026-12')
  assert.equal(cycleKeyOf('2026-12-14', 15), '2026-12')
  assert.deepEqual(cycleRange('2026-11', 15), { start: '2026-11-15', end: '2026-12-09' })
  assert.deepEqual(cycleRange('2026-12', 15), { start: '2026-12-10', end: '2027-01-14' })
  assert.equal(billCycleKey('2026-12-05', 'start'), '2026-12')
  setCycleStarts({})
  assert.equal(cycleKeyOf('2026-12-10', 15), '2026-11')
})
