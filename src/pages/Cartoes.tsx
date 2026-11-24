import { useMemo } from 'react'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, CycleBanner, Seg, DIN, Ic, More, editDel, Add, useForm, Empty, Bar } from '../ui'
import { cycleData } from '../lib/calc'
import { brl, ddmm } from '../lib/fmt'
import { cycleName, billCycleKey, billDueFor, addMonthsDate, addDays, cycleRange } from '../lib/cycle'

const full = (n: string) => (n === 'BB' ? 'Banco do Brasil' : n)
export default function Cartoes() {
  const { db, key, today, naming, startDay, ins, upd, del, toast } = useData()
  const cd = useMemo(() => cycleData(db, key, today), [db, key, today])
  const [form, setForm] = useForm()
  const cards = db!.cards
  const main = cards.find((c: any) => c.is_main) || cards[0]
  const cname = (due: string) => cycleName(billCycleKey(due, naming), naming)
  // explicação com o cartão principal e a próxima fatura de hoje
  const ex = main ? (() => {
    const due = billDueFor(today, main.closing_day, main.due_day)
    const close = main.due_day > main.closing_day ? addMonthsDate(due, 0, main.closing_day) : addMonthsDate(due, -1, main.closing_day)
    const from = addDays(addMonthsDate(close, -1, main.closing_day), 1)
    const k = billCycleKey(due, naming); const r = cycleRange(k, startDay)
    const nextDue = addMonthsDate(due, 1, main.due_day)
    return { due, close, from, k, r, nextDue, nextFrom: addDays(close, 1) }
  })() : null
  const cardForm = (c?: any) => setForm({ title: c ? `Editar ${c.name}` : 'Novo cartão', initial: c ? { ...c, limit_amount: Number(c.limit_amount), goal: c.goal == null ? '' : Number(c.goal) } : { closing_day: '', due_day: '', is_main: false, phasing_out: false },
    fields: [
      { k: 'name', label: 'Nome', type: 'text', required: true },
      { k: 'closing_day', label: 'Dia que fecha', type: 'number', required: true, min: 1, max: 31 },
      { k: 'due_day', label: 'Dia que vence', type: 'number', required: true, min: 1, max: 31 },
      { k: 'limit_amount', label: 'Limite', type: 'money' },
      { k: 'goal', label: 'Meta de gasto por fatura (vazio = sem meta)', type: 'money' },
      { k: 'aliases', label: 'Outros nomes que você escreve', type: 'text', placeholder: 'ex.: nu, roxinho', hint: 'Separados por vírgula. Ex.: "uber 18 nu" entende Nubank.' },
      { k: 'is_main', label: 'Principal', type: 'toggle', hint: 'Cartão principal (aparece em destaque)' },
      { k: 'phasing_out', label: 'Parando de usar', type: 'toggle', hint: 'Estamos parando de usar este cartão' },
    ],
    onSave: async (v) => {
      const row = { name: v.name, closing_day: v.closing_day, due_day: v.due_day, limit_amount: v.limit_amount ?? 0, goal: v.goal, aliases: v.aliases || '', is_main: !!v.is_main, phasing_out: !!v.phasing_out }
      if (row.is_main) for (const o of cards.filter((x: any) => x.is_main && x.id !== c?.id)) await upd('cards', o.id, { is_main: false })
      return c ? upd('cards', c.id, row) : !!(await ins('cards', { ...row, sort: cards.length + 1 }))
    },
    onDelete: c ? async () => { if (db!.tx.some((t: any) => t.card_id === c.id)) toast('As compras desse cartão ficam no extrato, sem cartão.'); await del('cards', c.id) } : undefined })
  const billForm = (b?: any) => setForm({ title: b ? 'Editar fatura digitada' : 'Fatura de antes do app', initial: b ? { ...b, amount: Number(b.amount) } : { card_id: main?.id, due_date: '' },
    fields: [
      { k: 'card_id', label: 'Cartão', type: 'select', required: true, options: cards.map((c: any) => ({ v: c.id, l: full(c.name) })) },
      { k: 'due_date', label: 'Vence em', type: 'date', required: true, hint: 'Entra no ciclo com o nome do mês em que vence.' },
      { k: 'amount', label: 'Valor da fatura', type: 'money', required: true, positive: true },
      { k: 'note', label: 'Observação', type: 'text', placeholder: 'ex.: última parcela da geladeira' },
    ],
    onSave: async (v) => { const row = { card_id: v.card_id, due_date: v.due_date, amount: v.amount, note: v.note || '' }; return b ? upd('manualBills', b.id, row) : !!(await ins('manualBills', row)) },
    onDelete: b ? () => del('manualBills', b.id) : undefined })
  const quick = (c: any, k: string, label: string, money = false) => setForm({ title: `${c.name} · ${label}`, initial: { v: c[k] == null ? '' : Number(c[k]) }, fields: [money ? { k: 'v', label, type: 'money' } : { k: 'v', label, type: 'number', required: true, min: 1, max: 31 }], onSave: (v) => upd('cards', c.id, { [k]: money ? (v.v ?? (k === 'goal' ? null : 0)) : v.v }) })
  const billOf = (c: any) => cd.bills.filter((b) => b.card.id === c.id)
  const future = (c: any) => { const m: Record<string, { due: string; amount: number; n: number; manual: number }> = {}
    db!.tx.filter((t: any) => t.card_id === c.id && t.payment === 'credito' && billCycleKey(t.bill_due, naming) > key).forEach((t: any) => { const x = (m[t.bill_due] = m[t.bill_due] || { due: t.bill_due, amount: 0, n: 0, manual: 0 }); x.amount += Number(t.amount); x.n++ })
    db!.manualBills.filter((b: any) => b.card_id === c.id && billCycleKey(b.due_date, naming) > key).forEach((b: any) => { const x = (m[b.due_date] = m[b.due_date] || { due: b.due_date, amount: 0, n: 0, manual: 0 }); x.amount += Number(b.amount); x.manual++ })
    return Object.values(m).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6) }
  const chip = (c: any, k: string, label: string, val: string, money = false) => <button type="button" onClick={() => quick(c, k, label, money)} style={{ flex: 1, background: 'rgba(255,255,255,.07)', borderRadius: 10, padding: '7px 8px', color: '#fff' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)' }}>{label}</div><div className="row n" style={{ fontSize: 12.5, fontWeight: 600, gap: 4 }}>{val}<span className="sp" style={{ color: 'rgba(255,255,255,.45)' }}><Icon n="edit" s={12} /></span></div></button>
  const others = cards.filter((c: any) => c.id !== main?.id)
  const manualAll = [...db!.manualBills].sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))
  const cardBy = Object.fromEntries(cards.map((c: any) => [c.id, c]))
  return <>
    <Header /><div className="ttl">Dinheiro</div><Seg items={DIN} /><CycleBanner />
    <div className="wrap">
      {ex && <div className="card" style={{ background: 'var(--accS)', borderColor: '#CFE5DD' }}>
        <div className="row" style={{ marginBottom: 8 }}><span style={{ color: 'var(--acc)' }}><Icon n="info" s={16} /></span><b style={{ fontSize: 13 }}>A fatura entra no ciclo do mês em que vence</b></div>
        <div className="row" style={{ background: '#fff', borderRadius: 10, padding: '9px 6px', gap: 2 }}>
          {[[`${ddmm(ex.from)} a ${ddmm(ex.close)}`, 'compras'], [ddmm(ex.close), 'fecha'], [ddmm(ex.due), 'vence'], [cycleName(ex.k, naming), `${ddmm(ex.r.start)} – ${ddmm(ex.r.end)}`]].map(([a, b], i) => <div key={i} style={{ display: 'contents' }}>{i > 0 && <span style={{ color: 'var(--mut2)', flex: 'none' }}><Icon n="right" s={14} /></span>}<div style={{ flex: 1, textAlign: 'center' }}><div className="n" style={{ fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap', color: i === 3 ? 'var(--acc)' : undefined }}>{a}</div><div className="lbl" style={{ fontSize: 10.5, lineHeight: 1.25 }}>{b}</div></div></div>)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 8 }}>A fatura do {full(main.name)} que vence {ddmm(ex.due)} é paga com o adiantamento do salário de {cycleName(ex.k, naming).toLowerCase()}, por isso entra no ciclo <b>{cycleName(ex.k, naming)}</b>. Compras a partir de {ddmm(ex.nextFrom)} vão para a fatura de {ddmm(ex.nextDue)}, que entra em <b>{cname(ex.nextDue)}</b>.</div>
      </div>}
      {main && (() => { const bs = billOf(main); const amt = bs.reduce((s, b) => s + b.amount, 0); const goal = main.goal != null ? Number(main.goal) : null
        return <div className="card" style={{ background: 'var(--ink)', borderColor: 'var(--ink)', color: '#fff' }}>
          <div className="row"><b style={{ fontSize: 14 }}>{full(main.name)}</b><span className="tag" style={{ background: 'rgba(63,209,169,.15)', color: '#3FD1A9' }}>principal</span><span className="sp" style={{ color: 'rgba(255,255,255,.6)' }}><More items={editDel(() => cardForm(main), async () => { if (confirm(`Apagar o cartão ${main.name}?`)) await del('cards', main.id) })} /></span></div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)', marginTop: 10 }}>{bs.length ? `Fatura que vence ${bs.map((b) => ddmm(b.due)).join(' e ')} · ciclo ${cycleName(key, naming)}` : `Nenhuma fatura vence em ${cycleName(key, naming)}`}</div>
          <div className="n" style={{ fontSize: 26, fontWeight: 650, letterSpacing: -0.5 }}>{brl(amt)}</div>
          {goal ? <><div style={{ height: 6, borderRadius: 9, background: 'rgba(255,255,255,.12)', margin: '8px 0 5px', overflow: 'hidden' }}><i style={{ display: 'block', width: `${Math.min(100, (amt / goal) * 100)}%`, height: '100%', background: amt > goal ? '#E58A7F' : '#3FD1A9', borderRadius: 9 }} /></div>
            <div className="row n" style={{ fontSize: 11.5, color: 'rgba(255,255,255,.65)' }}><span>{Math.round((amt / goal) * 100)}% da meta</span><span className="sp">disponível {brl(Math.max(0, Number(main.limit_amount) - amt))}</span></div></> : null}
          <div className="row" style={{ gap: 6, marginTop: 10 }}>{chip(main, 'closing_day', 'Fecha', `dia ${main.closing_day}`)}{chip(main, 'due_day', 'Vence', `dia ${main.due_day}`)}{chip(main, 'limit_amount', 'Limite', brl(Number(main.limit_amount), false).replace('R$ ', ''), true)}{chip(main, 'goal', 'Meta', main.goal == null ? '—' : brl(Number(main.goal), false).replace('R$ ', ''), true)}</div>
        </div> })()}
      {main && <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>Próximas faturas</h3><span className="sp lbl">{main.name} · já lançadas</span></div>
        {future(main).length === 0 && <Empty>Nada lançado para os próximos ciclos.</Empty>}
        {future(main).map((f) => <div key={f.due} className="li"><div><div className="t">{ddmm(f.due)} · {cname(f.due)}</div><div className="d">{[f.n && `${f.n} parcela${f.n > 1 ? 's' : ''}`, f.manual && 'digitada à mão'].filter(Boolean).join(' · ')}</div></div><div className="v">{brl(f.amount)}</div></div>)}
      </div>}
      <div className="card" style={{ padding: '12px 14px 6px' }}><div className="ch"><h3>Já tinha faturas antes do app?</h3></div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 6 }}>Digite o valor da fatura atual e das próximas (parcelas antigas). Cada uma entra no ciclo do mês em que vence.</div>
        {manualAll.map((b: any) => <div key={b.id} className="li tap" onClick={() => billForm(b)}><Ic n="card" /><div><div className="t">{full(cardBy[b.card_id]?.name || '')} · vence {ddmm(b.due_date)}</div><div className="d">ciclo {cname(b.due_date)}{b.note ? ` · ${b.note}` : ''}</div></div><div className="v">{brl(Number(b.amount))}<small><span className="tag">manual</span></small></div><More items={editDel(() => billForm(b), () => del('manualBills', b.id))} /></div>)}
        <Add label="Lançar fatura manualmente" onClick={() => billForm()} /><div style={{ height: 6 }} />
      </div>
      <div className="sec">Outros cartões</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {others.map((c: any) => { const amt = billOf(c).reduce((s, b) => s + b.amount, 0); return <div key={c.id} className="li tap" onClick={() => cardForm(c)}><Ic n="card" /><div><div className="t">{full(c.name)} {c.phasing_out && <span className="tag">parando de usar</span>}</div><div className="d n">fecha {c.closing_day} · vence {c.due_day} · limite {brl(Number(c.limit_amount), false).replace('R$ ', '')}{c.goal != null ? ` · meta ${brl(Number(c.goal), false)}` : ''}</div></div><div className="v">{brl(amt)}<small>{cycleName(key, naming).toLowerCase()}</small></div><More items={editDel(() => cardForm(c), async () => { if (confirm(`Apagar o cartão ${c.name}?`)) await del('cards', c.id) })} /></div> })}
        <Add label="Adicionar cartão" onClick={() => cardForm()} /><div style={{ height: 8 }} />
      </div>
      {cd.bills.filter((b) => b.card.goal > 0).length > 0 && <div className="card"><div className="ch"><h3>Metas dos cartões</h3></div>{cd.bills.filter((b) => b.card.goal > 0).map((b) => <div key={b.card.id + b.due} style={{ padding: '5px 0' }}><div className="row lbl n" style={{ marginBottom: 4 }}><span>{full(b.card.name)}</span><span className="sp">{brl(b.amount, false)} de {brl(Number(b.card.goal), false)}</span></div><Bar thin pct={(b.amount / b.card.goal) * 100} color={b.amount > b.card.goal ? 'var(--neg)' : undefined} /></div>)}</div>}
      <div className="lbl" style={{ textAlign: 'center', marginBottom: 6 }}>Toque em um cartão para mudar fechamento, vencimento, limite ou meta.</div>
    </div>
    {form}
  </>
}
