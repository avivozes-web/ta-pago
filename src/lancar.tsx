import { useMemo, useState } from 'react'
import { useData } from './data'
import { Icon } from './icons'
import { Sheet, FormSheet, MACRO_LABEL, type Field } from './ui'
import { parseEntry, guessCategory, learnWord, norm, type Pay } from './lib/parse'
import { installmentDues, splitInstallments, cycleName, billCycleKey, addDays, todayStr } from './lib/cycle'
import { brl, ddmm, moneyIn, moneyOut, PAY_LABEL } from './lib/fmt'
import { sb } from './lib/sb'
import { txCycleKey } from './lib/calc'

export async function learn(ctx: any, description: string, categoryId: string | null) {
  if (!categoryId) return
  const w = learnWord(description); if (!w) return
  const { error } = await sb.from('tp_keywords').upsert({ word: w, category_id: categoryId, learned: true, household_id: ctx.db.hh.id }, { onConflict: 'household_id,word' })
  if (!error) { await ctx.reload('keywords'); return w }
  return null
}
function uuid() { return (crypto as any).randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16) }) }

function Row({ k, children }: { k: string; children: any }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--line2)' }}><span style={{ width: 80, color: 'var(--mut)', fontSize: 12, flex: 'none' }}>{k}</span><div style={{ flex: 1, minWidth: 0 }}>{children}</div></div> }
export interface LancarInit { mode?: 'saida' | 'entrada'; sourceId?: string; amount?: number; advance?: boolean; text?: string }
export function Lancar({ onClose, init }: { onClose: () => void; init?: LancarInit }) {
  const ctx = useData(); const { db, today, naming, startDay, ins, toast } = ctx
  const [mode, setMode] = useState<'saida' | 'entrada'>(init?.mode || 'saida')
  const [text, setText] = useState(init?.text || '')
  const [ov, setOv] = useState<Record<string, any>>(() => init?.mode === 'entrada' ? { sourceId: init.sourceId || '', amount: init.amount != null ? moneyOut(init.amount) : undefined, advance: !!init.advance } : {})
  const [busy, setBusy] = useState(false)
  const cards = db!.cards
  const p = useMemo(() => parseEntry(text, cards.map((c: any) => ({ id: c.id, name: c.name, aliases: c.aliases || '' })), today), [text, cards, today])
  const guess = useMemo(() => (p.description ? guessCategory(p.description, db!.keywords) : null), [p.description, db])
  const srcGuess = useMemo(() => { const n = norm(p.description); if (!n) return null; return db!.income.find((s: any) => [s.name, ...(s.aliases || '').split(',')].map(norm).filter(Boolean).some((a: string) => n.includes(a) || a.includes(n))) || null }, [p.description, db])
  const set = (k: string, v: any) => setOv((o) => ({ ...o, [k]: v }))
  const description = ov.description ?? p.description
  const amountStr = ov.amount ?? (p.amount != null ? moneyOut(p.amount) : '')
  const amount = moneyIn(amountStr)
  const date = ov.date ?? p.date ?? today
  const payment: Pay | '' = ov.payment ?? p.payment ?? ''
  const cardId: string = ov.cardId ?? p.cardId ?? ''
  const installments = Math.max(1, Number(ov.installments ?? p.installments) || 1)
  const categoryId: string = ov.categoryId ?? guess?.category_id ?? ''
  const cat = db!.categories.find((c: any) => c.id === categoryId)
  const card = cards.find((c: any) => c.id === cardId)
  const dues = payment === 'credito' && card ? installmentDues(date, card.closing_day, card.due_day, installments) : []
  const parts = amount ? splitInstallments(amount, installments) : []
  const sourceId: string = ov.sourceId ?? srcGuess?.id ?? ''
  const source = db!.income.find((s: any) => s.id === sourceId)
  const advance = !!ov.advance

  async function save() {
    if (!amount || amount <= 0) return toast('Coloque o valor')
    setBusy(true)
    try {
      if (mode === 'entrada') {
        const desc = description || source?.name || 'Entrada'
        const r = await ins('tx', { kind: 'entrada', description: advance ? `${source?.name || desc} – adiantamento` : desc, amount, date, payment: payment || 'pix', income_source_id: sourceId || null, is_advance: advance })
        if (r) { toast('Entrada salva'); onClose() }
        return
      }
      if (!description) return toast('Escreva o que foi')
      if (!payment) return toast('Escolha a forma de pagamento')
      if (payment === 'credito' && !card) return toast('Escolha o cartão')
      if (payment === 'credito') {
        const g = uuid()
        const rows = dues.map((due, i) => ({ kind: 'saida', description, amount: parts[i], date, category_id: categoryId || null, payment, card_id: card.id, bill_due: due, installment_no: i + 1, installments, group_id: g, total_amount: amount }))
        const r = await ins('tx', rows); if (!r) return
      } else {
        const r = await ins('tx', { kind: 'saida', description, amount, date, category_id: categoryId || null, payment }); if (!r) return
      }
      const w = categoryId && (!guess || guess.category_id !== categoryId) ? await learn(ctx, description, categoryId) : null
      toast(w ? `Gasto salvo · aprendi "${w}" → ${cat?.name}` : 'Gasto salvo'); onClose()
    } finally { setBusy(false) }
  }
  const inp = { className: 'fi', style: { padding: '7px 9px', fontSize: 13 } }
  return <Sheet title={mode === 'saida' ? 'Novo gasto' : 'Nova entrada'} onClose={onClose} right={
    <div style={{ display: 'flex', background: '#ECEAE5', borderRadius: 9, padding: 3, fontSize: 12, fontWeight: 500 }}>
      {(['saida', 'entrada'] as const).map((m) => <button type="button" key={m} onClick={() => setMode(m)} style={m === mode ? { background: '#fff', padding: '4px 12px', borderRadius: 7, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,.08)' } : { padding: '4px 12px', color: 'var(--mut)' }}>{m === 'saida' ? 'Gasto' : 'Entrada'}</button>)}
    </div>}>
    <input autoFocus={!init?.sourceId} className="fi" style={{ border: '1.5px solid var(--ink)', fontSize: 15, fontWeight: 500, padding: '11px 12px' }} value={text} onChange={(e) => { setText(e.target.value); setOv((o) => { const { description, amount, date, payment, cardId, installments, categoryId, ...rest } = o; return mode === 'entrada' ? { ...rest, categoryId } : rest }) }}
      placeholder={mode === 'saida' ? 'docinho 2 pix' : 'salário isa 2800'} aria-label="lançamento rápido" onKeyDown={(e) => { if (e.key === 'Enter') save() }} />
    <div className="lbl" style={{ margin: '6px 2px 10px' }}>{mode === 'saida' ? 'Escreva do seu jeito: "docinho 2 pix", "uber 18 nubank 3x", "mercado 250 bb ontem"' : 'Ex.: "salário isa 2800", "reboque 650 pix"'}</div>
    <div className="card" style={{ padding: '4px 14px', marginBottom: 10 }}>
      {mode === 'entrada' && <Row k="De onde"><select {...inp} value={sourceId} onChange={(e) => set('sourceId', e.target.value)}><option value="">Outra entrada</option>{db!.income.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Row>}
      <Row k="Descrição"><input {...inp} value={description} placeholder={mode === 'entrada' ? source?.name || 'Ex.: Venda' : 'Ex.: Docinho'} onChange={(e) => set('description', e.target.value)} /></Row>
      <Row k="Valor"><div className="row" style={{ gap: 6 }}><input {...inp} inputMode="decimal" value={amountStr} placeholder="0,00" onChange={(e) => set('amount', e.target.value)} />{payment === 'credito' && installments > 1 && amount ? <span className="tag n">{installments}x de {brl(parts[parts.length - 1])}</span> : null}</div></Row>
      {mode === 'saida' && <Row k="Categoria"><select {...inp} value={categoryId} onChange={(e) => set('categoryId', e.target.value)}><option value="">Escolha…</option>{db!.categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <div className="row" style={{ gap: 5, marginTop: 4, flexWrap: 'wrap' }}>{cat && <span className="tag">{MACRO_LABEL[cat.macro]}</span>}{guess && guess.category_id === categoryId && <span className="tag acc"><Icon n="check" /> palavra {guess.learned ? 'aprendida' : 'conhecida'}: "{guess.word}"</span>}{categoryId && (!guess || guess.category_id !== categoryId) && description && <span className="tag">vou aprender "{learnWord(description)}"</span>}</div></Row>}
      <Row k="Data"><input {...inp} type="date" value={date} onChange={(e) => set('date', e.target.value)} /></Row>
      <Row k="Pagamento"><div className="row" style={{ gap: 5 }}>{(mode === 'saida' ? ['dinheiro', 'pix', 'debito', 'credito'] : ['pix', 'dinheiro']).map((x) => <button type="button" key={x} className={'op' + ((payment || (mode === 'entrada' ? 'pix' : '')) === x ? ' on' : '')} style={{ padding: '7px 2px', fontSize: 12 }} onClick={() => set('payment', x)}>{PAY_LABEL[x]}</button>)}</div></Row>
      {mode === 'saida' && payment === 'credito' && <Row k="Parcelas"><div className="row" style={{ gap: 6 }}><input {...inp} type="number" min={1} max={48} style={{ ...inp.style, width: 70 }} value={installments} onChange={(e) => set('installments', e.target.value)} /><span className="lbl n" style={{ lineHeight: 1.3 }}>{dues.length ? `fatura${dues.length > 1 ? 's' : ''} de ${dues.slice(0, 4).map(ddmm).join(', ')}${dues.length > 4 ? '…' : ''}` : 'escolha o cartão'}</span></div></Row>}
      {mode === 'entrada' && source?.is_salary && <Row k="Adiantamento"><div className="row"><span className="lbl" style={{ lineHeight: 1.3 }}>Pegou antes do dia {startDay}? Desconta do próximo salário.</span><button type="button" className={'sp tog' + (advance ? '' : ' off')} onClick={() => set('advance', !advance)} aria-label="é adiantamento"><i /></button></div></Row>}
    </div>
    {mode === 'saida' && payment === 'credito' && <div className="card" style={{ padding: '12px 14px', marginBottom: 12, borderColor: '#F0DFC0', background: 'var(--warnS)' }}>
      <div className="row" style={{ marginBottom: 9 }}><span style={{ color: 'var(--warn)' }}><Icon n="info" s={16} /></span><b style={{ fontSize: 13 }}>Em qual cartão?</b></div>
      <div className="row" style={{ gap: 6 }}>{cards.map((c: any) => <button type="button" key={c.id} className={'op' + (c.id === cardId ? ' on' : '')} onClick={() => set('cardId', c.id)}>{c.name === 'BB' ? 'Banco do Brasil' : c.name}</button>)}</div>
      {dues[0] && <div className="lbl" style={{ marginTop: 8, color: 'var(--ink2)' }}>1ª parcela na fatura que vence {ddmm(dues[0])} → ciclo <b>{cycleName(billCycleKey(dues[0], naming), naming)}</b></div>}
    </div>}
    {mode === 'entrada' && advance && <div className="note acc"><Icon n="info" /><div className="d">Fica como <b>{source?.name} – adiantamento</b> no ciclo do próximo salário ({cycleName(txCycleKey({ kind: 'entrada', is_advance: true, date }, startDay, naming), naming)}), junto com as faturas que ele paga. O que falta receber do salário cai sozinho.</div></div>}
    <button type="button" className="btn" disabled={busy} onClick={save}>{busy ? 'Salvando…' : mode === 'saida' ? 'Salvar gasto' : 'Salvar entrada'}</button>
  </Sheet>
}

/** Editar um lançamento já salvo (todas as parcelas juntas, se for parcelado). */
export function TxEdit({ t, onClose }: { t: any; onClose: () => void }) {
  const ctx = useData(); const { db, upd, del, ins, reload, toast } = ctx
  const group = t.group_id ? db!.tx.filter((x: any) => x.group_id === t.group_id).sort((a: any, b: any) => a.installment_no - b.installment_no) : [t]
  const isCredit = t.payment === 'credito'
  const fields: Field[] = t.kind === 'entrada' ? [
    { k: 'description', label: 'Descrição', type: 'text', required: true },
    { k: 'amount', label: 'Valor', type: 'money', required: true, positive: true },
    { k: 'date', label: 'Data', type: 'date', required: true },
    { k: 'income_source_id', label: 'De onde', type: 'select', options: db!.income.map((s: any) => ({ v: s.id, l: s.name })) },
    { k: 'is_advance', label: 'Adiantamento', type: 'toggle', hint: 'É adiantamento do próximo salário' },
  ] : [
    { k: 'description', label: 'Descrição', type: 'text', required: true },
    { k: 'amount', label: isCredit && group.length > 1 ? `Valor total (${group.length} parcelas)` : 'Valor', type: 'money', required: true, positive: true },
    { k: 'category_id', label: 'Categoria', type: 'select', options: db!.categories.map((c: any) => ({ v: c.id, l: c.name })) },
    { k: 'date', label: 'Data da compra', type: 'date', required: true },
    { k: 'payment', label: 'Pagamento', type: 'ops', options: ['dinheiro', 'pix', 'debito', 'credito'].map((x) => ({ v: x, l: PAY_LABEL[x] })) },
    { k: 'card_id', label: 'Cartão', type: 'select', options: db!.cards.map((c: any) => ({ v: c.id, l: c.name })) },
    { k: 'installments', label: 'Parcelas', type: 'number', min: 1, max: 48 },
  ]
  const initial = { ...t, amount: isCredit ? Number(t.total_amount ?? t.amount) : Number(t.amount), installments: t.installments || 1, card_id: t.card_id || '' }
  return <FormSheet title={t.kind === 'entrada' ? 'Editar entrada' : 'Editar gasto'} fields={fields} initial={initial} onClose={onClose}
    show={(v) => ({ card_id: v.payment === 'credito', installments: v.payment === 'credito' })}
    onDelete={async () => {
      if (group.length > 1) { const ids = group.map((x: any) => x.id); const { error } = await sb.from('tp_transactions').delete().in('id', ids); if (error) toast(error.message); await reload('tx') }
      else await del('tx', t.id)
      toast('Apagado')
    }}
    onSave={async (v) => {
      if (t.kind === 'entrada') return upd('tx', t.id, { description: v.description, amount: v.amount, date: v.date, income_source_id: v.income_source_id || null, is_advance: !!v.is_advance })
      if (v.payment === 'credito') {
        const card = db!.cards.find((c: any) => c.id === v.card_id); if (!card) { toast('Escolha o cartão'); return false }
        const n = Math.max(1, Number(v.installments) || 1)
        const dues = installmentDues(v.date, card.closing_day, card.due_day, n); const parts = splitInstallments(v.amount, n)
        const ids = group.map((x: any) => x.id)
        const g = t.group_id || uuid()
        const r = await ins('tx', dues.map((due, i) => ({ kind: 'saida', description: v.description, amount: parts[i], date: v.date, category_id: v.category_id || null, payment: 'credito', card_id: card.id, bill_due: due, installment_no: i + 1, installments: n, group_id: g, total_amount: v.amount, created_by: t.created_by })))
        if (!r) return false
        const { error } = await sb.from('tp_transactions').delete().in('id', ids); if (error) toast(error.message)
        await reload('tx')
      } else {
        if (group.length > 1) { await sb.from('tp_transactions').delete().in('id', group.filter((x: any) => x.id !== t.id).map((x: any) => x.id)) }
        const ok = await upd('tx', t.id, { description: v.description, amount: v.amount, date: v.date, category_id: v.category_id || null, payment: v.payment, card_id: null, bill_due: null, installment_no: null, installments: null, group_id: null, total_amount: null })
        if (!ok) return false
        await reload('tx')
      }
      const w = v.category_id && v.category_id !== t.category_id ? await learn(ctx, v.description, v.category_id) : null
      toast(w ? `Salvo · aprendi "${w}"` : 'Salvo'); return true
    }}>
    {group.length > 1 && <div className="lbl" style={{ marginBottom: 8 }}>Parcelado em {group.length}x: {group.map((x: any) => `${ddmm(x.bill_due)} ${brl(Number(x.amount))}`).join(' · ')}. Mudar aqui refaz todas as parcelas.</div>}
  </FormSheet>
}
export { addDays, todayStr }

/** Salário: mudar o valor vale do ciclo escolhido para frente. */
export function salaryValueForm(ctx: any, s: any, fromKey: string, setForm: (f: any) => void) {
  const { upd, naming } = ctx
  const rates = (Array.isArray(s.rates) ? s.rates : [])
  const cur = [...rates].filter((r: any) => r.from <= fromKey).sort((a: any, b: any) => a.from.localeCompare(b.from)).pop()
  setForm({ title: `Valor · ${s.name}`, initial: { amount: cur ? Number(cur.amount) : Number(s.expected_amount) || '' }, fields: [{ k: 'amount', label: `Valor a partir de ${cycleName(fromKey, naming)}`, type: 'money', required: true, hint: `Vale de ${cycleName(fromKey, naming)} em diante. Os meses anteriores ficam como estavam.` }],
    onSave: (v: any) => upd('income', s.id, { rates: [...rates.filter((r: any) => r.from < fromKey), { from: fromKey, amount: v.amount }] }) })
}
/** "Recebi antes" (ou outro valor): grava o salário com a data certa, no ciclo do salário. */
export function salaryReceivedForm(ctx: any, row: any, key: string, setForm: (f: any) => void) {
  const { ins, upd, del, today, naming } = ctx
  const real = row.real?.[0]
  setForm({ title: `${row.source.name} · ${cycleName(key, naming)}`, initial: { date: real?.date || today, amount: real ? Number(real.amount) : row.net },
    fields: [{ k: 'date', label: 'Recebi em', type: 'date', required: true }, { k: 'amount', label: 'Valor recebido', type: 'money', required: true, positive: true, hint: row.adv > 0 ? `Já descontado o adiantamento de ${brl(row.adv)}.` : undefined }],
    onSave: async (v: any) => real ? upd('tx', real.id, { date: v.date, amount: v.amount }) : !!(await ins('tx', { kind: 'entrada', description: row.source.name, amount: v.amount, date: v.date, payment: 'pix', income_source_id: row.source.id, is_advance: false, for_cycle: key })),
    onDelete: real ? () => del('tx', real.id) : undefined })
}
