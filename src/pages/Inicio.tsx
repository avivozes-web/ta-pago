import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, CycleBanner, Ic, Bar, catIcon, MACRO_COLOR, Empty } from '../ui'
import { cycleData, billsDueSoon, paceSeries } from '../lib/calc'
import { brl, ddmm, PAY_LABEL } from '../lib/fmt'
import { cycleName, shiftKey, diffDays, ds, parts, monthLen, addDays } from '../lib/cycle'
import { TxEdit } from '../lancar'

export function alertsFor(db: any, cd: any) {
  const out: { lvl: 'neg' | 'warn'; t: string; d: string; to: string }[] = []
  const al = db.hh.alerts || {}
  if (al.cat90 !== false) db.categories.filter((c: any) => c.goal > 0).forEach((c: any) => {
    const v = cd.byCat[c.id] || 0; const p = v / c.goal
    if (p > 1) out.push({ lvl: 'neg', t: `${c.name} passou da meta`, d: `${brl(v, false)} de ${brl(c.goal, false)} · ${brl(v - c.goal, false)} acima`, to: '/dinheiro/metas' })
    else if (p >= 0.9) out.push({ lvl: 'warn', t: `${c.name} em ${Math.round(p * 100)}%`, d: `${brl(v, false)} de ${brl(c.goal, false)}${cd.daysLeft ? ` · faltam ${cd.daysLeft} dias` : ''}`, to: '/dinheiro/metas' })
  })
  if (al.leisure !== false && cd.leisureCount > db.hh.leisure_max) out.push({ lvl: 'warn', t: `${cd.leisureCount}ª saída de lazer no ciclo`, d: `O combinado é até ${db.hh.leisure_max} por ciclo`, to: '/dinheiro/metas' })
  if (al.card !== false) db.cards.filter((c: any) => c.goal != null).forEach((c: any) => {
    const b = cd.bills.filter((x: any) => x.card.id === c.id).reduce((s: number, x: any) => s + x.amount, 0)
    if (Number(c.goal) === 0 && b > 0) out.push({ lvl: 'warn', t: `${c.name} com gasto novo`, d: `Meta é R$ 0 (parando de usar) · ${brl(b)} neste ciclo`, to: '/dinheiro/cartoes' })
    else if (c.goal > 0 && b / c.goal >= 0.85) out.push({ lvl: b > c.goal ? 'neg' : 'warn', t: `Cartão ${c.name} em ${Math.round((b / c.goal) * 100)}% da meta`, d: `${brl(b, false)} de ${brl(Number(c.goal), false)}`, to: '/dinheiro/cartoes' })
  })
  if (al.pace !== false && cd.cap > 0 && cd.isCurrent && cd.saidas / cd.cap > cd.dayN / cd.daysTotal + 0.1) out.push({ lvl: 'warn', t: 'Gastando acima do ritmo', d: `${Math.round((cd.saidas / cd.cap) * 100)}% do teto em ${Math.round((cd.dayN / cd.daysTotal) * 100)}% do ciclo`, to: '/dinheiro/metas' })
  return out
}
function Chart({ db, cd }: any) {
  const W = 326, H = 92
  const s = paceSeries(db, cd); const tot = Math.max(cd.cap || 0, s[s.length - 1] || 0, 1)
  const xy = (d: number, v: number) => [(d / cd.daysTotal) * W, H - 6 - (v / tot) * (H - 14)]
  const pts = [[0, 0], ...s.map((v, i) => [i + 1, v])].map(([d, v]) => xy(d, v))
  const path = 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')
  const [ex, ey] = pts[pts.length - 1]; const [ix, iy] = xy(cd.daysTotal, cd.cap || tot)
  return <><svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, strokeWidth: 2, display: 'block', marginTop: 12 }} preserveAspectRatio="none">
    <line x1="0" y1={H - 6} x2={W} y2={H - 6} stroke="rgba(255,255,255,.12)" strokeWidth="1" />
    {cd.cap > 0 && <line x1="0" y1={H - 6} x2={ix} y2={iy} stroke="rgba(255,255,255,.35)" strokeWidth="1.4" strokeDasharray="3 4" />}
    <path d={`${path} L${ex.toFixed(1)},${H - 6} L0,${H - 6}Z`} fill="rgba(63,209,169,.12)" stroke="none" />
    <path d={path} stroke="#3FD1A9" strokeWidth="2" />
    {cd.isCurrent && <line x1={ex} y1="4" x2={ex} y2={H - 6} stroke="rgba(255,255,255,.25)" strokeWidth="1" />}
    <circle cx={ex} cy={ey} r="4" fill="#3FD1A9" stroke="#16181D" strokeWidth="2" />
  </svg>
    <div className="row n" style={{ fontSize: 10.5, color: 'rgba(255,255,255,.5)', marginTop: 4 }}><span>{ddmm(cd.range.start)}</span>{cd.isCurrent && <span style={{ margin: '0 auto' }}>hoje, {ddmm(addDays(cd.range.start, cd.dayN - 1))}</span>}<span className="sp">{ddmm(cd.range.end)}</span></div></>
}
export function CatBars({ db, cd, n = 5 }: any) {
  const rows = Object.entries(cd.byCat as Record<string, number>).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const catBy = Object.fromEntries(db.categories.map((c: any) => [c.id, c]))
  const tot = (cd.macro.viver + cd.macro.crescer + cd.macro.curtir) || 1
  if (!rows.length) return <Empty>Nenhum gasto neste ciclo ainda.</Empty>
  const mx = rows[0][1]
  return <>
    <div style={{ display: 'flex', height: 8, borderRadius: 9, overflow: 'hidden', gap: 2 }}>{(['viver', 'crescer', 'curtir'] as const).map((m) => cd.macro[m] > 0 && <i key={m} style={{ width: `${(cd.macro[m] / tot) * 100}%`, background: MACRO_COLOR[m] }} />)}</div>
    <div className="row lbl" style={{ margin: '6px 0 6px', gap: 12 }}>{(['viver', 'crescer', 'curtir'] as const).map((m) => <span key={m}><span className="dot" style={{ background: MACRO_COLOR[m] }} /> {m[0].toUpperCase() + m.slice(1)} {Math.round((cd.macro[m] / tot) * 100)}%</span>)}</div>
    {rows.slice(0, n).map(([k, v]) => { const c = catBy[k]; return <div key={k} style={{ padding: '6px 0' }}><div className="row" style={{ fontSize: 12.5, marginBottom: 5 }}><span>{c?.name || (k === 'manual' ? 'Faturas digitadas à mão' : 'Sem categoria')}</span><b className="sp n" style={{ fontWeight: 600 }}>{brl(v, false)}</b></div><Bar thin pct={(v / mx) * 100} color={MACRO_COLOR[c?.macro || 'viver']} /></div> })}
  </>
}
export default function Inicio() {
  const { db, key, today, currentKey, naming, startDay } = useData(); const nav = useNavigate()
  const [edit, setEdit] = useState<any>(null)
  const cd = useMemo(() => cycleData(db, key, today), [db, key, today])
  const prev = useMemo(() => cycleData(db, shiftKey(currentKey, -1), today), [db, currentKey, today])
  const soon = key === currentKey && db!.hh.alerts?.bills !== false ? billsDueSoon(db, today) : []
  const alerts = alertsFor(db, cd)
  const catBy = Object.fromEntries(db!.categories.map((c: any) => [c.id, c]))
  const cardBy = Object.fromEntries(db!.cards.map((c: any) => [c.id, c]))
  // fixos a pagar no ciclo (próximo vencimento dentro do ciclo)
  const fixedDue = (f: any) => { if (!f.due_day) return null; const s = parts(cd.range.start); let d = ds(s.y, s.m, Math.min(f.due_day, monthLen(s.y, s.m))); if (d < cd.range.start) { const n = s.m === 12 ? { y: s.y + 1, m: 1 } : { y: s.y, m: s.m + 1 }; d = ds(n.y, n.m, Math.min(f.due_day, monthLen(n.y, n.m))) } return d }
  const toPay = [
    ...cd.pendingFixed.map((f: any) => ({ id: f.id, icon: f.icon || 'repeat', t: f.name, d: `fixo${fixedDue(f) ? ' · vence ' + ddmm(fixedDue(f)!) : ''}`, v: Number(f.amount), due: fixedDue(f) || '9999', to: '/dinheiro/fixos' })),
    ...cd.bills.filter((b) => b.due >= today).map((b) => ({ id: b.card.id + b.due, icon: 'card', t: `Fatura ${b.card.name}`, d: `vence ${ddmm(b.due)}`, v: b.amount, due: b.due, to: '/dinheiro/cartoes' })),
  ].sort((a, b) => a.due.localeCompare(b.due))
  const last = [...cd.txs].sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || '')).filter((t: any, i: number, arr: any[]) => !t.group_id || arr.findIndex((x: any) => x.group_id === t.group_id) === i).slice(0, 4)
  const s = cd.free
  return <>
    <Header /><CycleBanner />
    <div className="wrap">
      {soon.map((b) => { const n = diffDays(today, b.due); return <div key={b.card.id + b.due} className={'note ' + (n === 0 ? 'neg' : 'warn')}><Icon n="bell" /><div><div className="t">{n === 0 ? `Fatura ${b.card.name} vence HOJE` : `Fatura ${b.card.name} vence em ${n} dia${n > 1 ? 's' : ''} (${ddmm(b.due)})`}</div><div className="d n">{brl(b.amount)} · entra no ciclo {cycleName(b.due.slice(0, 7), naming)}</div></div></div> })}
      <div className="card" style={{ background: 'var(--ink)', borderColor: 'var(--ink)', color: '#fff', padding: 16 }}>
        <div className="row"><span className="cap" style={{ color: 'rgba(255,255,255,.55)' }}>{cd.cap > 0 ? 'Livre para gastar' : 'Saldo do ciclo'}</span><span className="sp tag n" style={{ background: 'rgba(255,255,255,.1)', color: 'rgba(255,255,255,.8)' }}>{cd.isCurrent ? `dia ${cd.dayN} de ${cd.daysTotal}` : key < currentKey ? 'fechado' : 'ainda não começou'}</span></div>
        <div className="n" style={{ fontSize: 28, fontWeight: 650, letterSpacing: -0.6, marginTop: 2 }}>{brl(s != null ? s : cd.saldo)}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{s != null && cd.isCurrent ? `${brl(cd.perDay || 0, false)} por dia · ${cd.daysLeft} dia${cd.daysLeft > 1 ? 's' : ''} até ${ddmm(cd.range.end)}` : cd.cap > 0 ? `teto ${brl(cd.cap, false)}` : <Link to="/dinheiro/metas" style={{ color: '#3FD1A9', textDecoration: 'none' }}>Defina o teto do ciclo para ver quanto está livre</Link>}</div>
        <Chart db={db} cd={cd} />
        {cd.cap > 0 && cd.isCurrent && <div className="row" style={{ marginTop: 10, gap: 6, fontSize: 11, color: 'rgba(255,255,255,.75)' }}>{cd.saidas / cd.cap > cd.dayN / cd.daysTotal + 0.1 ? <span className="tag" style={{ background: 'rgba(232,169,72,.16)', color: '#F0C27A' }}><Icon n="alert" /> Acima do ritmo</span> : <span className="tag" style={{ background: 'rgba(63,209,169,.15)', color: '#3FD1A9' }}><Icon n="check" /> No ritmo</span>}<span>{Math.round((cd.saidas / cd.cap) * 100)}% do teto usado</span></div>}
      </div>
      <div className="card" style={{ padding: '4px 14px' }}>
        <Link to="/dinheiro/extrato" className="li" style={{ textDecoration: 'none' }}><div className="ic" style={{ background: 'var(--accS)', color: 'var(--acc)' }}><Icon n="up" /></div><div><div className="t">Total de entradas</div><div className="d">{cd.ins.length} entrada{cd.ins.length === 1 ? '' : 's'}</div></div><div className="v" style={{ color: 'var(--acc)' }}>+ {brl(cd.entradas)}</div></Link>
        <Link to="/dinheiro/extrato" className="li" style={{ textDecoration: 'none' }}><Ic n="dn" /><div><div className="t">Total de saídas</div><div className="d">{cd.cardOut + cd.manualOut > 0 ? `inclui ${brl(cd.cardOut + cd.manualOut)} em faturas deste ciclo` : 'gastos, fixos pagos e faturas'}</div></div><div className="v">− {brl(cd.saidas)}</div></Link>
        <div className="li" style={{ borderTop: '1px solid var(--line)' }}><div style={{ width: 32 }} /><div><div className="t" style={{ fontWeight: 600 }}>Saldo do ciclo</div></div><div className="v" style={{ fontSize: 15, color: cd.saldo < 0 ? 'var(--neg)' : undefined }}>{brl(cd.saldo)}</div></div>
      </div>
      {alerts.length > 0 && <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>Alertas</h3><span className="sp tag neg">{alerts.length}</span></div>
        {alerts.map((a, i) => <div key={i} className="li tap" onClick={() => nav(a.to)}><span className="dot" style={{ background: `var(--${a.lvl})` }} /><div><div className="t">{a.t}</div><div className="d n">{a.d}</div></div><span className="sp" style={{ color: 'var(--mut2)' }}><Icon n="right" s={16} /></span></div>)}</div>}
      <div className="card" style={{ padding: '12px 14px 6px' }}><div className="ch"><h3>Faturas deste ciclo</h3><Link to="/dinheiro/cartoes">Cartões</Link></div>
        {cd.bills.length === 0 && <Empty>Nenhuma fatura vence neste ciclo ainda.</Empty>}
        {cd.bills.map((b) => b.card.is_main && b.card.goal > 0 ? <div key={b.card.id + b.due} className="li" style={{ display: 'block' }}><div className="row"><div className="t" style={{ fontWeight: 600 }}>{b.card.name === 'BB' ? 'Banco do Brasil' : b.card.name}</div><span className="tag">vence {ddmm(b.due)}</span><b className="sp n">{brl(b.amount)}</b></div><div style={{ margin: '8px 0 5px' }}><Bar pct={(b.amount / b.card.goal) * 100} color={b.amount > b.card.goal ? 'var(--neg)' : undefined} /></div><div className="row lbl n"><span>{Math.round((b.amount / b.card.goal) * 100)}% da meta de {brl(Number(b.card.goal), false)}</span><span className="sp">limite {brl(Number(b.card.limit_amount), false)}</span></div></div>
          : <div key={b.card.id + b.due} className="li"><div><div className="t">{b.card.name === 'BB' ? 'Banco do Brasil' : b.card.name}</div><div className="d">vence {ddmm(b.due)}{b.card.goal != null ? ` · meta ${brl(Number(b.card.goal), false)}` : ''}</div></div><div className="v">{brl(b.amount)}</div></div>)}
      </div>
      <div className="card"><div className="ch"><h3>Por categoria</h3><Link to="/dinheiro/metas">Metas</Link></div><CatBars db={db} cd={cd} /></div>
      {toPay.length > 0 && <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>A pagar</h3></div>
        {toPay.slice(0, 6).map((x) => <Link key={x.id} to={x.to} className="li" style={{ textDecoration: 'none' }}><Ic n={x.icon} /><div><div className="t">{x.t}</div><div className="d">{x.d}</div></div><div className="v">{brl(x.v)}</div></Link>)}</div>}
      <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>Últimos lançamentos</h3><Link to="/dinheiro/extrato">Extrato</Link></div>
        {last.length === 0 && <Empty>Toque no + para lançar o primeiro gasto.</Empty>}
        {last.map((t: any) => { const c = catBy[t.category_id]; return <div key={t.id} className="li tap" onClick={() => setEdit(t)}><Ic n={t.kind === 'entrada' ? 'trend' : catIcon(c?.name)} /><div style={{ minWidth: 0 }}><div className="t">{t.description}</div><div className="d">{ddmm(t.date)} · {t.kind === 'entrada' ? 'Entrada' : c?.name || 'Sem categoria'} · {t.payment === 'credito' ? `${cardBy[t.card_id]?.name || 'Cartão'}${t.installments > 1 ? ` ${t.installments}x` : ''}, fatura ${ddmm(t.bill_due)}` : PAY_LABEL[t.payment] || ''}</div></div><div className="v" style={t.kind === 'entrada' ? { color: 'var(--acc)' } : undefined}>{t.kind === 'entrada' ? '+ ' : ''}{brl(Number(t.total_amount ?? t.amount))}</div></div> })}
      </div>
      {key === currentKey && <Link to="/fechamento" className="card row" style={{ padding: '12px 14px', textDecoration: 'none' }}><Ic n="flag" /><div><div style={{ fontWeight: 600 }}>Fechamento de {cycleName(prev.key, naming).toLowerCase()}</div><div className="lbl">{prev.txs.length || prev.paid.length ? `${prev.saldo >= 0 ? 'Sobraram' : 'Faltaram'} ${brl(Math.abs(prev.saldo), false)} · ver resumo` : 'Sem lançamentos · ver resumo'}</div></div><span className="sp" style={{ color: 'var(--mut)' }}><Icon n="right" s={18} /></span></Link>}
    </div>
    {edit && <TxEdit t={edit} onClose={() => setEdit(null)} />}
    {void startDay}
  </>
}
