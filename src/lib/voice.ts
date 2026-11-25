// Áudio → itens. Só regras e palavras (sem IA): separa vários comandos de uma fala e entende cada um.
import { norm, parseEntry, guessCategory, type Pay } from './parse.ts'
import { addMonthsYM, ds, monthLen, parts, MESES, billDueFor } from './cycle.ts'

export type VItem =
  | { kind: 'gasto'; text: string; description: string; amount: number | null; payment: Pay | null; cardId: string | null; installments: number; categoryId: string | null; date: string; vehicle?: 'moto' | 'carro' | null }
  | { kind: 'fatura'; text: string; cardId: string | null; due: string | null; amount: number | null }
  | { kind: 'habito'; text: string; habitId: string }
  | { kind: 'tarefa_feita'; text: string; taskId: string }
  | { kind: 'tarefa_nova'; text: string; name: string; freq: string; weekday: number | null }
  | { kind: 'wish'; text: string; wishId: string; amount: number | null }
  | { kind: 'entrada'; text: string; sourceId: string | null; description: string; amount: number | null; date: string }
  | { kind: '?'; text: string }
export interface VCtx { cards: any[]; habits: any[]; tasks: any[]; wish: any[]; income: any[]; keywords: any[]; today: string }

// ---------- números por extenso ----------
const UN: Record<string, number> = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900 }
const isNumW = (t: string) => t in UN || t === 'mil'
const MONEY = new Set(['real', 'reais', 'conto', 'contos', 'pila', 'mil'])
/** "trezentos e vinte" → 320, "quinze reais e cinquenta" → 15,50, "três vezes" → 3x */
export function wordsToNumbers(text: string) {
  const toks = norm(text).replace(/r\$\s*/g, ' ').replace(/(\d)\s*x\b/g, '$1x').split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    const looksNum = isNumW(t) && !((t === 'um' || t === 'uma') && !(MONEY.has(toks[i + 1]) || toks[i + 1] === 'e' && isNumW(toks[i + 2] || '')))
    if (!looksNum) { out.push(t); continue }
    let total = 0, cur = 0, j = i
    while (j < toks.length) {
      const w = toks[j]
      if (w === 'mil') { total += (cur || 1) * 1000; cur = 0; j++; continue }
      if (w in UN) { cur += UN[w]; j++; continue }
      if (w === 'e' && isNumW(toks[j + 1] || '')) { j++; continue }
      break
    }
    out.push(String(total + cur)); i = j - 1
  }
  let s = out.join(' ')
  s = s.replace(/\b(\d+) (?:reais|real|contos?|pila)(?: e (\d{1,2})(?: centavos?)?)?\b/g, (_m, a, c) => (c ? `${a},${c.padStart(2, '0')}` : a))
  s = s.replace(/\bparcelad[oa]s? em (\d{1,2})\b/g, '$1x')
  s = s.replace(/\b(?:em |parcelad[oa] em )?(\d{1,2}) ?(?:vezes|parcelas|x)\b/g, '$1x')
  s = s.replace(/\b(\d+) virgula (\d{1,2})\b/g, '$1,$2')
  return s
}

// ---------- parecido ----------
const STOP = new Set(['de', 'da', 'do', 'das', 'dos', 'o', 'a', 'os', 'as', 'um', 'uma', 'no', 'na', 'nos', 'nas', 'em', 'pra', 'para', 'com', 'meu', 'minha', 'e', 'que', 'ja', 'hoje', 'eu'])
const words = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w))
function lev(a: string, b: string) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length] }
const wsim = (a: string, b: string) => (a === b ? 1 : a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)) ? 0.9 : 1 - lev(a, b) / Math.max(a.length, b.length))
export function similarity(said: string, name: string) {
  const A = words(said), B = words(name); if (!A.length || !B.length) return 0
  const na = A.join(' '), nb = B.join(' ')
  if (na === nb) return 1
  if (nb.includes(na) || na.includes(nb)) return 0.92
  const hit = (xs: string[], ys: string[]) => xs.reduce((s, x) => s + Math.max(...ys.map((y) => wsim(x, y))), 0) / xs.length
  return Math.min(hit(A, B), hit(B, A)) * 0.6 + Math.max(hit(A, B), hit(B, A)) * 0.4
}
export function bestMatch<T>(said: string, list: T[], name: (x: T) => string, min = 0.62): T | null {
  let best: T | null = null, sc = min
  for (const x of list) { const s = similarity(said, name(x)); if (s > sc || (s === sc && !best && s >= min)) { best = x; sc = s } }
  return best
}

