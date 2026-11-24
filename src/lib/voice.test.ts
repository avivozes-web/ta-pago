import test from 'node:test'
import assert from 'node:assert/strict'
import { parseVoice, wordsToNumbers, splitClauses } from './voice.ts'
const ctx = {
  today: '2026-11-23',
  cards: [{ id: 'bb', name: 'Banco do Brasil', aliases: 'bb,banco do brasil', closing_day: 26, due_day: 5 }, { id: 'nu', name: 'Nubank', aliases: 'nubank,nu,roxinho', closing_day: 15, due_day: 22 }],
  habits: [{ id: 'h1', name: 'Devocional', kind: 'check' }, { id: 'h2', name: 'Academia', kind: 'check' }, { id: 'h3', name: 'Beber 2L de água', kind: 'check' }, { id: 'h4', name: 'Horas no celular', kind: 'phone' }],
  tasks: [{ id: 't1', name: 'Lavar banheiro' }, { id: 't2', name: 'Trocar lençóis' }],
  wish: [{ id: 'w1', name: 'Pincel de maquiagem', amount: 0, bought: false }, { id: 'w2', name: 'Perfume floral', amount: 120, bought: false }],
  income: [{ id: 'r', name: 'Reboque', aliases: '' }, { id: 'c', name: 'Curso', aliases: '' }, { id: 's', name: 'Salário Isa', aliases: '' }],
  keywords: [{ word: 'docinho', category_id: 'lan', learned: false }, { word: 'uber', category_id: 'tra', learned: false }],
}
test('números por extenso', () => {
  assert.equal(wordsToNumbers('trezentos e vinte'), '320')
  assert.equal(wordsToNumbers('quinze reais'), '15')
  assert.equal(wordsToNumbers('quinze reais e cinquenta centavos'), '15,50')
  assert.equal(wordsToNumbers('dois mil e quinhentos'), '2500')
  assert.equal(wordsToNumbers('uber dezoito nubank três vezes'), 'uber 18 nubank 3x')
  assert.equal(wordsToNumbers('uma tarefa'), 'uma tarefa')
})
test('vários comandos num áudio só', () => {
  const r = parseVoice('Gastei quinze de docinho no pix, uber 18 nubank 3x e a fatura do Nubank de dezembro tá em trezentos e vinte. Fiz devocional e academia, fiz a tarefa lavar banheiro e acrescenta a tarefa limpar geladeira toda semana. Comprei o pincel da wishlist. Entrou 200 do reboque e entrou 150 do curso', ctx)
  const k = r.map((i) => i.kind)
  assert.deepEqual(k, ['gasto', 'gasto', 'fatura', 'habito', 'habito', 'tarefa_feita', 'tarefa_nova', 'wish', 'entrada', 'entrada'], JSON.stringify(r, null, 1))
  const [g1, g2, f, h1, h2, tf, tn, w, e1, e2] = r as any[]
  assert.equal(g1.description, 'Docinho'); assert.equal(g1.amount, 15); assert.equal(g1.payment, 'pix'); assert.equal(g1.categoryId, 'lan')
  assert.equal(g2.description, 'Uber'); assert.equal(g2.amount, 18); assert.equal(g2.cardId, 'nu'); assert.equal(g2.installments, 3); assert.equal(g2.payment, 'credito')
  assert.equal(f.cardId, 'nu'); assert.equal(f.due, '2026-12-22'); assert.equal(f.amount, 320)
  assert.equal(h1.habitId, 'h1'); assert.equal(h2.habitId, 'h2'); assert.equal(tf.taskId, 't1')
  assert.equal(tn.name, 'Limpar geladeira'); assert.equal(tn.freq, 'semanal')
  assert.equal(w.wishId, 'w1'); assert.equal(w.amount, null)
  assert.equal(e1.sourceId, 'r'); assert.equal(e1.amount, 200); assert.equal(e2.sourceId, 'c'); assert.equal(e2.amount, 150)
})
test('gasto com várias partes e não entendi', () => {
  const r = parseVoice('gastei 15 de docinho e 18 de uber no débito. blablá sem sentido', ctx) as any[]
  assert.equal(r.length, 3); assert.equal(r[0].amount, 15); assert.equal(r[1].description, 'Uber'); assert.equal(r[2].kind, '?')
  const b = parseVoice('a fatura do banco do brasil pro mês de janeiro está em mil e duzentos', ctx) as any[]
  assert.equal(b[0].kind, 'fatura'); assert.equal(b[0].cardId, 'bb'); assert.equal(b[0].due, '2027-01-05'); assert.equal(b[0].amount, 1200)
  const t = parseVoice('adiciona a tarefa regar as plantas toda segunda', ctx) as any[]
  assert.equal(t[0].name, 'Regar as plantas'); assert.equal(t[0].weekday, 1)
  const m = parseVoice('comprei o perfume da wishlist e fiz beber água', ctx) as any[]
  assert.equal(m[0].wishId, 'w2'); assert.equal(m[0].amount, 120); assert.equal(m[1].habitId, 'h3')
})
test('mais jeitos de falar', () => {
  const a = parseVoice('gastei vinte e cinco reais no mercado no débito ontem', ctx) as any[]
  assert.equal(a[0].amount, 25); assert.equal(a[0].description, 'Mercado'); assert.equal(a[0].payment, 'debito'); assert.equal(a[0].date, '2026-11-22')
  const b = parseVoice('recebi 2800 do salário isa', ctx) as any[]
  assert.equal(b[0].kind, 'entrada'); assert.equal(b[0].sourceId, 's'); assert.equal(b[0].amount, 2800)
  const c = parseVoice('paguei a fatura do nubank', ctx) as any[]
  assert.equal(c[0].kind, '?')
  const d = parseVoice('fiz devocional, academia e beber água', ctx) as any[]
  assert.deepEqual(d.map((x) => x.habitId), ['h1', 'h2', 'h3'])
})
