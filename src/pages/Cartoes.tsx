import { useMemo, useState } from 'react'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, CycleBanner, Seg, DIN, Ic, More, editDel, Add, useForm, Empty, Bar, Sheet } from '../ui'
import { cycleData, overdraftPayDate, loanInstallments } from '../lib/calc'
import { brl, ddmm } from '../lib/fmt'
import { cycleName, billCycleKey, billDueFor, addMonthsDate, addDays, cycleRange, cycleKeyOf } from '../lib/cycle'

const full = (n: string) => (n === 'BB' ? 'Banco do Brasil' : n)
function uuid() { return (crypto as any).randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16) }) }
export default function Cartoes() {
  const { db, key, today, naming, startDay, ins, upd, del, toast } = useData()
  const cd = useMemo(() => cycleData(db, key, today), [db, key, today])
  const [form, setForm] = useForm()
  const [info, setInfo] = useState(false)
  const [billCard, setBillCard] = useState<any>(null)
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
  const oldInstForm = () => setForm({ title: 'Compra antiga parcelada', initial: { card_id: main?.id, left: '', next: '', amount: '', description: '', category_id: '' },
    fields: [
      { k: 'description', label: 'O que é', type: 'text', required: true, placeholder: 'ex.: geladeira' },
      { k: 'card_id', label: 'Cartão', type: 'select', required: true, options: cards.map((c: any) => ({ v: c.id, l: full(c.name) })) },
      { k: 'amount', label: 'Valor de cada parcela que falta', type: 'money', required: true, positive: true },
      { k: 'left', label: 'Quantas parcelas faltam', type: 'number', required: true, min: 1, max: 48 },
      { k: 'next', label: 'Próxima parcela vence em', type: 'date', required: true },
      { k: 'category_id', label: 'Categoria', type: 'select', options: db!.categories.map((c: any) => ({ v: c.id, l: c.name })) },
    ],
    saveLabel: 'Lançar parcelas que faltam',
    onSave: async (v) => {
      const card = cards.find((c: any) => c.id === v.card_id); if (!card) { toast('Escolha o cartão'); return false }
      const n = Math.max(1, Number(v.left) || 0); const g = uuid()
      const dueDay = card.due_day
      const dues = Array.from({ length: n }, (_, i) => addMonthsDate(v.next, i, dueDay))
      const r = await ins('tx', dues.map((due, i) => ({ kind: 'saida', description: v.description, amount: v.amount, date: today, category_id: v.category_id || null, payment: 'credito', card_id: card.id, bill_due: due, installment_no: i + 1, installments: n, group_id: g, total_amount: v.amount * n })))
      if (r) toast(`${n} parcela${n > 1 ? 's' : ''} lançada${n > 1 ? 's' : ''} (só as que faltam)`)
      return !!r
    } })
  const loanForm = (L?: any) => setForm({ title: L ? `Empréstimo · ${L.name}` : 'Empréstimo', initial: L ? { ...L, amount: Number(L.amount) } : { name: 'Empréstimo Nubank', amount: '', installments: 3, first_due: '', note: '' },
    fields: [
      { k: 'name', label: 'Nome', type: 'text', required: true, placeholder: 'ex.: Empréstimo Nubank' },
      { k: 'amount', label: 'Valor de cada parcela', type: 'money', required: true, positive: true },
      { k: 'installments', label: 'Quantas parcelas', type: 'number', required: true, min: 1, max: 60 },
      { k: 'first_due', label: 'Vencimento da primeira', type: 'date', required: true, hint: 'As outras caem no mesmo dia nos meses seguintes.' },
      { k: 'note', label: 'Observação', type: 'text' },
    ],
    onSave: async (v) => { const row = { name: v.name, amount: v.amount, installments: v.installments, first_due: v.first_due, note: v.note || '' }; return L ? upd('loans', L.id, row) : !!(await ins('loans', { ...row, sort: (db!.loans || []).length + 1, paid: {} })) },
    onDelete: L ? () => del('loans', L.id) : undefined })
  const toggleLoan = async (inst: any) => {
    const paid = { ...(inst.loan.paid || {}) }
    if (inst.paidOn) delete paid[String(inst.n)]
    else paid[String(inst.n)] = today
    await upd('loans', inst.loan.id, { paid })
  }
  const quick = (c: any, k: string, label: string, money = false) => setForm({ title: `${c.name} · ${label}`, initial: { v: c[k] == null ? '' : Number(c[k]) }, fields: [money ? { k: 'v', label, type: 'money' } : { k: 'v', label, type: 'number', required: true, min: 1, max: 31 }], onSave: (v) => upd('cards', c.id, { [k]: money ? (v.v ?? (k === 'goal' ? null : 0)) : v.v }) })
  const billOf = (c: any) => cd.bills.filter((b) => b.card.id === c.id)
  const future = (c: any) => { const m: Record<string, { due: string; amount: number; n: number; manual: number }> = {}
    db!.tx.filter((t: any) => t.card_id === c.id && t.payment === 'credito' && billCycleKey(t.bill_due, naming) > key).forEach((t: any) => { const x = (m[t.bill_due] = m[t.bill_due] || { due: t.bill_due, amount: 0, n: 0, manual: 0 }); x.amount += Number(t.amount); x.n++ })
    db!.manualBills.filter((b: any) => b.card_id === c.id && billCycleKey(b.due_date, naming) > key).forEach((b: any) => { const x = (m[b.due_date] = m[b.due_date] || { due: b.due_date, amount: 0, n: 0, manual: 0 }); x.amount += Number(b.amount); x.manual++ })
    return Object.values(m).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6) }
  const chip = (c: any, k: string, label: string, val: string, money = false) => <button type="button" onClick={() => quick(c, k, label, money)} style={{ flex: 1, background: 'rgba(255,255,255,.07)', borderRadius: 10, padding: '7px 8px', color: '#fff' }}><div style={{ fontSize: 10, color: 'rgba(255,255,255,.55)' }}>{label}</div><div className="row n" style={{ fontSize: 12.5, fontWeight: 600, gap: 4 }}>{val}<span className="sp" style={{ color: 'rgba(255,255,255,.45)' }}><Icon n="edit" s={12} /></span></div></button>
  const others = cards.filter((c: any) => c.id !== main?.id)
  const manualAll = [...db!.manualBills].filter((b: any) => billCycleKey(b.due_date, naming) === key).sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))
  const cardBy = Object.fromEntries(cards.map((c: any) => [c.id, c]))
  return <>
    <Header /><div className="ttl">Dinheiro</div><Seg items={DIN} /><CycleBanner />
    <div className="wrap">
      {ex && <div className="row" style={{ margin: '0 2px 8px' }}><button type="button" className="tag" style={{ gap: 5 }} onClick={() => setInfo(true)}><Icon n="info" s={13} /> Como funciona</button><span className="sp lbl n">faturas de {cycleName(key, naming).toLowerCase()}</span></div>}
      {main && (() => { const bs = billOf(main); const amt = bs.reduce((s, b) => s + b.amount, 0); const manAmt = bs.reduce((s, b) => s + (b.manual || 0), 0); const appAmt = amt - manAmt; const goal = main.goal != null ? Number(main.goal) : null
        return <div className="card" style={{ background: 'var(--ink)', borderColor: 'var(--ink)', color: '#fff' }}>
          <div className="row"><b style={{ fontSize: 14 }}>{full(main.name)}</b><span className="tag" style={{ background: 'rgba(63,209,169,.15)', color: '#3FD1A9' }}>principal</span><span className="sp" style={{ color: 'rgba(255,255,255,.6)' }}><More items={editDel(() => cardForm(main), async () => { if (confirm(`Apagar o cartão ${main.name}?`)) await del('cards', main.id) })} /></span></div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)', marginTop: 10 }}>{bs.length ? `Fatura que vence ${bs.map((b) => ddmm(b.due)).join(' e ')} · ciclo ${cycleName(key, naming)}` : `Nenhuma fatura vence em ${cycleName(key, naming)}`}</div>
          <div className="n" style={{ fontSize: 26, fontWeight: 650, letterSpacing: -0.5 }}>{brl(amt)}</div>
          <div className="row n" style={{ fontSize: 11.5, color: 'rgba(255,255,255,.65)', marginTop: 4, gap: 8, flexWrap: 'wrap' }}><span>No app {brl(appAmt, false)}</span><span>Antes do app {brl(manAmt, false)}</span><span>Total {brl(amt, false)}</span></div>
          {goal ? <><div style={{ height: 6, borderRadius: 9, background: 'rgba(255,255,255,.12)', margin: '8px 0 5px', overflow: 'hidden' }}><i style={{ display: 'block', width: `${Math.min(100, (amt / goal) * 100)}%`, height: '100%', background: amt > goal ? '#E58A7F' : '#3FD1A9', borderRadius: 9 }} /></div>
            <div className="row n" style={{ fontSize: 11.5, color: 'rgba(255,255,255,.65)' }}><span>{Math.round((amt / goal) * 100)}% da meta</span><span className="sp">disponível {brl(Math.max(0, Number(main.limit_amount) - amt))}</span></div></> : null}
          <div className="row" style={{ gap: 6, marginTop: 10 }}>{chip(main, 'closing_day', 'Fecha', `dia ${main.closing_day}`)}{chip(main, 'due_day', 'Vence', `dia ${main.due_day}`)}{chip(main, 'limit_amount', 'Limite', brl(Number(main.limit_amount), false).replace('R$ ', ''), true)}{chip(main, 'goal', 'Meta', main.goal == null ? '—' : brl(Number(main.goal), false).replace('R$ ', ''), true)}</div>
          <button type="button" onClick={() => setBillCard(main)} style={{ marginTop: 12, width: '100%', background: 'rgba(255,255,255,.1)', color: '#fff', borderRadius: 10, padding: '9px 10px', fontSize: 13, fontWeight: 600 }}>Ver as compras desta fatura</button>
        </div> })()}
      {(db!.overdraft || []).map((o: any) => { const used = Number(o.used_amount); const lim = Number(o.limit_amount); const pd = overdraftPayDate(o, today, startDay)
        const odForm = () => setForm({ title: o.name, initial: { used_amount: used || '', limit_amount: lim, pay_date: pd, name: o.name }, fields: [
          { k: 'used_amount', label: 'Quanto está usado agora', type: 'money', hint: 'Digite o valor usado. Ele entra como conta a pagar.' },
          { k: 'pay_date', label: 'Vai ser pago em', type: 'date', required: true, hint: `Padrão: no próximo salário (dia ${startDay}).` },
          { k: 'limit_amount', label: 'Limite', type: 'money', required: true },
          { k: 'name', label: 'Nome', type: 'text', required: true }],
          onSave: (v) => { if ((v.used_amount || 0) > v.limit_amount) { toast('O usado passou do limite. Confira o valor.'); } return upd('overdraft', o.id, { used_amount: v.used_amount || 0, limit_amount: v.limit_amount, pay_date: v.pay_date, name: v.name }) } })
        const paid = async () => { if (!used) return; if (!confirm(`Marcar ${brl(used)} do ${o.name} como pago hoje? O valor vai para o extrato e o usado volta para zero.`)) return
          const cat = db!.categories.find((c: any) => /contas/i.test(c.name))
          const r = await ins('tx', { kind: 'saida', description: o.name, amount: used, date: today, payment: 'pix', category_id: cat?.id || null })
          if (r) { await upd('overdraft', o.id, { used_amount: 0, pay_date: null }); toast('Cheque especial zerado') } }
        return <div key={o.id} className="card tap" onClick={odForm}>
          <div className="ch"><Ic n="alert" /><div style={{ marginLeft: 10 }}><h3>{o.name}</h3><div className="lbl n">limite {brl(lim, false)} · {used ? `pagar em ${ddmm(pd)} (ciclo ${cycleName(cycleKeyOf(pd, startDay), naming)})` : 'nada usado'}</div></div><b className="sp n" style={{ fontSize: 16, whiteSpace: 'nowrap', color: used ? 'var(--neg)' : undefined }}>{brl(used)}</b></div>
          <Bar thin pct={lim ? (used / lim) * 100 : 0} color={used ? 'var(--neg)' : undefined} />
          <div className="row" style={{ gap: 6, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn l" style={{ flex: 1, padding: 9, fontSize: 12.5 }} onClick={odForm}><Icon n="edit" /> Usei / mudar valor</button>
            <button type="button" className="btn" style={{ flex: 1, padding: 9, fontSize: 12.5 }} disabled={!used} onClick={paid}><Icon n="check" /> Paguei</button>
          </div>
        </div> })}
      {main && <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>Próximas faturas</h3><span className="sp lbl">{main.name} · já lançadas</span></div>
        {future(main).length === 0 && <Empty>Nada lançado para os próximos ciclos.</Empty>}
        {future(main).map((f) => <div key={f.due} className="li"><div><div className="t">{ddmm(f.due)} · {cname(f.due)}</div><div className="d">{[f.n && `${f.n} parcela${f.n > 1 ? 's' : ''}`, f.manual && 'digitada à mão'].filter(Boolean).join(' · ')}</div></div><div className="v">{brl(f.amount)}</div></div>)}
      </div>}
      <div className="card" style={{ padding: '12px 14px 6px' }}><div className="ch"><h3>Já tinha faturas antes do app?</h3></div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 6 }}>Só as faturas de {cycleName(key, naming).toLowerCase()}. Para ver outro mês, troque o mês lá em cima. Digite o valor da fatura (parcelas antigas entram no mês em que vencem).</div>
        {manualAll.map((b: any) => <div key={b.id} className="li tap" onClick={() => billForm(b)}><Ic n="card" /><div><div className="t">{full(cardBy[b.card_id]?.name || '')} · vence {ddmm(b.due_date)}</div><div className="d">ciclo {cname(b.due_date)}{b.note ? ` · ${b.note}` : ''}</div></div><div className="v">{brl(Number(b.amount))}<small><span className="tag">manual</span></small></div><More items={editDel(() => billForm(b), () => del('manualBills', b.id))} /></div>)}
        <Add label="Lançar fatura manualmente" onClick={() => billForm()} /><div style={{ height: 6 }} />
      </div>
      <div className="card" style={{ padding: '12px 14px 6px' }}><div className="ch"><h3>Parcelas antigas e empréstimo</h3></div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 6 }}>Compra que já existia antes do app: lance só as parcelas que ainda faltam. Empréstimo (ex.: Nubank em dez, jan e fev) aparece no mês certo, com o botão Paguei.</div>
        {(db!.loans || []).map((L: any) => { const insts = loanInstallments(L); const open = insts.filter((x: any) => !x.paidOn)
          return <div key={L.id} className="li" style={{ display: 'block' }}>
            <div className="row tap" onClick={() => loanForm(L)}><Ic n="card" /><div style={{ minWidth: 0, flex: 1 }}><div className="t">{L.name}</div><div className="d">{L.installments}x de {brl(Number(L.amount), false)} · 1ª em {ddmm(L.first_due)}{open.length ? ` · faltam ${open.length}` : ' · quitado'}</div></div><More items={editDel(() => loanForm(L), async () => { if (confirm(`Apagar "${L.name}"?`)) await del('loans', L.id) })} /></div>
            {insts.map((x: any) => { const inC = cycleKeyOf(x.due, startDay) === key; return <div key={x.n} className={'li' + (x.paidOn ? ' done' : '')} style={{ paddingLeft: 8, opacity: inC ? 1 : 0.7 }}><div style={{ minWidth: 0, flex: 1 }}><div className="t">{x.n}/{L.installments} · vence {ddmm(x.due)} · {cycleName(cycleKeyOf(x.due, startDay), naming)}</div><div className="d">{x.paidOn ? `pago ${ddmm(x.paidOn)}` : inC ? 'neste ciclo' : 'outro mês'}</div></div><div className="v">{brl(x.amount)}</div><button type="button" className={'tag' + (x.paidOn ? ' acc' : '')} onClick={() => toggleLoan(x)}>{x.paidOn ? 'Pago' : 'Paguei'}</button></div> })}
          </div> })}
        <Add label="Compra antiga parcelada" onClick={() => oldInstForm()} />
        <Add label="Novo empréstimo" onClick={() => loanForm()} /><div style={{ height: 6 }} />
      </div>
      <div className="sec">Outros cartões</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {others.map((c: any) => { const amt = billOf(c).reduce((s, b) => s + b.amount, 0); return <div key={c.id} className="li tap" onClick={() => setBillCard(c)}><Ic n="card" /><div><div className="t">{full(c.name)} {c.phasing_out && <span className="tag">parando de usar</span>}</div><div className="d n">fecha {c.closing_day} · vence {c.due_day} · limite {brl(Number(c.limit_amount), false).replace('R$ ', '')}{c.goal != null ? ` · meta ${brl(Number(c.goal), false)}` : ''}</div></div><div className="v">{brl(amt)}<small>{cycleName(key, naming).toLowerCase()}</small></div><More items={editDel(() => cardForm(c), async () => { if (confirm(`Apagar o cartão ${c.name}?`)) await del('cards', c.id) })} /></div> })}
        <Add label="Adicionar cartão" onClick={() => cardForm()} /><div style={{ height: 8 }} />
      </div>
      {cd.bills.filter((b) => b.card.goal > 0).length > 0 && <div className="card"><div className="ch"><h3>Metas dos cartões</h3></div>{cd.bills.filter((b) => b.card.goal > 0).map((b) => <div key={b.card.id + b.due} style={{ padding: '5px 0' }}><div className="row lbl n" style={{ marginBottom: 4 }}><span>{full(b.card.name)}</span><span className="sp">{brl(b.amount, false)} de {brl(Number(b.card.goal), false)}</span></div><Bar thin pct={(b.amount / b.card.goal) * 100} color={b.amount > b.card.goal ? 'var(--neg)' : undefined} /></div>)}</div>}
      <div className="lbl" style={{ textAlign: 'center', marginBottom: 6 }}>Toque em um cartão para mudar fechamento, vencimento, limite ou meta.</div>
    </div>
    {info && ex && <Sheet title="Como funciona a fatura" onClose={() => setInfo(false)}>
      <div className="card" style={{ background: 'var(--accS)', borderColor: '#CFE5DD', marginBottom: 10 }}>
        <div className="row" style={{ marginBottom: 8 }}><span style={{ color: 'var(--acc)' }}><Icon n="info" s={16} /></span><b style={{ fontSize: 13 }}>A fatura entra no ciclo do mês em que vence</b></div>
        <div className="row" style={{ background: '#fff', borderRadius: 10, padding: '9px 6px', gap: 2 }}>
          {[[`${ddmm(ex.from)} a ${ddmm(ex.close)}`, 'compras'], [ddmm(ex.close), 'fecha'], [ddmm(ex.due), 'vence'], [cycleName(ex.k, naming), `${ddmm(ex.r.start)} – ${ddmm(ex.r.end)}`]].map(([a, b], i) => <div key={i} style={{ display: 'contents' }}>{i > 0 && <span style={{ color: 'var(--mut2)', flex: 'none' }}><Icon n="right" s={14} /></span>}<div style={{ flex: 1, textAlign: 'center' }}><div className="n" style={{ fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap', color: i === 3 ? 'var(--acc)' : undefined }}>{a}</div><div className="lbl" style={{ fontSize: 10.5, lineHeight: 1.25 }}>{b}</div></div></div>)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 8 }}>A fatura do {full(main.name)} que vence {ddmm(ex.due)} é paga com o adiantamento do salário de {cycleName(ex.k, naming).toLowerCase()}, por isso entra no ciclo <b>{cycleName(ex.k, naming)}</b>. Compras a partir de {ddmm(ex.nextFrom)} vão para a fatura de {ddmm(ex.nextDue)}, que entra em <b>{cname(ex.nextDue)}</b>.</div>
      </div>
      <button type="button" className="btn" onClick={() => setInfo(false)}>Entendi</button>
    </Sheet>}
    {billCard && (() => {
      const c = billCard
      const bs = billOf(c)
      const rows: { id: string; t: string; d: string; v: number; manual: boolean }[] = []
      bs.forEach((b) => b.items.forEach((it: any) => {
        const manual = !it.payment
        rows.push({ id: it.id, t: manual ? (it.note ? it.note : 'Fatura de antes do app') : it.description, d: manual ? `digitada à mão · vence ${ddmm(it.due_date)}` : [it.installments > 1 ? `${it.installment_no}/${it.installments}` : null, it.bill_due ? `vence ${ddmm(it.bill_due)}` : null].filter(Boolean).join(' · '), v: Number(it.amount), manual })
      }))
      const appAmt = rows.filter((r) => !r.manual).reduce((s, r) => s + r.v, 0)
      const manAmt = rows.filter((r) => r.manual).reduce((s, r) => s + r.v, 0)
      const tot = appAmt + manAmt
      return <Sheet title={`Fatura · ${full(c.name)}`} onClose={() => setBillCard(null)}>
        <div className="lbl" style={{ marginBottom: 8 }}>Ciclo {cycleName(key, naming)}{bs.length ? ` · vence ${bs.map((b) => ddmm(b.due)).join(' e ')}` : ''}</div>
        <div className="g3" style={{ marginBottom: 10 }}>
          <div className="stat"><div className="lbl">No app</div><div className="v" style={{ fontSize: 14 }}>{brl(appAmt, false)}</div></div>
          <div className="stat"><div className="lbl">Antes do app</div><div className="v" style={{ fontSize: 14 }}>{brl(manAmt, false)}</div></div>
          <div className="stat"><div className="lbl">Total</div><div className="v" style={{ fontSize: 14 }}>{brl(tot, false)}</div></div>
        </div>
        {appAmt > 0 && manAmt > 0 && <div className="note warn" style={{ marginBottom: 10 }}><Icon n="alert" /><div className="d">Os dois valores estão somados no total. Se o que você digitou já é o valor do banco (e inclui compras lançadas no app), está repetido.</div></div>}
        <div className="card" style={{ padding: '2px 14px' }}>
          {rows.length === 0 && <Empty>Nenhuma compra nesta fatura de {cycleName(key, naming).toLowerCase()}.</Empty>}
          {rows.map((r) => <div key={r.id} className="li"><div style={{ minWidth: 0 }}><div className="t">{r.t}</div><div className="d">{r.d}{r.manual ? ' · antes do app' : ''}</div></div><div className="v">{brl(r.v)}</div></div>)}
        </div>
      </Sheet>
    })()}
    {form}
  </>
}
