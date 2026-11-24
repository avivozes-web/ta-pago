import { useMemo } from 'react'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, CycleBanner, Seg, DIN, Ic, More, editDel, Add, useForm, Empty } from '../ui'
import { cycleData, txCycleKey } from '../lib/calc'
import { brl, ddmm } from '../lib/fmt'
import { cycleName, shiftKey } from '../lib/cycle'

export default function Investir() {
  const { db, key, today, naming, startDay, ins, upd, del, toast } = useData()
  const cd = useMemo(() => cycleData(db, key, today), [db, key, today])
  const [form, setForm] = useForm()
  const investCat = db!.categories.find((c: any) => c.is_invest)
  const isInv = (t: any) => t.kind === 'saida' && (t.invest_goal_id || (investCat && t.category_id === investCat.id))
  const inv = db!.tx.filter(isInv)
  const saved = (g: any) => Number(g.start_amount) + inv.filter((t: any) => t.invest_goal_id === g.id).reduce((s: number, t: any) => s + Number(t.amount), 0)
  const inCycle = (k: string) => inv.filter((t: any) => txCycleKey(t, startDay, naming) === k)
  const sum = (a: any[]) => a.reduce((s, t) => s + Number(t.amount), 0)
  const thisC = inCycle(key)
  const total = db!.investGoals.reduce((s: number, g: any) => s + saved(g), 0) + sum(inv.filter((t: any) => !t.invest_goal_id))
  const hist = Array.from({ length: 6 }, (_, i) => { const k = shiftKey(key, i - 5); return { k, v: sum(inCycle(k)) } })
  const mx = Math.max(1, ...hist.map((h) => h.v)); const avg = hist.reduce((s, h) => s + h.v, 0) / 6
  const goalForm = (g?: any) => setForm({ title: g ? 'Editar objetivo' : 'Novo objetivo', initial: g ? { ...g, target: Number(g.target), start_amount: Number(g.start_amount) } : {}, fields: [
    { k: 'name', label: 'Objetivo', type: 'text', required: true, placeholder: 'ex.: Reserva de emergência' },
    { k: 'target', label: 'Quanto quer juntar', type: 'money', required: true },
    { k: 'place', label: 'Onde está guardado', type: 'text', placeholder: 'ex.: Tesouro Selic · BB' },
    { k: 'start_amount', label: 'Quanto já tinha antes do app', type: 'money' }],
    onSave: async (v) => { const row = { name: v.name, target: v.target, place: v.place || '', start_amount: v.start_amount ?? 0 }; return g ? upd('investGoals', g.id, row) : !!(await ins('investGoals', { ...row, sort: db!.investGoals.length + 1 })) },
    onDelete: g ? () => del('investGoals', g.id) : undefined })
  const saveForm = (t?: any) => setForm({ title: t ? 'Editar valor guardado' : 'Guardar dinheiro', initial: t ? { ...t, amount: Number(t.amount) } : { invest_goal_id: db!.investGoals[0]?.id || '', date: today, payment: 'pix' }, fields: [
    { k: 'invest_goal_id', label: 'Para qual objetivo', type: 'select', options: db!.investGoals.map((g: any) => ({ v: g.id, l: g.name })) },
    { k: 'amount', label: 'Valor', type: 'money', required: true, positive: true },
    { k: 'date', label: 'Data', type: 'date', required: true }],
    onSave: async (v) => { const g = db!.investGoals.find((x: any) => x.id === v.invest_goal_id); const row = { kind: 'saida', description: g ? `Guardado · ${g.name}` : 'Guardado', amount: v.amount, date: v.date, payment: t?.payment || 'pix', category_id: investCat?.id || null, invest_goal_id: v.invest_goal_id || null }
      const ok = t ? await upd('tx', t.id, row) : !!(await ins('tx', row)); if (ok) toast('Guardado!'); return ok },
    onDelete: t ? () => del('tx', t.id) : undefined })
  const gBy = Object.fromEntries(db!.investGoals.map((g: any) => [g.id, g]))
  return <>
    <Header /><div className="ttl">Dinheiro</div><Seg items={DIN} /><CycleBanner />
    <div className="wrap">
      <div className="g2" style={{ marginBottom: 10 }}>
        <div className="stat"><div className="lbl">Guardado em {cycleName(key, naming).toLowerCase()}</div><div className="v" style={{ color: 'var(--acc)' }}>{brl(sum(thisC))}</div><div className="lbl">{cd.entradas ? `${Math.round((sum(thisC) / cd.entradas) * 100)}% das entradas` : 'sem entradas ainda'}</div></div>
        <div className="stat"><div className="lbl">Total guardado</div><div className="v">{brl(total)}</div><div className="lbl">{db!.investGoals.length} objetivo{db!.investGoals.length === 1 ? '' : 's'}</div></div>
      </div>
      <div className="card" style={{ padding: '12px 14px 2px' }}><div className="ch"><h3>Objetivos</h3></div>
        {db!.investGoals.length === 0 && <Empty>Nenhum objetivo ainda. Ex.: reserva de emergência, viagem.</Empty>}
        {db!.investGoals.map((g: any) => { const v = saved(g); const p = g.target > 0 ? (v / g.target) * 100 : 0; const add = sum(thisC.filter((t: any) => t.invest_goal_id === g.id))
          return <div key={g.id} className="li tap" style={{ display: 'block', padding: '11px 0' }} onClick={() => goalForm(g)}>
            <div className="row"><Ic n="piggy" /><div><div className="t">{g.name}</div><div className="d">{g.place || '—'}</div></div>{add > 0 && <span className="sp tag acc n">+{brl(add, false)}</span>}<span className={add > 0 ? '' : 'sp'} /><More items={editDel(() => goalForm(g), async () => { if (confirm(`Apagar o objetivo "${g.name}"?`)) await del('investGoals', g.id) })} /></div>
            <div className="row n" style={{ margin: '8px 0 5px', fontSize: 12 }}><b style={{ fontWeight: 600 }}>{brl(v, false)}</b><span className="lbl">de {brl(Number(g.target), false)}</span><span className="sp lbl">{Math.round(p)}%</span></div>
            <div className="bar t"><i style={{ width: `${Math.min(100, p)}%` }} /></div>
          </div> })}
        <Add label="Novo objetivo" onClick={() => goalForm()} /><div style={{ height: 8 }} />
      </div>
      <div className="card"><div className="ch"><h3>Últimos 6 ciclos</h3><span className="sp lbl n">média {brl(avg, false)}</span></div>
        <div className="row" style={{ gap: 2 }}>{hist.map((h) => <div key={h.k} style={{ flex: 1, textAlign: 'center' }}><div style={{ height: 64, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><i style={{ display: 'block', width: 22, height: Math.max(2, (h.v / mx) * 60), borderRadius: '5px 5px 2px 2px', background: h.k === key ? 'var(--acc)' : '#CFE3DC' }} /></div><div className="lbl" style={{ marginTop: 4 }}>{cycleName(h.k, naming).slice(0, 3).toLowerCase()}</div></div>)}</div></div>
      <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>Movimentos de {cycleName(key, naming).toLowerCase()}</h3></div>
        {thisC.length === 0 && <Empty>Nada guardado neste ciclo ainda.</Empty>}
        {thisC.map((t: any) => <div key={t.id} className="li tap" onClick={() => saveForm(t)}><div><div className="t">{gBy[t.invest_goal_id]?.name || t.description}</div><div className="d">{ddmm(t.date)}{gBy[t.invest_goal_id]?.place ? ` · ${gBy[t.invest_goal_id].place}` : ''}</div></div><div className="v">{brl(Number(t.amount))}</div><More items={editDel(() => saveForm(t), () => del('tx', t.id))} /></div>)}
      </div>
      <button type="button" className="btn" style={{ width: '100%', marginBottom: 10 }} onClick={() => saveForm()}><Icon n="plus" /> Guardar dinheiro</button>
    </div>
    {form}
  </>
}