// ---------- separar a fala em comandos ----------
const TRIG = ['gastei', 'gastamos', 'paguei', 'pagamos', 'comprei', 'compramos', 'fiz', 'fizemos', 'feito', 'acrescenta', 'acrescente', 'adiciona', 'adicione', 'adicionar', 'acrescentar', 'coloca', 'coloque', 'cria', 'crie', 'entrou', 'entraram', 'recebi', 'recebemos', 'caiu', 'fatura', 'marca', 'marque']
const JOIN = new Set(['e', 'tambem', 'depois', 'ai', 'entao', 'mais', 'que'])
const hasNum = (s: string) => /\d/.test(s)
function trigOf(s: string) { const w = s.split(' ').find((x) => !JOIN.has(x) && !STOP.has(x)); return w && TRIG.includes(w) ? w : null }
export function splitClauses(text: string) {
  const n = wordsToNumbers(text.replace(/[.;!?\n]+/g, ' ¶ ').replace(/,(?!\d)/g, ' | '))
  const toks = n.split(/\s+/).filter(Boolean)
  const raw: { t: string[]; hard: boolean }[] = [{ t: [], hard: true }]
  const cur = () => raw[raw.length - 1]
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]
    if (t === '¶' || t === '|') { raw.push({ t: [], hard: t === '¶' }); continue }
    if (TRIG.includes(t) && cur().t.some((x) => !JOIN.has(x))) {
      const c = cur().t; const carry: string[] = []
      if (t === 'fatura') while (c.length && /^(a|da|de|do|na|no)$/.test(c[c.length - 1])) carry.unshift(c.pop()!)
      const content = c.filter((x) => !JOIN.has(x) && !STOP.has(x))
      if (t === 'fatura' && content.every((x) => /^(paguei|pagamos)$/.test(x))) { c.push(...carry); c.push(t); continue }
      raw.push({ t: [...carry], hard: false })
    }
    cur().t.push(t)
  }
  const cl = raw.map((r) => { const c = r.t; while (c.length && JOIN.has(c[c.length - 1])) c.pop(); while (c.length && JOIN.has(c[0])) c.shift(); return { c: c.join(' '), hard: r.hard } }).filter((r) => r.c)
  // pedaço sem verbo depois de vírgula: continua o anterior (lista de hábitos), ou é outro gasto se tiver número
  const out: string[] = []
  for (const { c, hard } of cl) {
    const prev = out[out.length - 1]
    if (!hard && !trigOf(c) && prev && !hasNum(c)) { out[out.length - 1] = `${prev} e ${c}`; continue }
    out.push(c)
  }
  // "gastei 15 de docinho e 18 de uber": dois gastos
  return out.flatMap((c) => { const tg = trigOf(c); if (tg && !/^(gast|pag|compr)/.test(tg)) return [c]; const ps = c.split(/ e (?=(?:\S+ )?\d)/); return ps.length > 1 && ps.every(hasNum) ? ps : [c] })
}

