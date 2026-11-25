import { useData } from '../data'
import { Icon } from '../icons'
import { Header, Seg, EU, Ic, More, editDel, Add, Check, useForm, Empty } from '../ui'
import { addDays, dow, ds, parts } from '../lib/cycle'
import { DOW, ddmm } from '../lib/fmt'
import { sb } from '../lib/sb'

const LV = ['#ECEAE5', '#CFE3DC', '#93C5B6', '#4FA28C', '#0E7C66']
const QUOTES = ['Feito é melhor que perfeito.', 'Um dia de cada vez.', 'Constância vence intensidade.', 'Pequenos passos todo dia.', 'Hoje conta.', 'Começar já é metade.', 'Devagar também é caminho.']
const daysTxt = (d: number[]) => d.length === 7 ? 'todo dia' : d.map((x) => DOW[x]).join(', ')
export default function Habitos() {
  const { db, today, ins, upd, del, updHH, reload, toast } = useData()
  const [form, setForm] = useForm()
  const habits = db!.habits
  const logs = db!.habitLogs
  const logOf = (h: string, d: string) => logs.find((l: any) => l.habit_id === h && l.day === d)
  const grid = habits.filter((h: any) => h.in_grid && (h.kind !== 'phone' || db!.hh.max_phone_hours != null))
  const born = (h: any) => (h.created_at ? new Date(h.created_at).toLocaleDateString('sv-SE') : '2000-01-01')
  const sched = (h: any, d: string) => d >= born(h) && (h.days || []).includes(dow(d))
  const dayStat = (d: string) => {
    const s = grid.filter((h: any) => {
      if (!sched(h, d)) return false
      const l = logOf(h.id, d)
      if (h.kind === 'phone') return !!l // celular só entra quando ela marca Dentro ou Passei
      if (d === today) return !!l?.done // hoje só conta o que já foi feito
      return true
    })
    const n = s.filter((h: any) => logOf(h.id, d)?.done).length
    return { s: s.length, n }
  }
  const pct = (d: string) => { const x = dayStat(d); return x.s ? x.n / x.s : null }
  // semana seg–dom
  const mon = addDays(today, -((dow(today) + 6) % 7)); const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  // sequência: dias com metade ou mais
  let streak = 0; let d0 = (pct(today) ?? 0) >= 0.5 ? today : addDays(today, -1)
  for (let d = d0, i = 0; i < 200; i++, d = addDays(d, -1)) { const p = pct(d); if (p == null) continue; if (p >= 0.5) streak++; else break }
  let rec = 0, run = 0; for (let i = 199; i >= 0; i--) { const p = pct(addDays(today, -i)); if (p == null) continue; if (p >= 0.5) { run++; rec = Math.max(rec, run) } else run = 0 }
  const wk = week.filter((d) => d <= today).map(dayStat).reduce((a, x) => ({ s: a.s + x.s, n: a.n + x.n }), { s: 0, n: 0 })
  const toggle = async (h: any, d: string) => { if (d > today) return; const l = logOf(h.id, d); if (h.kind === 'phone') { await setPhone(h, d, l ? (l.done ? false : null) : true); return } if (l) await del('habitLogs', l.id); else await ins('habitLogs', { habit_id: h.id, day: d, done: true }) }
  const setPhone = async (h: any, d: string, v: boolean | null) => { const l = logOf(h.id, d); if (v == null) { if (l) await del('habitLogs', l.id); return } const { error } = await sb.from('tp_habit_logs').upsert({ habit_id: h.id, day: d, done: v, household_id: db!.hh.id }, { onConflict: 'habit_id,day' }); if (error) toast(error.message); await reload('habitLogs') }
  const habitForm = (h?: any, routine = 'manha') => setForm({ title: h ? 'Editar hábito' : 'Novo hábito', initial: h ? { ...h } : { routine, days: [0, 1, 2, 3, 4, 5, 6], in_grid: true, kind: 'check' }, fields: [
    { k: 'name', label: 'Nome', type: 'text', required: true },
    { k: 'routine', label: 'Quando', type: 'ops', options: [{ v: 'manha', l: 'Manhã' }, { v: 'noite', l: 'Noite' }, { v: 'dia', l: 'Durante o dia' }] },
    { k: 'duration', label: 'Duração (opcional)', type: 'text', placeholder: 'ex.: 20 min' },
    { k: 'days', label: 'Dias', type: 'days' },
    { k: 'in_grid', label: 'Na grade da semana', type: 'toggle', hint: 'Mostrar na grade e contar na sequência' }],
    onSave: async (v) => { if (!v.days?.length) { toast('Escolha pelo menos um dia'); return false } const row = { name: v.name, routine: v.routine, duration: v.duration || '', days: v.days, in_grid: !!v.in_grid }; return h ? upd('habits', h.id, row) : !!(await ins('habits', { ...row, kind: 'check', sort: habits.length + 1 })) },
    onDelete: h ? () => del('habits', h.id) : undefined })
  const phone = habits.find((h: any) => h.kind === 'phone')
  const maxH = db!.hh.max_phone_hours
  const phoneForm = () => setForm({ title: 'Tempo de celular', initial: { h: maxH == null ? '' : String(maxH).replace('.', ',') }, fields: [{ k: 'h', label: 'Máximo de horas por dia', type: 'money', placeholder: 'ex.: 3' }], onSave: (v) => updHH({ max_phone_hours: v.h }) })
  const routine = (r: string, title: string, icon: string, sub: string) => { const list = habits.filter((h: any) => h.routine === r && h.kind === 'check'); const todayL = list.filter((h: any) => sched(h, today)); const n = todayL.filter((h: any) => logOf(h.id, today)?.done).length
    return <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><span style={{ color: 'var(--mut)', marginRight: 6, display: 'grid' }}><Icon n={icon} s={15} /></span><h3>{title}</h3><span className="sp lbl n">{list.length ? `${n} de ${todayL.length} hoje` : sub}</span></div>
      {list.length === 0 && <Empty>Nada ainda. Adicione o primeiro hábito.</Empty>}
      {[...list].sort((a: any, b: any) => Number(sched(b, today)) - Number(sched(a, today))).map((h: any) => { const on = !!logOf(h.id, today)?.done; const s = sched(h, today)
        return <div key={h.id} className={'li tap' + (on ? ' done' : '')} style={{ minHeight: 40, padding: '7px 0', opacity: s ? 1 : 0.55 }} onClick={() => habitForm(h)}>
          {s ? <Check on={on} onClick={() => toggle(h, today)} /> : <div className="ck" style={{ background: 'transparent', borderStyle: 'dashed' }} />}
          <div style={{ minWidth: 0, flex: 1 }}><div className="t">{h.name}</div>{(h.days || []).length < 7 && <div className="d">{s ? '' : 'hoje não · '}{daysTxt(h.days)}</div>}</div><span className="sp lbl n">{h.duration}</span>
          <More items={editDel(() => habitForm(h), async () => { if (confirm(`Apagar "${h.name}"?`)) await del('habits', h.id) })} /></div> })}
      <Add label={`Adicionar à ${title.split(' ').pop()!.toLowerCase()}`} onClick={() => habitForm(undefined, r)} /><div style={{ height: 8 }} /></div> }
  // heatmap 18 semanas
  const startHM = addDays(mon, -17 * 7)
  const cells: { d: string; c: string }[] = []; let sum = 0, cnt = 0
  for (let i = 0; i < 18 * 7; i++) { const d = addDays(startHM, i); if (d > today) { cells.push({ d, c: 'transparent' }); continue } const p = pct(d); if (p != null) { sum += p; cnt++ } cells.push({ d, c: p == null || p === 0 ? LV[0] : p < 0.34 ? LV[1] : p < 0.67 ? LV[2] : p < 1 ? LV[3] : LV[4] }) }
  const pd = parts(today); const quote = QUOTES[(pd.d + pd.m) % QUOTES.length]
  const phoneToday = phone ? logOf(phone.id, today) : null; const phoneY = phone ? logOf(phone.id, addDays(today, -1)) : null
  return <>
    <Header /><div className="ttl">Eu</div><Seg items={EU} />
    <div className="wrap">
      <div className="g2" style={{ marginBottom: 10 }}>
        <div className="stat"><div className="row lbl" style={{ gap: 5 }}><Icon n="flame" s={14} /> Sequência</div><div className="v">{streak} dia{streak === 1 ? '' : 's'}</div><div className="lbl">recorde: {rec}</div></div>
        <div className="stat"><div className="lbl">Constância da semana</div><div className="v">{wk.s ? Math.round((wk.n / wk.s) * 100) : 0}%</div><div className="lbl">“{quote}”</div></div>
      </div>
      <div className="card"><div className="ch"><h3>Semana {ddmm(week[0]).slice(0, 2)}–{ddmm(week[6])}</h3><button type="button" className="sp linkbtn row" style={{ gap: 3 }} onClick={() => habitForm()}><Icon n="plus" s={13} /> Hábito</button></div>
        {grid.length === 0 ? <Empty>Nenhum hábito na grade.</Empty> : <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(7,24px)', gap: '5px 2px', alignItems: 'center' }}>
          <div />{week.map((d) => <div key={d} className="n" style={{ textAlign: 'center', fontSize: 10.5, lineHeight: 1.2, fontWeight: d === today ? 600 : 500, color: d === today ? 'var(--ink)' : 'var(--mut)' }}>{'DSTQQSS'[dow(d)]}<br />{parts(d).d}</div>)}
          {grid.map((h: any) => <div key={h.id} style={{ display: 'contents' }}><div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.2, paddingRight: 4 }}>{h.kind === 'phone' && maxH ? `Máx. ${String(maxH).replace('.', ',')}h de celular` : h.name}</div>
            {week.map((d) => { const l = logOf(h.id, d); const s = sched(h, d); const fut = d > today
              const st: any = { width: 22, height: 22, borderRadius: 6, display: 'grid', placeItems: 'center' }
              const phoneOpen = h.kind === 'phone' && !l
              const pending = d === today || phoneOpen
              return <div key={d} style={{ display: 'grid', placeItems: 'center' }}><button type="button" aria-label={`${h.name} ${d}`} disabled={fut || !s} onClick={() => toggle(h, d)} style={fut || !s ? { ...st, background: '#F1EFEB', opacity: s ? 1 : 0.5 } : l?.done ? { ...st, background: 'var(--acc)', color: '#fff' } : l && !l.done ? { ...st, background: 'var(--negS)' } : pending ? { ...st, border: '1.5px solid #CFCCC5', background: '#fff' } : { ...st, background: 'var(--negS)', opacity: 0.6 }}>{l?.done ? <Icon n="check" s={12} sw={2.6} /> : (!fut && s && !pending) || (l && !l.done) ? <i style={{ width: 8, height: 1.5, background: 'var(--neg)', display: 'block' }} /> : null}</button></div> })}</div>)}
        </div>}
      </div>
      {routine('manha', 'Rotina da manhã', 'sun', '')}
      {routine('noite', 'Rotina da noite', 'moon', 'adicione o que quiser')}
      {habits.some((h: any) => h.routine === 'dia' && h.kind === 'check') && routine('dia', 'Durante o dia', 'clock', '')}
      {phone && <div className="card row">{<Ic n="phone" />}<div className="tap" onClick={phoneForm}><div className="t" style={{ fontWeight: 600 }}>{maxH ? `No máximo ${String(maxH).replace('.', ',')}h de celular` : 'Tempo de celular'}</div><div className="lbl">{maxH ? (phoneY ? `ontem: ${phoneY.done ? 'dentro' : 'passou'}` : 'hoje: como foi?') + ' · você marca à mão' : 'Toque para definir o máximo de horas'}</div></div>
        {maxH ? <div className="sp row" style={{ gap: 5 }}><button type="button" className={'tag ' + (phoneToday?.done ? 'acc' : '')} onClick={() => setPhone(phone, today, phoneToday?.done ? null : true)}>Dentro</button><button type="button" className={'tag ' + (phoneToday && !phoneToday.done ? 'neg' : '')} onClick={() => setPhone(phone, today, phoneToday && !phoneToday.done ? null : false)}>Passei</button></div> : <span className="sp" style={{ color: 'var(--mut2)' }}><Icon n="edit" s={15} /></span>}</div>}
      <div className="card"><div className="ch"><h3>Constância</h3><span className="sp lbl">últimas 18 semanas</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(18,1fr)', gridAutoFlow: 'column', gridTemplateRows: 'repeat(7,1fr)', gap: 2.5 }}>{cells.map((c) => <i key={c.d} title={c.d} style={{ aspectRatio: '1', borderRadius: 2.5, background: c.c }} />)}</div>
        <div className="row lbl" style={{ marginTop: 7, gap: 3, fontSize: 10.5 }}>menos {LV.map((c) => <i key={c} style={{ width: 10, height: 10, borderRadius: 2.5, background: c }} />)} mais<span className="sp n">média {cnt ? Math.round((sum / cnt) * 100) : 0}%</span></div></div>
    </div>
    {form}
  </>
}
void ds
