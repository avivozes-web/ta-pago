import { useMemo } from 'react'
import { useData } from '../data'
import { Header, CycleBanner, Seg, DIN, Ic, More, editDel, Check, Add, Note, Bar, useForm, Empty } from '../ui'
import { cycleData, fixedInCycle } from '../lib/calc'
import { brl, ddmm } from '../lib/fmt'
import { cycleName, cycleRange, diffDays, parts, ds, monthLen, shiftKey } from '../lib/cycle'
import { ICON_NAMES } from '../icons'

const FIX_ICONS: Record<string, string> = { repeat: 'Geral', bolt: 'Luz', drop: 'Água', wifi: 'Internet', phone: 'Celular', church: 'Igreja', globe: 'Missão', house: 'Casa', car: 'Carro', heart: 'Coração', card: 'Cartão', piggy: 'Cofrinho', pill: 'Remédio', cart: 'Mercado' }
export default function Fixos() {
  const { db, key, today, naming, startDay, ins, upd, del, toast } = useData()
  const cd = useMemo(() => cycleData(db, key, today), [db, key, today])
  const [form, setForm] = useForm()
  const list = fixedInCycle(db!.fixed, key)
  const paidBy = Object.fromEntries(cd.paid.map((p: any) => [p.fixed_id, p]))
  const total = list.reduce((s: number, f: any) => s + (paidBy[f.id] ? Number(paidBy[f.id].amount) : Number(f.amount)), 0)
  const paidSum = cd.paid.reduce((s: number, p: any) => s + Number(p.amount), 0)
  const r = cycleRange(key, startDay)
  const dueIn = (f: any) => { if (!f.due_day) return null; const s = parts(r.start); let d = ds(s.y, s.m, Math.min(f.due_day, monthLen(s.y, s.m))); if (d < r.start) { const n = s.m === 12 ? { y: s.y + 1, m: 1 } : { y: s.y, m: s.m + 1 }; d = ds(n.y, n.m, Math.min(f.due_day, monthLen(n.y, n.m))) } return d }
  const toggle = async (f: any) => {
    const p = paidBy[f.id]
    if (p) await del('fixedPaid', p.id)
    else await ins('fixedPaid', { fixed_id: f.id, cycle_key: key, amount: Number(f.amount), paid_on: key === cd.key && cd.isCurrent ? today : (dueIn(f) || r.start) })
  }
  const cycOpts = [key, shiftKey(key, 1)].map((k) => ({ v: k, l: cycleName(k, naming) }))
  const fields = [
    { k: 'name', label: 'Nome', type: 'text' as const, required: true },
    { k: 'amount', label: 'Valor', type: 'money' as const, required: true },
    { k: 'due_day', label: 'Dia do vencimento (opcional)', type: 'number' as const, min: 1, max: 31 },
    { k: 'repeat', label: 'Quando vale', type: 'ops' as const, options: [{ v: 'sempre', l: 'Fixo todo mês' }, { v: 'um', l: 'Só um mês' }] },
    { k: 'only_cycle', label: 'Em qual mês', type: 'select' as const, required: true, options: cycOpts },
    { k: 'variable', label: 'Valor varia', type: 'toggle' as const, hint: 'O valor muda todo mês (ex.: luz)' },
    { k: 'category_id', label: 'Categoria', type: 'select' as const, options: db!.categories.map((c: any) => ({ v: c.id, l: c.name })) },
    { k: 'icon', label: 'Ícone', type: 'select' as const, required: true, options: Object.entries(FIX_ICONS).filter(([i]) => ICON_NAMES.includes(i)).map(([i, l]) => ({ v: i, l })) },
    { k: 'note', label: 'Observação', type: 'text' as const },
  ]
  const openEdit = (f?: any) => setForm({ title: f ? 'Editar gasto' : 'Novo gasto fixo', fields, initial: f ? { ...f, amount: Number(f.amount), due_day: f.due_day ?? '', repeat: f.only_cycle ? 'um' : 'sempre', only_cycle: f.only_cycle || key } : { icon: 'repeat', variable: false, repeat: 'sempre', only_cycle: key },
    show: (v) => ({ only_cycle: v.repeat === 'um', variable: v.repeat !== 'um' }),
    onSave: async (v) => { const row = { name: v.name, amount: v.amount, due_day: v.due_day, variable: v.repeat === 'um' ? false : !!v.variable, only_cycle: v.repeat === 'um' ? (v.only_cycle || key) : null, category_id: v.category_id || null, icon: v.icon || 'repeat', note: v.note || '' }; return f ? upd('fixed', f.id, row) : !!(await ins('fixed', { ...row, sort: db!.fixed.length + 1 })) },
    onDelete: f ? () => del('fixed', f.id) : undefined })
  const thisCycle = (f: any) => { const p = paidBy[f.id]; setForm({ title: `${f.name} · só em ${cycleName(key, naming)}`, fields: [{ k: 'amount', label: 'Valor pago neste ciclo', type: 'money', required: true }, { k: 'paid_on', label: 'Pago em', type: 'date', required: true }], initial: { amount: Number(p?.amount ?? f.amount), paid_on: p?.paid_on || today },
    onSave: async (v) => p ? upd('fixedPaid', p.id, { amount: v.amount, paid_on: v.paid_on }) : !!(await ins('fixedPaid', { fixed_id: f.id, cycle_key: key, amount: v.amount, paid_on: v.paid_on })) }) }
  return <>
    <Header /><div className="ttl">Dinheiro</div><Seg items={DIN} /><CycleBanner />
    <div className="wrap">
      <div className="card"><div className="row"><div><div className="lbl">Gastos fixos de {cycleName(key, naming).toLowerCase()}</div><div className="n" style={{ fontSize: 24, fontWeight: 650, letterSpacing: -0.5 }}>{brl(total)}</div></div><span className="sp tag acc">{cd.paid.filter((p: any) => list.some((f: any) => f.id === p.fixed_id)).length} de {list.length} pagos</span></div>
        <div style={{ margin: '10px 0 6px' }}><Bar pct={total ? (paidSum / total) * 100 : 0} /></div><div className="row lbl n"><span>Pago {brl(paidSum)}</span><span className="sp">A pagar {brl(Math.max(0, total - paidSum))}</span></div></div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {list.length === 0 && <Empty>Nenhum gasto fixo neste mês.</Empty>}
        {list.map((f: any) => { const p = paidBy[f.id]; const due = dueIn(f); const n = due ? diffDays(today, due) : null
          return <div key={f.id} className={'li tap' + (p ? ' done' : '')} onClick={() => openEdit(f)}>
            <Check on={!!p} onClick={() => toggle(f)} /><Ic n={f.icon || 'repeat'} />
            <div style={{ minWidth: 0 }}><div className="t">{f.name}</div><div className="d">{[due ? `vence ${ddmm(due)}` : 'sem dia definido', f.only_cycle ? 'só este mês' : (f.variable && 'valor varia'), f.note].filter(Boolean).join(' · ')}</div></div>
            <div className="v">{f.variable && !p ? '~ ' : ''}{brl(p ? Number(p.amount) : Number(f.amount))}<small>{p ? `pago ${ddmm(p.paid_on)}` : n != null && cd.isCurrent && n >= 0 && n <= 5 ? <span style={{ color: 'var(--warn)' }}>{n === 0 ? 'vence hoje' : `em ${n} dia${n > 1 ? 's' : ''}`}</span> : ''}</small></div>
            <More items={editDel(() => openEdit(f), async () => { if (confirm(`Apagar "${f.name}"?`)) { await del('fixed', f.id); toast('Apagado') } }, [{ label: 'Valor só deste ciclo', icon: 'cal', onClick: () => thisCycle(f) }])} />
          </div> })}
        <Add label="Adicionar gasto fixo ou de um mês" onClick={() => openEdit()} /><div style={{ height: 8 }} />
      </div>
      <Note icon="repeat" t={`No ciclo novo, voltam desmarcados`} d={`O normal é no dia ${startDay}. Se o salário cair antes e o mês novo começar mais cedo, os fixos também recomeçam nesse dia. Marque Paguei quando pagar. Um item “só este mês” aparece só no mês escolhido, não se repete, e entra no comprometido daquele ciclo.`} />
      <Note icon="card" t="Faturas ficam em Cartões" d="Como mudam todo mês, não entram como fixos." />
    </div>
    {form}
  </>
}
