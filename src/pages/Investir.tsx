import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, CycleBanner, Seg, DIN, Ic, More, editDel, Add, useForm, Empty, Check, Bar, Note } from '../ui'
import { cycleData, txCycleKey } from '../lib/calc'
import { brl, ddmm } from '../lib/fmt'
import { cycleName, shiftKey } from '../lib/cycle'
import { projection, monthGoalDone, parseMonthGoal, goalMonthlyProgress } from '../lib/plan'

export default function Investir() {
  const nav = useNavigate()
  const { db, key, today, naming, startDay, ins, upd, del, updHH, toast } = useData()
  const cd = useMemo(() => cycleData(db, key, today), [db, key, today])
  const [form, setForm] = useForm()
  const [hz, setHz] = useState<3 | 6 | 12>(3)
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
  const plan = useMemo(() => projection(db, key, today, hz), [db, key, today, hz])
  const monthGoals = (db!.monthGoals || []).filter((g: any) => g.cycle_key === key)
  const inbox = Array.isArray(db!.hh.buy_inbox) ? db!.hh.buy_inbox : []
  const remind = inbox.filter((x: any) => x.kind === 'amanha' && x.created && x.created < today)
  const skippedMoney = inbox.filter((x: any) => x.kind === 'desisti')

  const deadlineOpts = Array.from({ length: 24 }, (_, i) => { const k = shiftKey(key, i); return { v: k, l: `${cycleName(k, naming)} ${k.slice(0, 4)}` } })
  const goalForm = (g?: any) => setForm({ title: g ? 'Editar objetivo' : 'Novo objetivo', initial: g ? { ...g, target: Number(g.target), start_amount: Number(g.start_amount), monthly_amount: g.monthly_amount != null ? Number(g.monthly_amount) : '', deadline: g.deadline || '' } : {}, fields: [
    { k: 'name', label: 'Objetivo', type: 'text', required: true, placeholder: 'ex.: Reserva de emergência' },
    { k: 'target', label: 'Quanto quer juntar', type: 'money', required: true },
    { k: 'deadline', label: 'Prazo (opcional)', type: 'select', options: deadlineOpts, hint: 'Se tiver prazo, o app mostra o progresso mês a mês e quanto falta por mês.' },
    { k: 'monthly_amount', label: 'Guardar por mês (opcional)', type: 'money' },
    { k: 'place', label: 'Onde está guardado', type: 'text', placeholder: 'ex.: Tesouro Selic · BB' },
    { k: 'start_amount', label: 'Quanto já tinha antes do app', type: 'money' }],
    onSave: async (v) => { const row = { name: v.name, target: v.target, place: v.place || '', start_amount: v.start_amount ?? 0, deadline: v.deadline || null, monthly_amount: v.monthly_amount || null }; return g ? upd('investGoals', g.id, row) : !!(await ins('investGoals', { ...row, sort: db!.investGoals.length + 1 })) },
    onDelete: g ? () => del('investGoals', g.id) : undefined })
  const saveForm = (t?: any) => setForm({ title: t ? 'Editar valor guardado' : 'Guardar dinheiro', initial: t ? { ...t, amount: Number(t.amount) } : { invest_goal_id: db!.investGoals[0]?.id || '', date: today, payment: 'pix' }, fields: [
    { k: 'invest_goal_id', label: 'Para qual objetivo', type: 'select', options: db!.investGoals.map((g: any) => ({ v: g.id, l: g.name })) },
    { k: 'amount', label: 'Valor', type: 'money', required: true, positive: true },
    { k: 'date', label: 'Data', type: 'date', required: true }],
    onSave: async (v) => { const g = db!.investGoals.find((x: any) => x.id === v.invest_goal_id); const row = { kind: 'saida', description: g ? `Guardado · ${g.name}` : 'Guardado', amount: v.amount, date: v.date, payment: t?.payment || 'pix', category_id: investCat?.id || null, invest_goal_id: v.invest_goal_id || null }
      const ok = t ? await upd('tx', t.id, row) : !!(await ins('tx', row)); if (ok) toast('Guardado!'); return ok },
    onDelete: t ? () => del('tx', t.id) : undefined })
  const monthForm = (g?: any) => setForm({ title: g ? 'Editar meta do mês' : 'Nova meta do mês', initial: g ? { ...g, target: g.target != null ? Number(g.target) : '' } : { kind: 'guardar' },
    fields: [
      { k: 'name', label: 'Meta', type: 'text', required: true, placeholder: 'ex.: Guardar R$ 800 em ' + cycleName(key, naming).toLowerCase() },
      { k: 'kind', label: 'Tipo', type: 'ops', options: [{ v: 'guardar', l: 'Guardar' }, { v: 'gastar_menos', l: 'Gastar menos' }, { v: 'livre', l: 'Outra' }] },
      { k: 'target', label: 'Valor (opcional)', type: 'money' },
    ],
    onSave: async (v) => {
      if (!g && monthGoals.length >= 2) toast('Recomendamos 2 metas por mês. Você ainda pode criar esta, se quiser.')
      const parsed = parseMonthGoal(v.name, v.kind, v.target)
      const row = { name: v.name, kind: parsed.kind, target: parsed.target, cycle_key: key }
      return g ? upd('monthGoals', g.id, row) : !!(await ins('monthGoals', { ...row, sort: monthGoals.length + 1 }))
    },
    onDelete: g ? () => del('monthGoals', g.id) : undefined })
  const toggleMonth = async (g: any) => {
    const st = monthGoalDone(g, db, key)
    if (st.done && !g.done_manual) return upd('monthGoals', g.id, { skipped: true, done_manual: false })
    if (g.done_manual || g.skipped) return upd('monthGoals', g.id, { done_manual: false, skipped: false })
    return upd('monthGoals', g.id, { done_manual: true, skipped: false })
  }
  const dismissInbox = (item: any) => updHH({ buy_inbox: inbox.filter((x: any) => !(x.kind === item.kind && x.created === item.created && x.name === item.name && x.amount === item.amount)) })
  const gBy = Object.fromEntries(db!.investGoals.map((g: any) => [g.id, g]))
  return <>
    <Header /><div className="ttl">Dinheiro</div><Seg items={DIN} /><CycleBanner />
    <div className="wrap">
      <button type="button" className="btn" style={{ width: '100%', marginBottom: 10 }} onClick={() => nav('/dinheiro/posso-comprar')}><Icon n="sparkle" /> Posso comprar?</button>

      {remind.map((x: any, i: number) => <div key={'r'+i} className="note" style={{ marginBottom: 8 }}><Icon n="cal" /><div style={{ minWidth: 0, flex: 1 }}><div className="t">Você ia decidir sobre {x.name}</div><div className="d">{brl(Number(x.amount) || 0)} · deixou para pensar com calma</div></div><button type="button" className="tag acc" onClick={() => nav('/dinheiro/posso-comprar')}>Abrir</button><button type="button" className="tag" onClick={() => dismissInbox(x)}>Ok</button></div>)}

      <div className="g2" style={{ marginBottom: 10 }}>
        <div className="stat"><div className="lbl">Guardado em {cycleName(key, naming).toLowerCase()}</div><div className="v" style={{ color: 'var(--acc)' }}>{brl(sum(thisC))}</div><div className="lbl">{cd.entradas ? `${Math.round((sum(thisC) / cd.entradas) * 100)}% das entradas` : 'sem entradas ainda'}</div></div>
        <div className="stat"><div className="lbl">Total guardado</div><div className="v">{brl(total)}</div><div className="lbl">{db!.investGoals.length} objetivo{db!.investGoals.length === 1 ? '' : 's'}</div></div>
      </div>

      <div className="card" style={{ padding: '12px 14px 2px' }}><div className="ch"><h3>Metas de {cycleName(key, naming).toLowerCase()}</h3></div>
        <div className="lbl" style={{ margin: '-2px 0 8px' }}>Recomendamos 2 metas por mês. Você mesma marca quando cumprir; se for uma meta de guardar, o app também marca sozinho quando vir que você guardou.</div>
        {monthGoals.length === 0 && <Empty>Nenhuma meta neste mês. Ex.: guardar R$ 800 em {cycleName(key, naming).toLowerCase()}.</Empty>}
        {monthGoals.map((g: any) => { const st = monthGoalDone(g, db, key); const parsed = parseMonthGoal(g.name, g.kind, g.target)
          return <div key={g.id} className={'li' + (st.done ? ' done' : '')}><Check on={st.done} onClick={() => toggleMonth(g)} /><div style={{ minWidth: 0, flex: 1 }} className="tap" onClick={() => monthForm(g)}><div className="t">{g.name}</div><div className="d">{[parsed.kind === 'guardar' ? 'guardar' : parsed.kind === 'gastar_menos' ? 'gastar menos' : 'livre', parsed.target ? brl(parsed.target, false) : null, st.auto ? 'marcada sozinha' : null].filter(Boolean).join(' · ')}</div></div><More items={editDel(() => monthForm(g), async () => { if (confirm(`Apagar a meta "${g.name}"?`)) await del('monthGoals', g.id) })} /></div> })}
        <Add label="Nova meta do mês" onClick={() => monthForm()} /><div style={{ height: 8 }} />
      </div>

      <div className="card" style={{ padding: '12px 14px 2px' }}><div className="ch"><h3>Objetivos</h3></div>
        {db!.investGoals.length === 0 && <Empty>Nenhum objetivo ainda. Ex.: reserva de emergência, viagem.</Empty>}
        {db!.investGoals.map((g: any) => { const pr = goalMonthlyProgress(db, g, key); const add = sum(thisC.filter((t: any) => t.invest_goal_id === g.id))
          const barColor = pr.pct >= 100 ? undefined : pr.pct >= 90 ? 'var(--warn)' : undefined
          return <div key={g.id} className="li tap" style={{ display: 'block', padding: '11px 0' }} onClick={() => goalForm(g)}>
            <div className="row"><Ic n="piggy" /><div><div className="t">{g.name}</div><div className="d">{[g.place || null, g.deadline ? `até ${cycleName(g.deadline, naming)}` : null].filter(Boolean).join(' · ') || '—'}</div></div>{add > 0 && <span className="sp tag acc n">+{brl(add, false)}</span>}<span className={add > 0 ? '' : 'sp'} /><More items={editDel(() => goalForm(g), async () => { if (confirm(`Apagar o objetivo "${g.name}"?`)) await del('investGoals', g.id) })} /></div>
            <div className="row n" style={{ margin: '8px 0 5px', fontSize: 12 }}><b style={{ fontWeight: 600 }}>{brl(pr.got, false)}</b><span className="lbl">/ {brl(pr.target, false)} · {Math.round(pr.pct)}%</span></div>
            <Bar pct={pr.pct} color={barColor} />
            {g.deadline && <div className="lbl n" style={{ marginTop: 6 }}>{pr.mLeft != null && pr.mLeft > 0 ? `faltam ${brl(pr.left, false)} · ${brl(pr.per || 0, false)} por mês em ${pr.mLeft} mês${pr.mLeft > 1 ? 'es' : ''}` : pr.mLeft != null && pr.mLeft <= 0 ? (pr.left > 0 ? 'prazo chegou · ainda faltam ' + brl(pr.left, false) : 'prazo cumprido') : null}</div>}
            {g.deadline && pr.hist.some((h) => h.v > 0 || h.key === key) && <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>{pr.hist.filter((h) => h.key <= shiftKey(key, 0) || h.v > 0).slice(-8).map((h) => <div key={h.key} style={{ flex: 1, textAlign: 'center' }}><div style={{ height: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}><i style={{ display: 'block', width: '100%', maxWidth: 16, height: Math.max(2, (h.v / Math.max(1, ...pr.hist.map((x) => x.v))) * 26), borderRadius: 3, background: h.key === key ? 'var(--acc)' : '#CFE3DC' }} /></div><div className="lbl" style={{ fontSize: 9 }}>{cycleName(h.key, naming).slice(0, 3).toLowerCase()}</div></div>)}</div>}
          </div> })}
        <Add label="Novo objetivo" onClick={() => goalForm()} /><div style={{ height: 8 }} />
      </div>

      <div className="card" style={{ padding: '12px 14px' }}>
        <div className="ch"><h3>Planejar</h3>
          <div style={{ display: 'flex', background: '#ECEAE5', borderRadius: 9, padding: 3, fontSize: 12 }}>{([3, 6, 12] as const).map((n) => <button type="button" key={n} onClick={() => setHz(n)} style={{ flex: 1, textAlign: 'center', padding: 6, ...(hz === n ? { background: '#fff', borderRadius: 7, fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,.08)' } : { color: 'var(--mut)' }) }}>{n} meses</button>)}</div>
        </div>
        {plan.rows.map((r) => <div key={r.key} className="li" style={{ alignItems: 'flex-start' }}><div style={{ minWidth: 0, flex: 1 }}><div className="t">{cycleName(r.key, naming)}{r.key === plan.tight.key ? <span className="tag warn" style={{ marginLeft: 6 }}>mais apertado</span> : null}</div><div className="d">entra {brl(r.income, false)} · comprometido {brl(r.committed, false)}</div></div><div className="v" style={{ color: r.leftover < 0 ? 'var(--neg)' : undefined }}>{brl(r.leftover, false)}<small>sobra</small></div></div>)}
        {plan.canRecommend
          ? <Note kind="acc" icon="piggy" t={`Guardar cerca de ${brl(plan.recommended)} por mês`} d="Isso cabe no que sobra depois de Viver e Curtir, pelo que já está nos seus dados. No mês mais apertado, pode ser um pouco menos." />
          : <Note icon="heart" t="Você consegue!" d="Neste momento não sobra, depois de Viver e Curtir, para eu recomendar um valor. Fica de olho no mês mais apertado e vai no seu ritmo." />}
      </div>

      {skippedMoney.length > 0 && <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>Dinheiro que você não gastou</h3></div>
        {skippedMoney.slice().reverse().slice(0, 6).map((x: any, i: number) => <div key={'s'+i} className="li"><div><div className="t">{x.name}</div><div className="d">{x.created ? ddmm(x.created) : ''}</div></div><div className="v" style={{ color: 'var(--acc)' }}>{brl(Number(x.amount) || 0)}</div></div>)}
      </div>}

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
