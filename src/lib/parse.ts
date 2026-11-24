// Lê "docinho 2 pix", "uber 18 nubank 3x". Só regras e palavras, sem IA.
export type Pay = 'dinheiro' | 'pix' | 'debito' | 'credito'
export interface CardLite { id: string; name: string; aliases: string }
export interface Parsed { description: string; amount: number | null; installments: number; payment: Pay | null; cardId: string | null; date: string | null; words: string[] }
export function norm(s: string) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() }
const PAY: Record<string, Pay> = { pix: 'pix', dinheiro: 'dinheiro', din: 'dinheiro', especie: 'dinheiro', cash: 'dinheiro', debito: 'debito', deb: 'debito', credito: 'credito', cred: 'credito', cartao: 'credito' }
function toNumber(t: string) {
  let s = t.replace(/^r\$/, '')
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+([.,]\d{1,2})?$/.test(s)) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  const n = Number(s); return Number.isFinite(n) ? n : null
}
export function parseEntry(text: string, cards: CardLite[], today: string): Parsed {
  const raw = text.trim().split(/\s+/).filter(Boolean)
  const desc: string[] = []; let amount: number | null = null; let inst = 1; let payment: Pay | null = null; let cardId: string | null = null; let date: string | null = null
  const aliasList = cards.flatMap((c) => [c.name, ...c.aliases.split(',')].map((a) => ({ id: c.id, a: norm(a) })).filter((x) => x.a))
  for (let i = 0; i < raw.length; i++) {
    const t = norm(raw[i]); const two = i + 1 < raw.length ? `${t} ${norm(raw[i + 1])}` : ''
    const x = t.match(/^(\d{1,2})x$/) || (t === 'em' && two.match(/^em (\d{1,2})x$/))
    if (x) { inst = Math.max(1, Number(x[1])); if (t === 'em') i++; continue }
    const three = i + 2 < raw.length ? `${two} ${norm(raw[i + 2])}` : ''
    const c3 = aliasList.find((c) => c.a.includes(' ') && (c.a === three || c.a === two))
    if (c3) { cardId = c3.id; i += c3.a.split(' ').length - 1; continue }
    const c1 = aliasList.find((c) => c.a === t)
    if (c1) { cardId = c1.id; continue }
    if (PAY[t]) { payment = PAY[t]; continue }
    if (t === 'no' || t === 'na' || t === 'de' && amount !== null && i === raw.length - 1) continue
    if (t === 'hoje') { date = today; continue }
    if (t === 'ontem') { date = shift(today, -1); continue }
    if (t === 'anteontem') { date = shift(today, -2); continue }
    const dm = t.match(/^(\d{1,2})\/(\d{1,2})$/)
    if (dm) { date = `${today.slice(0, 4)}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`; continue }
    const n = amount === null ? toNumber(t) : null
    if (n !== null) { amount = n; continue }
    desc.push(raw[i])
  }
  if ((cardId || inst > 1) && !payment) payment = 'credito'
  const d = desc.join(' ').replace(/\s+(no|na|de|com)$/i, '')
  const description = d ? d.charAt(0).toUpperCase() + d.slice(1) : ''
  return { description, amount, installments: inst, payment, cardId, date, words: desc.map(norm).filter((w) => w.length > 1) }
}
function shift(s: string, n: number) { const [y, m, d] = s.split('-').map(Number); const t = new Date(y, m - 1, d + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
/** Acha a categoria pelas palavras aprendidas (a mais longa ganha; aprendidas vencem as iniciais). */
export function guessCategory(description: string, keywords: { word: string; category_id: string; learned: boolean }[]) {
  const text = ` ${norm(description)} `
  const hits = keywords.filter((k) => text.includes(` ${k.word} `) || (k.word.length >= 4 && text.includes(k.word)))
  hits.sort((a, b) => Number(b.learned) - Number(a.learned) || b.word.length - a.word.length)
  return hits[0] || null
}
/** Palavra que o app aprende quando ela corrige a categoria: a primeira palavra "de verdade" da descrição. */
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'pra', 'para', 'com', 'no', 'na', 'e', 'o', 'a', 'um', 'uma'])
export function learnWord(description: string) { return norm(description).split(/\s+/).find((w) => w.length > 2 && !STOP.has(w) && !/^\d/.test(w)) || null }
