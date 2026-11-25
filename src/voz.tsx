import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from './data'
import { Icon } from './icons'
import { Sheet, useForm, Ic, catIcon } from './ui'
import { parseVoice, splitClauses, parseClause, type VItem } from './lib/voice'
import { installmentDues, splitInstallments, dow, parts, addDays, cycleName, billCycleKey } from './lib/cycle'
import { brl, ddmm, PAY_LABEL } from './lib/fmt'
import { sb } from './lib/sb'
import { occurs } from './pages/Tarefas'
import { isFuelCat } from './lib/calc'

const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null
const FQ: Record<string, string> = { diaria: 'Todo dia', semanal: 'Toda semana', quinzenal: 'A cada 15 dias', mensal: 'Todo mês', urgente: 'Urgente' }
const DOWL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
function uuid() { return (crypto as any).randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16) }) }

/** O que falta para salvar o item (vazio = pronto). */
function missing(i: VItem, db: any): string | null {
  switch (i.kind) {
    case 'gasto': {
      const cat = db.categories.find((c: any) => c.id === i.categoryId)
      return !i.description ? 'falta o que foi' : !(i.amount! > 0) ? 'falta o valor' : !i.payment ? 'falta a forma de pagamento' : i.payment === 'credito' && !i.cardId ? 'falta o cartão' : isFuelCat(cat) && i.vehicle !== 'moto' && i.vehicle !== 'carro' ? 'moto ou carro?' : null
    }
    case 'fatura': return !i.cardId ? 'falta o cartão' : !(i.amount! > 0) ? 'falta o valor' : !i.due ? 'falta o mês' : null
    case 'wish': return !(i.amount! > 0) ? 'falta o valor' : null
    case 'entrada': return !(i.amount! > 0) ? 'falta o valor' : null
    case '?': return 'não entendi'
    default: return null
  }
}
function view(i: VItem, db: any, naming: any): { icon: string; k: string; t: string; d: string } {
  const card = (id: string | null) => db.cards.find((c: any) => c.id === id)?.name || ''
  switch (i.kind) {
    case 'gasto': { const c = db.categories.find((x: any) => x.id === i.categoryId); return { icon: catIcon(c?.name), k: 'Gasto', t: i.description || '—', d: [i.amount ? brl(i.amount) : null, i.payment === 'credito' ? `${card(i.cardId) || 'cartão?'}${i.installments > 1 ? ` ${i.installments}x` : ''}` : i.payment ? PAY_LABEL[i.payment] : null, c?.name, i.vehicle === 'moto' ? 'moto' : i.vehicle === 'carro' ? 'carro' : null, i.date !== db.__today ? ddmm(i.date) : null].filter(Boolean).join(' · ') } }
    case 'fatura': return { icon: 'card', k: 'Fatura do cartão', t: `${card(i.cardId) || 'Cartão?'}${i.due ? ` · vence ${ddmm(i.due)}` : ''}`, d: `${i.amount ? brl(i.amount) : 'sem valor'}${i.due ? ` · valor manual · ciclo ${cycleName(billCycleKey(i.due, naming), naming)}` : ''}` }
    case 'habito': return { icon: 'flame', k: 'Hábito feito hoje', t: db.habits.find((h: any) => h.id === i.habitId)?.name || '', d: `você disse "${i.text}"` }
    case 'tarefa_feita': return { icon: 'check', k: 'Tarefa feita', t: db.tasks.find((h: any) => h.id === i.taskId)?.name || '', d: `você disse "${i.text}"` }
    case 'tarefa_nova': return { icon: 'list', k: 'Nova tarefa', t: i.name, d: `${FQ[i.freq]}${i.freq === 'semanal' && i.weekday != null ? ` · ${DOWL[i.weekday]}` : ''}` }
    case 'wish': { const w = db.wish.find((x: any) => x.id === i.wishId); return { icon: 'gift', k: 'Comprado da wishlist', t: w?.name || '', d: i.amount ? brl(i.amount) : 'sem valor' } }
    case 'entrada': return { icon: 'trend', k: 'Entrada', t: i.description, d: `${i.amount ? '+ ' + brl(i.amount) : 'sem valor'}${i.date !== db.__today ? ` · ${ddmm(i.date)}` : ''}` }
    default: return { icon: 'info', k: 'Não entendi', t: `"${i.text}"`, d: 'Toque em editar e escreva de outro jeito, ou remova.' }
  }
}