// ---------- cada comando ----------
const FREQ: [RegExp, string][] = [[/\b(todo dia|todos os dias|diaria|diariamente)\b/, 'diaria'], [/\b(a cada 15 dias|de 15 em 15( dias)?|quinzenal|quinzenalmente|a cada duas semanas)\b/, 'quinzenal'], [/\b(todo mes|todos os meses|mensal|mensalmente|uma vez por mes)\b/, 'mensal'], [/\b(toda semana|todas as semanas|semanal|semanalmente|uma vez por semana)\b/, 'semanal'], [/\b(urgente|pra hoje|ate amanha)\b/, 'urgente']]
const DIAS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']
const clean = (s: string) => s.split(' ').filter(Boolean).join(' ').replace(/^((de|da|do|o|a|os|as|um|uma|no|na|com|pra|para|em|e)\s+)+/, '').replace(/(\s+(de|da|do|no|na|com|pra|para|em|e|reais|real))+$/, '').trim()
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
function firstNum(s: string) { const m = s.match(/\b(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\b(?!x)/); if (!m) return null; let v = m[1]; if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.'); else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, ''); return Number(v) }
function cardIn(s: string, cards: any[]) {
  const al = cards.flatMap((c) => [c.name, ...(c.aliases || '').split(',')].map((a: string) => ({ id: c.id, a: norm(a).trim() })).filter((x) => x.a)).sort((a, b) => b.a.length - a.a.length)
  return al.find((x) => new RegExp(`\\b${x.a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(s)) || null
}
function monthIn(s: string, today: string) {
  const t = parts(today)
  const i = MESES.findIndex((m) => new RegExp(`\\b${norm(m)}\\b`).test(s))
  if (i >= 0) { const y = i + 1 < t.m - 1 ? t.y + 1 : t.y; return { y, m: i + 1 } }
  if (/\b(mes que vem|proximo mes)\b/.test(s)) return addMonthsYM(t.y, t.m, 1)
  if (/\b(esse mes|este mes)\b/.test(s)) return { y: t.y, m: t.m }
  return null
}

const ESC = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const isMoneyTok = (t: string) => /^(?:\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)$/.test(t)
function trailSet(cards: any[]) {
  const s = new Set(['pix', 'dinheiro', 'din', 'especie', 'cash', 'debito', 'deb', 'credito', 'cred', 'cartao', 'hoje', 'ontem', 'anteontem', 'no', 'na', 'nos', 'nas', 'do', 'da', 'de', 'em', 'reais', 'real'])
  for (const c of cards) for (const a of [c.name, ...(c.aliases || '').split(',')]) { const n = norm(a).trim(); if (n) s.add(n) }
  return s
}
function isTrailTok(t: string, trails: Set<string>, cards: any[]) {
  if (trails.has(t) || /^\d{1,2}x$/.test(t) || /^\d{1,2}\/\d{1,2}$/.test(t)) return true
  // multi-word card aliases are handled in parseEntry; single tokens already in trails
  void cards
  return false
}
function pickAct(said: string, x: VCtx): VItem | null {
  const h = bestMatch(said, x.habits.filter((k: any) => k.kind !== 'phone'), (k: any) => k.name, 0.62)
  if (h) return { kind: 'habito', text: said, habitId: h.id }
  const t = bestMatch(said, x.tasks, (k: any) => k.name, 0.55)
  if (t) return { kind: 'tarefa_feita', text: t.name, taskId: t.id }
  return null
}
/** Tira hábitos/tarefas ditos com "fui", "feito", etc. Devolve o texto que sobra. */
export function extractExplicitActs(s: string, x: VCtx): { items: VItem[]; rest: string } {
  const items: VItem[] = []
  let work = ` ${norm(s)} `
  const named = [
    ...x.habits.filter((h: any) => h.kind !== 'phone').map((h: any) => ({ kind: 'habito' as const, id: h.id, name: h.name })),
    ...x.tasks.map((t: any) => ({ kind: 'tarefa_feita' as const, id: t.id, name: t.name })),
  ].sort((a, b) => norm(b.name).length - norm(a.name).length)
  for (const it of named) {
    const n = norm(it.name); if (n.length < 3) continue
    const re = new RegExp(`(?:\\b(?:fui|foi|fomos|fiz|fizemos|feito|feita|feitos|feitas)(?:\\s+(?:na|no|nas|nos|pra|para|a|ao|o|os))?\\s+${ESC(n)}\\b|\\b${ESC(n)}\\s+(?:feito|feita|feitos|feitas)\\b)`)
    if (re.test(work)) {
      items.push(it.kind === 'habito' ? { kind: 'habito', text: it.name, habitId: it.id } : { kind: 'tarefa_feita', text: it.name, taskId: it.id })
      work = work.replace(re, ' ')
    }
  }
  const tail = work.match(/(.+?)\s+\b(feitos|feitas|feito|feita)\b/)
  if (tail) {
    for (const part of tail[1].split(/\s+e\s+|,/)) {
      const p = pickAct(clean(part), x)
      if (p) { items.push(p); work = work.replace(part.trim(), ' ') }
    }
    work = work.replace(/\b(feitos|feitas|feito|feita)\b/g, ' ')
  }
  return { items, rest: work.replace(/\s+/g, ' ').trim() }
}
function leftoversActs(s: string, x: VCtx): VItem[] {
  const items: VItem[] = []
  let work = ` ${norm(s)} `
  const named = [
    ...x.habits.filter((h: any) => h.kind !== 'phone').map((h: any) => ({ kind: 'habito' as const, id: h.id, name: h.name })),
    ...x.tasks.map((t: any) => ({ kind: 'tarefa_feita' as const, id: t.id, name: t.name })),
  ].sort((a, b) => norm(b.name).length - norm(a.name).length)
  for (const it of named) {
    const n = norm(it.name); if (n.length < 3) continue
    const re = new RegExp(`\\b${ESC(n)}\\b`)
    if (re.test(work)) {
      items.push(it.kind === 'habito' ? { kind: 'habito', text: it.name, habitId: it.id } : { kind: 'tarefa_feita', text: it.name, taskId: it.id })
      work = work.replace(re, ' ')
    }
  }
  // o que sobrou, tentando por pedaços ("lavei o banheiro")
  for (const part of work.split(/\s+e\s+|,/).map(clean).filter((p) => p && !/^\d/.test(p) && p.length >= 4)) {
    if (STOP.has(part)) continue
    const p = pickAct(part, x)
    if (p && !items.some((i) => JSON.stringify(i) === JSON.stringify(p))) items.push(p)
  }
  return items
}
function gastoFrom(seg: string, x: VCtx, parcelado: boolean): VItem[] {
  const p = parseEntry(seg.replace(/\b(cartao|cartão) (do|da|de)\b/g, 'cartao'), x.cards.map((k) => ({ id: k.id, name: k.name, aliases: k.aliases || '' })), x.today)
  const desc = cap(clean(norm(p.description).replace(/\b(reais|real|gastei|paguei|comprei|hoje|comi|tomei|pedi)\b/g, ' ')))
  if (p.amount == null) return []
  const g = desc ? guessCategory(desc, x.keywords) : null
  const item: VItem = { kind: 'gasto', text: seg, description: desc, amount: p.amount, payment: p.payment, cardId: p.cardId, installments: p.installments, categoryId: g?.category_id || null, date: p.date || x.today }
  if (item.kind === 'gasto' && item.installments > 1 && !item.cardId && !parcelado) {
    const n = item.installments
    return Array.from({ length: n }, () => ({ ...item, installments: 1, payment: item.payment === 'credito' ? null : item.payment }))
  }
  return [item]
}
function splitExpenseSegs(s: string, x: VCtx): { segs: { text: string; qty: number }[]; rest: string } {
  let work = s
  const segs: { text: string; qty: number }[] = []
  // "3 ubers de 18" / "3 uber de 18"
  work = work.replace(/(?:^|\s)(\d{1,2})\s+([a-z0-9à-ú][a-z0-9à-ú\s]*?)\s+de\s+(\d+(?:[.,]\d{1,2})?)(?=\s|$)/gi, (_m, q, name, amt) => {
    let n = clean(name); if (n.length > 3 && /s$/i.test(n)) n = n.slice(0, -1)
    segs.push({ text: `${n} ${amt}`, qty: Math.max(1, Number(q)) })
    return ' '
  })
  const trails = trailSet(x.cards)
  const toks = work.split(/\s+/).filter(Boolean)
  const buf: string[] = []
  let seenNum = false, descBefore = false
  const flush = () => { if (buf.length) { segs.push({ text: buf.join(' '), qty: 1 }); buf.length = 0 } ; seenNum = false; descBefore = false }
  const nonTrail = (t: string) => !isTrailTok(t, trails, x.cards) && !isMoneyTok(t) && !/^\d{1,2}x$/.test(t)
  for (const raw of toks) {
    const t = norm(raw)
    if (isMoneyTok(t) && !/^\d{1,2}x$/.test(t)) {
      if (seenNum) flush()
      descBefore = buf.some((w) => nonTrail(norm(w)))
      seenNum = true
      buf.push(raw)
      continue
    }
    if (seenNum && descBefore && nonTrail(t)) flush()
    buf.push(raw)
  }
  flush()
  return { segs, rest: '' }
}
/** Separa uma frase solta em vários gastos + hábitos/tarefas, sem precisar de pontuação. */
export function parseMixed(s: string, x: VCtx): VItem[] {
  const parcelado = /\bparcelad/.test(norm(s))
  const { items: acts, rest } = extractExplicitActs(s, x)
  const { segs } = splitExpenseSegs(rest, x)
  const expenses: VItem[] = []
  const used: string[] = []
  for (const seg of segs) {
    const got = gastoFrom(seg.text, x, parcelado)
    if (!got.length) continue
    used.push(norm(seg.text))
    if (seg.qty > 1) {
      for (const g of got) {
        if (g.kind !== 'gasto') continue
        for (let i = 0; i < seg.qty; i++) expenses.push({ ...g, installments: 1 })
      }
    } else expenses.push(...got)
  }
  // tira do resto as palavras já usadas nos gastos, e procura hábitos que sobraram
  let leftover = rest
  for (const u of used) leftover = leftover.replace(u, ' ')
  const more = leftoversActs(leftover, x)
  return [...expenses, ...acts, ...more]
}

export function parseClause(c: string, x: VCtx): VItem[] {
  const tg = trigOf(c)
  const body = (w: string) => c.replace(new RegExp(`^.*?\\b${w}\\b\\s*`), '')
  // fatura do cartão
  if (/\bfatura\b/.test(c) && /^(paguei|pagamos)$/.test(tg || '')) return [{ kind: '?', text: c }]
  if (/\bfatura\b/.test(c)) {
    const card = cardIn(c, x.cards); const mo = monthIn(c, x.today); const amount = firstNum(c.replace(/\b\d{1,2}\/\d{1,2}\b/g, ''))
    const cd = card ? x.cards.find((k) => k.id === card.id) : null
    const due = cd ? (mo ? ds(mo.y, mo.m, Math.min(cd.due_day, monthLen(mo.y, mo.m))) : billDueFor(x.today, cd.closing_day, cd.due_day)) : null
    return [{ kind: 'fatura', text: c, cardId: card?.id || null, due, amount }]
  }
  // nova tarefa
  if (/\btarefa\b/.test(c) && /^(acrescenta|acrescente|adiciona|adicione|adicionar|acrescentar|coloca|coloque|cria|crie)$/.test(tg || '')) {
    let rest = body('tarefa'); let freq = 'semanal'; let weekday: number | null = null
    for (const [re, f] of FREQ) if (re.test(rest)) { freq = f; rest = rest.replace(re, ' '); break }
    const d = DIAS.findIndex((w) => new RegExp(`\\b(toda |todo |na |no |as |aos )?${w}( feira)?s?\\b`).test(rest))
    if (d >= 0) { weekday = d; if (freq !== 'quinzenal' && freq !== 'mensal') freq = 'semanal'; rest = rest.replace(new RegExp(`\\b(toda |todo |na |no |as |aos )?${DIAS[d]}( feira)?s?\\b`), ' ') }
    rest = clean(rest.replace(/\b(pra mim|para mim|la|nas tarefas|na lista)\b/g, ' '))
    return rest ? [{ kind: 'tarefa_nova', text: c, name: cap(rest), freq, weekday }] : [{ kind: '?', text: c }]
  }
  // tarefa feita
  if (/\btarefa\b/.test(c) && (tg === 'fiz' || tg === 'fizemos' || tg === 'feito' || tg === 'marca' || tg === 'marque')) {
    return clean(body('tarefas?').replace(/\bfeita\b/, '')).split(/ e /).map((p) => { const t = bestMatch(p, x.tasks, (k: any) => k.name, 0.55); return t ? { kind: 'tarefa_feita', text: p, taskId: t.id } as VItem : { kind: '?', text: c } as VItem })
  }
  // hábitos (ou tarefas) feitos hoje
  if (tg === 'fiz' || tg === 'fizemos' || tg === 'feito' || tg === 'marca' || tg === 'marque') {
    const rest = body(tg).replace(/\b(os? habitos?|hoje|o habito|de hoje|ja)\b/g, ' ')
    return rest.split(/ e |,/).map((p) => clean(p)).filter(Boolean).map((p) => {
      const h = bestMatch(p, x.habits.filter((k: any) => k.kind !== 'phone'), (k: any) => k.name)
      if (h) return { kind: 'habito', text: p, habitId: h.id } as VItem
      const t = bestMatch(p, x.tasks, (k: any) => k.name)
      return t ? { kind: 'tarefa_feita', text: p, taskId: t.id } as VItem : { kind: '?', text: `fiz ${p}` } as VItem
    })
  }
  // entrada
  if (/^(entrou|entraram|recebi|recebemos|caiu)$/.test(tg || '')) {
    const rest = body(tg!); const amount = firstNum(rest)
    const words0 = clean(rest.replace(/\b\d[\d.,]*\b/g, ' ').replace(/\b(hoje|na conta|no pix|pix|dinheiro|o|a|valor|de|do|da)\b/g, ' '))
    const src = bestMatch(words0, x.income, (s: any) => [s.name, s.aliases].filter(Boolean).join(' '), 0.55) || x.income.find((s: any) => (s.aliases || '').split(',').map(norm).filter(Boolean).some((a: string) => words0.includes(a)))
    const pe = parseEntry(rest, [], x.today)
    return [{ kind: 'entrada', text: c, sourceId: src?.id || null, description: src?.name || cap(words0) || 'Entrada', amount, date: pe.date || x.today }]
  }
  // comprei da wishlist
  if (/^(comprei|compramos)$/.test(tg || '') && (/\b(wishlist|wish list|lista de desejos?|desejos?)\b/.test(c) || !hasNum(c))) {
    const rest = clean(body(tg!).replace(/\b(da|na|minha|wish list|wishlist|lista de desejos?|desejos?)\b/g, ' ').replace(/\b\d[\d.,]*\b/g, ' '))
    const w = bestMatch(rest, x.wish.filter((k: any) => !k.bought), (k: any) => k.name, 0.5)
    if (w) return [{ kind: 'wish', text: c, wishId: w.id, amount: firstNum(c) ?? (Number(w.amount) > 0 ? Number(w.amount) : null) }]
    if (!hasNum(c)) return [{ kind: '?', text: c }]
  }
  // gasto (um ou vários) + hábitos/tarefas ditos na mesma frase
  if (hasNum(c) || /^(gastei|gastamos|paguei|pagamos|comprei|compramos)$/.test(tg || '')) {
    const rest = tg ? body(tg) : c
    const mixed = parseMixed(rest, x)
    if (mixed.length) return mixed
    return [{ kind: '?', text: c }]
  }
  const onlyActs = parseMixed(c, x)
  if (onlyActs.length) return onlyActs
  return [{ kind: '?', text: c }]
}
export function parseVoice(text: string, x: VCtx): VItem[] { return splitClauses(text).flatMap((c) => parseClause(c, x)) }
