import { useState } from 'react'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, Seg, CASA, More, editDel, Add, Check, Note, useForm, Empty } from '../ui'
import { addDays, dow, diffDays, parts, monthLen } from '../lib/cycle'
import { DOW, DOW_LONG, ddmm } from '../lib/fmt'

const FQ: Record<string, string> = { diaria: 'Diária', semanal: 'Semanal', quinzenal: 'A cada 15 dias', mensal: 'Mensal', urgente: 'Urgente' }
const born = (t: any) => (t.created_at ? new Date(t.created_at).toLocaleDateString('sv-SE') : t.anchor_date)
export function occurs(t: any, d: string) {
  if (d < born(t)) return false
  switch (t.freq) {
    case 'diaria': return true
    case 'semanal': return dow(d) === (t.weekday ?? dow(t.anchor_date))
    case 'quinzenal': { const n = diffDays(t.anchor_date, d); return n >= 0 && n % 14 === 0 }
    case 'mensal': { const p = parts(d); return p.d === Math.min(t.month_day ?? parts(t.anchor_date).d, monthLen(p.y, p.m)) }
    default: return false
  }
}
export default function Tarefas() {
  const { db, today, ins, upd, del } = useData()
  const [form, setForm] = useForm()
  const [sel, setSel] = useState(today); const [chip, setChip] = useState('todas')
  const tasks = db!.tasks; const done = db!.taskDone
  const isDone = (t: any, d: string) => done.find((x: any) => x.task_id === t.id && x.day === d)
  // tarefa não feita passa para o dia seguinte (até ser feita ou até a próxima vez dela)
  const carried = (t: any, d: string) => {
    if (t.freq === 'diaria' || t.freq === 'urgente' || occurs(t, d)) return null
    for (let i = 1; i <= 31; i++) { const o = addDays(d, -i); if (o < born(t)) return null; if (occurs(t, o)) return isDone(t, o) ? null : o }
    return null
  }
  const dayList = (d: string) => tasks.filter((t: any) => t.freq !== 'urgente').map((t: any) => occurs(t, d) ? { t, occ: d, from: null as string | null } : d <= today ? (() => { const o = carried(t, d); return o ? { t, occ: o, from: o } : null })() : null).filter(Boolean) as { t: any; occ: string; from: string | null }[]
  const mon = addDays(today, -((dow(today) + 6) % 7)); const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  const list = dayList(sel).filter((x) => chip === 'todas' || x.t.freq === chip)
  const urg = tasks.filter((t: any) => t.freq === 'urgente' && !isDone(t, t.due_date || born(t)))
  const toggle = async (t: any, occ: string) => { const x = isDone(t, occ); if (x) await del('taskDone', x.id); else await ins('taskDone', { task_id: t.id, day: occ, done_on: today }) }
  const taskForm = (t?: any, freq = 'semanal') => setForm({ title: t ? 'Editar tarefa' : freq === 'urgente' ? 'Nova urgência' : 'Nova tarefa', initial: t ? { ...t } : { freq, weekday: dow(sel), month_day: parts(sel).d, anchor_date: sel, due_date: addDays(today, 2) }, fields: [
    { k: 'name', label: 'Tarefa', type: 'text', required: true },
    { k: 'freq', label: 'Frequência', type: 'select', required: true, options: Object.entries(FQ).map(([v, l]) => ({ v, l })) },
    { k: 'weekday', label: 'Dia da semana', type: 'select', required: true, options: DOW_LONG.map((l, v) => ({ v, l })) },
    { k: 'anchor_date', label: 'A partir de', type: 'date', required: true, hint: 'Repete a cada 14 dias a partir desta data.' },
    { k: 'month_day', label: 'Dia do mês', type: 'number', required: true, min: 1, max: 31 },
    { k: 'due_date', label: 'Até quando', type: 'date', required: true }],
    show: (v) => ({ weekday: v.freq === 'semanal', anchor_date: v.freq === 'quinzenal', month_day: v.freq === 'mensal', due_date: v.freq === 'urgente' }),
    onSave: async (v) => { const row = { name: v.name, freq: v.freq, weekday: v.freq === 'semanal' ? Number(v.weekday) : null, anchor_date: v.freq === 'quinzenal' ? v.anchor_date : (t?.anchor_date || today), month_day: v.freq === 'mensal' ? v.month_day : null, due_date: v.freq === 'urgente' ? v.due_date : null }; return t ? upd('tasks', t.id, row) : !!(await ins('tasks', { ...row, sort: tasks.length + 1 })) },
    onDelete: t ? () => del('tasks', t.id) : undefined })
  const sub = (t: any) => t.freq === 'semanal' ? `toda ${DOW_LONG[t.weekday ?? 0]}` : t.freq === 'mensal' ? `dia ${t.month_day}` : t.freq === 'quinzenal' ? `desde ${ddmm(t.anchor_date)}` : ''
  const counts = Object.fromEntries(['diaria', 'semanal', 'quinzenal', 'mensal'].map((f) => [f, tasks.filter((t: any) => t.freq === f).length]))
  const nDone = list.filter((x) => isDone(x.t, x.occ)).length
  return <>
    <Header /><div className="ttl">Casa</div><Seg items={CASA} />
    <div className="wrap">
      <div className="row" style={{ gap: 4, marginBottom: 10 }}>{week.map((d) => { const l = dayList(d); const n = l.filter((x) => isDone(x.t, x.occ)).length; const on = d === sel
        return <button type="button" key={d} className={'daybtn' + (on ? ' on' : '')} onClick={() => setSel(d)}><div style={{ fontSize: 10.5, opacity: on ? 0.7 : 1, color: on ? undefined : 'var(--mut)' }}>{DOW[dow(d)]}</div><div className="n" style={{ fontWeight: 600, fontSize: 14 }}>{parts(d).d}</div><div className="n" style={{ fontSize: 10, opacity: on ? 0.7 : 1, color: on ? undefined : 'var(--mut)' }}>{d <= today ? `${n}/${l.length}` : l.length}</div></button> })}</div>
      <div className="card" style={{ padding: '12px 14px 4px', borderColor: '#F0D2CC' }}><div className="ch"><span style={{ color: 'var(--neg)', marginRight: 6, display: 'grid' }}><Icon n="alert" s={15} /></span><h3>Urgências</h3></div>
        {urg.length === 0 && <Empty>Nada urgente.</Empty>}
        {urg.map((t: any) => <div key={t.id} className="li tap" onClick={() => taskForm(t)}><Check on={false} onClick={() => ins('taskDone', { task_id: t.id, day: t.due_date || born(t), done_on: today })} /><div className="t">{t.name}</div><span className={'sp lbl'} style={t.due_date && t.due_date < today ? { color: 'var(--neg)' } : undefined}>{t.due_date ? `até ${DOW[dow(t.due_date)]} ${ddmm(t.due_date)}` : ''}</span><More items={editDel(() => taskForm(t), () => del('tasks', t.id))} /></div>)}
        <Add label="Adicionar urgência" onClick={() => taskForm(undefined, 'urgente')} /><div style={{ height: 8 }} /></div>
      <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>{sel === today ? 'Hoje' : DOW_LONG[dow(sel)][0].toUpperCase() + DOW_LONG[dow(sel)].slice(1)} · {DOW_LONG[dow(sel)]}, {ddmm(sel)}</h3><span className="sp lbl">{nDone} de {list.length}</span></div>
        {list.length === 0 && <Empty>{tasks.length ? 'Nenhuma tarefa neste dia.' : 'Nenhuma tarefa ainda. Adicione as tarefas da casa e quando se repetem.'}</Empty>}
        {list.map((x) => { const on = !!isDone(x.t, x.occ); return <div key={x.t.id} className={'li tap' + (on ? ' done' : '')} onClick={() => taskForm(x.t)}>
          <Check on={on} onClick={() => (sel <= today ? toggle(x.t, x.occ) : undefined)} />
          <div style={{ flex: 1 }}><div className="t">{x.t.name}</div><div className="row" style={{ gap: 5, marginTop: 3, flexWrap: 'wrap' }}><span className="tag">{FQ[x.t.freq]}</span>{sub(x.t) && <span className="lbl">{sub(x.t)}</span>}{x.from && <span className="tag warn">{diffDays(x.from, sel) === 1 ? 'veio de ontem' : `veio de ${DOW_LONG[dow(x.from)]}`}</span>}</div></div>
          <More items={editDel(() => taskForm(x.t), async () => { if (confirm(`Apagar "${x.t.name}"?`)) await del('tasks', x.t.id) })} /></div> })}
        <Add label="Adicionar tarefa" onClick={() => taskForm()} /><div style={{ height: 8 }} /></div>
      <div className="chips" style={{ overflowX: 'auto' }}>{[['todas', `Todas ${tasks.filter((t: any) => t.freq !== 'urgente').length}`], ['diaria', `Diárias ${counts.diaria}`], ['semanal', `Semanais ${counts.semanal}`], ['quinzenal', `15 dias ${counts.quinzenal}`], ['mensal', `Mensais ${counts.mensal}`]].map(([k, l]) => <span key={k} className={'tap ' + (chip === k ? 'on' : '')} onClick={() => setChip(k)}>{l}</span>)}</div>
      <Note icon="repeat" t="Não deu? Vai para o dia seguinte" d="Tarefa não feita passa sozinha para o próximo dia, com a etiqueta “veio de ontem”." />
    </div>
    {form}
  </>
}