export function Voz({ onClose }: { onClose: () => void }) {
  const ctx = useData(); const { db, today, naming, ins, upd, reload, toast } = ctx
  const [text, setText] = useState(''); const [interim, setInterim] = useState('')
  const [on, setOn] = useState(false); const [items, setItems] = useState<VItem[] | null>(null)
  const [busy, setBusy] = useState(false); const [form, setForm] = useForm()
  const rec = useRef<any>(null); const base = useRef('')
  const vctx = useMemo(() => ({ cards: db!.cards, habits: db!.habits, tasks: db!.tasks, wish: db!.wish, income: db!.income, keywords: db!.keywords, today }), [db, today])
  const dbv = useMemo(() => ({ ...db, __today: today }), [db, today])
  useEffect(() => () => { try { rec.current?.stop() } catch { /* */ } }, [])
  function start() {
    if (!SR) return
    const r = new SR(); rec.current = r
    r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true
    base.current = text ? text.trim() + '. ' : ''
    r.onresult = (e: any) => { let fin = '', mid = ''; for (let i = 0; i < e.results.length; i++) { const x = e.results[i][0].transcript; if (e.results[i].isFinal) fin += x + ' '; else mid += x } setText((base.current + fin).trim()); setInterim(mid) }
    r.onerror = (e: any) => { setOn(false); if (e.error === 'not-allowed' || e.error === 'service-not-allowed') toast('Libere o microfone para o app (ou use o microfone do teclado)'); else if (e.error !== 'no-speech' && e.error !== 'aborted') toast('O áudio falhou. Tente de novo ou digite.') }
    r.onend = () => { setOn(false); setInterim('') }
    try { r.start(); setOn(true); setItems(null) } catch { setOn(false) }
  }
  function stop() { try { rec.current?.stop() } catch { /* */ } setOn(false) }
  function understand() { stop(); const all = (text + ' ' + interim).trim(); if (!all) return toast('Fale ou escreva alguma coisa'); setItems(parseVoice(all, vctx)) }
  const setAt = (i: number, it: VItem | VItem[] | null) => setItems((xs) => { const n = [...(xs || [])]; n.splice(i, 1, ...(it ? (Array.isArray(it) ? it : [it]) : [])); return n })

  function edit(i: number) {
    const it = items![i]
    const cardOpts = db!.cards.map((c: any) => ({ v: c.id, l: c.name }))
    const done = (patch: any) => { setAt(i, { ...it, ...patch } as VItem); return true }
    if (it.kind === 'gasto') return setForm({ title: 'Gasto', initial: { description: it.description, amount: it.amount ?? '', categoryId: it.categoryId || '', payment: it.payment || '', cardId: it.cardId || '', installments: it.installments, date: it.date, vehicle: it.vehicle || '' }, fields: [
      { k: 'description', label: 'O que foi', type: 'text', required: true }, { k: 'amount', label: 'Valor', type: 'money', required: true, positive: true },
      { k: 'categoryId', label: 'Categoria', type: 'select', options: db!.categories.map((c: any) => ({ v: c.id, l: c.name })) },
      { k: 'vehicle', label: 'Moto ou carro?', type: 'ops', options: [{ v: 'moto', l: 'Moto' }, { v: 'carro', l: 'Carro' }] },
      { k: 'payment', label: 'Pagamento', type: 'ops', options: ['dinheiro', 'pix', 'debito', 'credito'].map((v) => ({ v, l: PAY_LABEL[v] })) },
      { k: 'cardId', label: 'Cartão', type: 'select', options: cardOpts }, { k: 'installments', label: 'Parcelas', type: 'number', min: 1, max: 48 }, { k: 'date', label: 'Data', type: 'date', required: true }],
      show: (v) => ({ cardId: v.payment === 'credito', installments: v.payment === 'credito', vehicle: isFuelCat(db!.categories.find((c: any) => c.id === v.categoryId)) }),
      onSave: (v) => done({ description: v.description, amount: v.amount, categoryId: v.categoryId || null, payment: v.payment || null, cardId: v.cardId || null, installments: Math.max(1, Number(v.installments) || 1), date: v.date, vehicle: v.vehicle || null }) })
    if (it.kind === 'fatura') { const dues = Array.from({ length: 8 }, (_, k) => { const p = parts(today); const t = new Date(p.y, p.m - 1 + k, 1); return t }).map((t) => ({ y: t.getFullYear(), m: t.getMonth() + 1 }))
      return setForm({ title: 'Fatura do cartão', initial: { cardId: it.cardId || '', ym: it.due ? it.due.slice(0, 7) : '', amount: it.amount ?? '' }, fields: [
        { k: 'cardId', label: 'Cartão', type: 'select', required: true, options: cardOpts },
        { k: 'ym', label: 'Mês do vencimento', type: 'select', required: true, options: dues.map((d) => ({ v: `${d.y}-${String(d.m).padStart(2, '0')}`, l: `${cycleName(`${d.y}-${String(d.m).padStart(2, '0')}`, 'start')} ${d.y}` })) },
        { k: 'amount', label: 'Valor da fatura', type: 'money', required: true, positive: true }],
        onSave: (v) => { const c = db!.cards.find((x: any) => x.id === v.cardId); return done({ cardId: v.cardId, amount: v.amount, due: `${v.ym}-${String(c.due_day).padStart(2, '0')}` }) } }) }
    if (it.kind === 'habito') return setForm({ title: 'Hábito feito hoje', initial: { habitId: it.habitId }, fields: [{ k: 'habitId', label: 'Hábito', type: 'select', required: true, options: db!.habits.filter((h: any) => h.kind !== 'phone').map((h: any) => ({ v: h.id, l: h.name })) }], onSave: (v) => done({ habitId: v.habitId }) })
    if (it.kind === 'tarefa_feita') return setForm({ title: 'Tarefa feita', initial: { taskId: it.taskId }, fields: [{ k: 'taskId', label: 'Tarefa', type: 'select', required: true, options: db!.tasks.map((h: any) => ({ v: h.id, l: h.name })) }], onSave: (v) => done({ taskId: v.taskId }) })
    if (it.kind === 'tarefa_nova') return setForm({ title: 'Nova tarefa', initial: { name: it.name, freq: it.freq, weekday: it.weekday ?? dow(today) }, fields: [
      { k: 'name', label: 'Tarefa', type: 'text', required: true }, { k: 'freq', label: 'Frequência', type: 'select', required: true, options: Object.entries(FQ).map(([v, l]) => ({ v, l })) },
      { k: 'weekday', label: 'Dia da semana', type: 'select', required: true, options: DOWL.map((l, v) => ({ v, l })) }],
      show: (v) => ({ weekday: v.freq === 'semanal' }), onSave: (v) => done({ name: v.name, freq: v.freq, weekday: v.freq === 'semanal' ? Number(v.weekday) : null }) })
    if (it.kind === 'wish') return setForm({ title: 'Comprado da wishlist', initial: { wishId: it.wishId, amount: it.amount ?? '' }, fields: [
      { k: 'wishId', label: 'Item', type: 'select', required: true, options: db!.wish.filter((w: any) => !w.bought).map((w: any) => ({ v: w.id, l: w.name })) }, { k: 'amount', label: 'Valor', type: 'money', required: true, positive: true }], onSave: (v) => done({ wishId: v.wishId, amount: v.amount }) })
    if (it.kind === 'entrada') return setForm({ title: 'Entrada', initial: { sourceId: it.sourceId || '', description: it.description, amount: it.amount ?? '', date: it.date }, fields: [
      { k: 'sourceId', label: 'De onde', type: 'select', options: db!.income.map((s: any) => ({ v: s.id, l: s.name })) }, { k: 'description', label: 'Descrição', type: 'text', required: true },
      { k: 'amount', label: 'Valor', type: 'money', required: true, positive: true }, { k: 'date', label: 'Data', type: 'date', required: true }],
      onSave: (v) => done({ sourceId: v.sourceId || null, description: v.description, amount: v.amount, date: v.date }) })
    return setForm({ title: 'Escreva de outro jeito', initial: { t: it.text }, fields: [{ k: 't', label: 'O que você quis dizer', type: 'text', required: true, hint: 'Ex.: "gastei 15 de docinho no pix", "fiz devocional", "acrescenta a tarefa limpar geladeira toda semana", "fatura do nubank de dezembro 320", "entrou 200 do reboque"' }],
      onSave: (v) => { setAt(i, splitClauses(v.t).flatMap((c) => parseClause(c, vctx))); return true } })
  }

  async function saveOne(it: VItem) {
    switch (it.kind) {
      case 'gasto': {
        if (it.payment === 'credito') { const card = db!.cards.find((c: any) => c.id === it.cardId); const n = it.installments || 1
          const dues = installmentDues(it.date, card.closing_day, card.due_day, n); const ps = splitInstallments(it.amount!, n); const g = uuid()
          return !!(await ins('tx', dues.map((due, k) => ({ kind: 'saida', description: it.description, amount: ps[k], date: it.date, category_id: it.categoryId, payment: 'credito', card_id: card.id, bill_due: due, installment_no: k + 1, installments: n, group_id: g, total_amount: it.amount, vehicle: it.vehicle || null })))) }
        return !!(await ins('tx', { kind: 'saida', description: it.description, amount: it.amount, date: it.date, category_id: it.categoryId, payment: it.payment, vehicle: it.vehicle || null })) }
      case 'fatura': { const ex = db!.manualBills.find((b: any) => b.card_id === it.cardId && b.due_date === it.due)
        return ex ? upd('manualBills', ex.id, { amount: it.amount }) : !!(await ins('manualBills', { card_id: it.cardId, due_date: it.due, amount: it.amount, note: 'pelo áudio' })) }
      case 'habito': { const { error } = await sb.from('tp_habit_logs').upsert({ habit_id: it.habitId, day: today, done: true, household_id: db!.hh.id }, { onConflict: 'habit_id,day' }); if (error) { toast(error.message); return false } await reload('habitLogs'); return true }
      case 'tarefa_feita': { const t = db!.tasks.find((x: any) => x.id === it.taskId); let occ = t.freq === 'urgente' ? (t.due_date || today) : today
        if (t.freq !== 'urgente' && t.freq !== 'diaria' && !occurs(t, today)) for (let k = 1; k <= 31; k++) { const o = addDays(today, -k); if (occurs(t, o)) { occ = o; break } }
        if (db!.taskDone.some((x: any) => x.task_id === t.id && x.day === occ)) return true
        return !!(await ins('taskDone', { task_id: t.id, day: occ, done_on: today })) }
      case 'tarefa_nova': return !!(await ins('tasks', { name: it.name, freq: it.freq, weekday: it.freq === 'semanal' ? (it.weekday ?? dow(today)) : null, anchor_date: today, month_day: it.freq === 'mensal' ? parts(today).d : null, due_date: it.freq === 'urgente' ? addDays(today, 2) : null, sort: db!.tasks.length + 1 }))
      case 'wish': return upd('wish', it.wishId, { bought: true, bought_on: today, amount: it.amount })
      case 'entrada': return !!(await ins('tx', { kind: 'entrada', description: it.description, amount: it.amount, date: it.date, payment: 'pix', income_source_id: it.sourceId, is_advance: false }))
    }
    return false
  }
  async function saveAll() {
    if (!items?.length) return
    if (items.some((i) => missing(i, db))) return toast('Ajuste ou remova os itens marcados')
    setBusy(true); let ok = 0; const left: VItem[] = []
    for (const it of items) { if (await saveOne(it)) ok++; else left.push(it) }
    setBusy(false)
    if (left.length) { setItems(left); toast(`Salvei ${ok}. ${left.length} deu erro.`) } else { toast(`Pronto! ${ok} ${ok === 1 ? 'item salvo' : 'itens salvos'}`); onClose() }
  }

  const bad = items ? items.filter((i) => missing(i, db)).length : 0
  return <Sheet title={items ? 'Entendi isto:' : 'Falar'} onClose={onClose}>
    {!items && <>
      {SR ? <div style={{ display: 'grid', placeItems: 'center', gap: 8, margin: '6px 0 12px' }}>
        <button type="button" aria-label={on ? 'parar' : 'gravar'} onClick={on ? stop : start} style={{ width: 84, height: 84, borderRadius: 42, display: 'grid', placeItems: 'center', background: on ? 'var(--neg)' : 'var(--ink)', color: '#fff', boxShadow: on ? '0 0 0 8px var(--negS)' : '0 6px 18px rgba(0,0,0,.18)' }}><Icon n={on ? 'x' : 'mic'} s={34} /></button>
        <div className="lbl" style={{ textAlign: 'center' }}>{on ? 'Ouvindo… fale tudo de uma vez. Toque para parar.' : 'Toque e fale. Pode falar várias coisas de uma vez.'}</div>
      </div> : <div className="note acc" style={{ marginBottom: 10 }}><Icon n="mic" /><div><div className="t">Toque no microfone do teclado</div><div className="d">Este navegador não grava aqui dentro. Toque na caixa abaixo e depois no microfone do teclado para ditar.</div></div></div>}
      <textarea className="fi" aria-label="o que você falou" rows={SR ? 4 : 6} style={{ fontSize: 15, lineHeight: 1.4, minHeight: SR ? 96 : 150 }} value={text + (interim ? (text ? ' ' : '') + interim : '')} onChange={(e) => { setText(e.target.value); setInterim('') }} placeholder={'Ex.: "Gastei 15 de docinho no pix, uber 18 nubank 3x. Fiz devocional e academia. Acrescenta a tarefa limpar geladeira toda semana. Entrou 200 do reboque."'} />
      <div className="lbl" style={{ margin: '6px 2px 12px' }}>Dá para falar: gastos, fatura de cartão ("fatura do Nubank de dezembro 320"), hábitos e tarefas feitas, tarefa nova, compra da wishlist e entradas.</div>
      <button type="button" className="btn" onClick={understand}><Icon n="check" /> Entender</button>
    </>}
    {items && <>
      {items.length === 0 && <div className="note warn"><Icon n="info" /><div className="d">Não achei nada. Volte e fale de novo.</div></div>}
      <div className="card" style={{ padding: '2px 14px', marginBottom: 10 }}>{items.map((it, i) => { const v = view(it, dbv, naming); const m = missing(it, db)
        return <div key={i} className="li vz" data-kind={it.kind}><Ic n={v.icon} style={it.kind === '?' ? { background: 'var(--negS)', color: 'var(--neg)' } : undefined} />
          <div style={{ minWidth: 0, flex: 1 }}><div className="lbl" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3 }}>{v.k}</div><div className="t">{v.t}</div><div className="d n">{v.d}</div>{m === 'moto ou carro?' ? <div className="row" style={{ gap: 5, marginTop: 6 }}>{(['moto', 'carro'] as const).map((x) => <button type="button" key={x} className="tag acc" onClick={() => setAt(i, { ...it, vehicle: x } as VItem)}>{x === 'moto' ? 'Moto' : 'Carro'}</button>)}</div> : m && <span className={'tag ' + (it.kind === '?' ? 'neg' : 'warn')} style={{ marginTop: 4 }}>{m}</span>}</div>
          <button type="button" className="ib" style={{ width: 32, height: 32 }} aria-label="editar" onClick={() => edit(i)}><Icon n="edit" s={15} /></button>
          <button type="button" className="ib" style={{ width: 32, height: 32 }} aria-label="remover" onClick={() => setAt(i, null)}><Icon n="x" s={15} /></button>
        </div> })}</div>
      <div className="row2">
        <button type="button" className="btn l" style={{ flex: '0 0 auto', padding: '12px 14px' }} onClick={() => setItems(null)}><Icon n="mic" /> Falar mais</button>
        <button type="button" className="btn" disabled={busy || !items.length} onClick={saveAll}>{busy ? 'Salvando…' : bad ? `Ajuste ${bad} ${bad === 1 ? 'item' : 'itens'}` : `Salvar ${items.length === 1 ? '1 item' : `${items.length} itens`}`}</button>
      </div>
    </>}
    {form}
  </Sheet>
}
