import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEntry, guessCategory, learnWord } from './parse.ts'
const cards = [{ id: 'bb', name: 'Banco do Brasil', aliases: 'bb,brasil,banco do brasil' }, { id: 'nu', name: 'Nubank', aliases: 'nubank,nu' }]
test('docinho 2 pix', () => {
  const p = parseEntry('docinho 2 pix', cards, '2026-11-26')
  assert.equal(p.description, 'Docinho'); assert.equal(p.amount, 2); assert.equal(p.payment, 'pix'); assert.equal(p.cardId, null)
})
test('uber 18 nubank 3x', () => {
  const p = parseEntry('uber 18 nubank 3x', cards, '2026-11-26')
  assert.equal(p.description, 'Uber'); assert.equal(p.amount, 18); assert.equal(p.payment, 'credito'); assert.equal(p.cardId, 'nu'); assert.equal(p.installments, 3)
})
test('valores com vírgula e milhar', () => {
  assert.equal(parseEntry('tênis 189,90 3x', cards, '2026-11-26').amount, 189.9)
  assert.equal(parseEntry('mercado 1.180,50 banco do brasil', cards, '2026-11-26').cardId, 'bb')
  assert.equal(parseEntry('mercado 1.180,50', cards, '2026-11-26').amount, 1180.5)
  assert.equal(parseEntry('açaí 25 ontem', cards, '2026-11-26').date, '2026-11-25')
})
test('categoria por palavra', () => {
  const kw = [{ word: 'docinho', category_id: 'lan', learned: false }, { word: 'pizza', category_id: 'laz', learned: false }]
  assert.equal(guessCategory('Docinho', kw)?.category_id, 'lan')
  assert.equal(guessCategory('Nada', kw), null)
  assert.equal(learnWord('Tênis da academia'), 'tenis')
})
