import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, CycleBanner, Seg, DIN, Ic, Note } from '../ui'
import { cashFlow, nextSummary, type FlowEv } from '../lib/calc'
import { brl, ddmm, DOW } from '../lib/fmt'
import { cycleName, dow, cycleRange } from '../lib/cycle'

function Chart({ series, startLbl, endLbl, todayIdx }: { series: number[]; startLbl: string; endLbl: string; todayIdx: number }) {
  const W = 326, H = 96, P = 6
  const mx = Math.max(1, ...series), mn = Math.min(0, ...series)
  const y = (v: number) => P + (1 - (v - mn) / (mx - mn || 1)) * (H - 2 * P)
  const x = (i: number) => (series.length > 1 ? (i / (series.length - 1)) * W : 0)
  const path = series.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const z = y(0)
  return <><svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }}>
    <defs><clipPath id="neg"><rect x="0" y={z} width={W} height={H - z} /></clipPath><clipPath id="pos"><rect x="0" y="0" width={W} height={z} /></clipPath></defs>
    <path d={`${path} L${W},${z} L0,${z}Z`} fill="rgba(14,124,102,.12)" stroke="none" clipPath="url(#pos)" />
    <path d={`${path} L${W},${z} L0,${z}Z`} fill="rgba(180,56,44,.16)" stroke="none" clipPath="url(#neg)" />
    <line x1="0" x2={W} y1={z} y2={z} stroke="#CFCCC5" strokeWidth="1" strokeDasharray="3 3" />
    <path d={path} stroke="var(--acc)" strokeWidth="2" fill="none" clipPath="url(#pos)" />
    <path d={path} stroke="var(--neg)" strokeWidth="2" fill="none" clipPath="url(#neg)" />
    {todayIdx >= 0 && <line x1={x(todayIdx)} x2={x(todayIdx)} y1="0" y2={H} stroke="rgba(22,24,29,.25)" strokeWidth="1" />}
  </svg>
    <div className="row lbl n" style={{ fontSize: 10.5, marginTop: 3 }}><span>{startLbl}</span>{todayIdx >= 0 && <span style={{ margin: '0 auto' }}>hoje</span>}<span className="sp">{endLbl}</span></div></>
}
export default function Fluxo() {
  const { db, key, today, naming, startDay } = useData(); const nav = useNavigate()
  const f = useMemo(() => cashFlow(db, key, today), [db, key, today])
  const ns = useMemo(() => nextSummary(db, key, today), [db, key, today])
  const r = f.cd.range
  const todayIdx = today >= r.start && today <= r.end ? Math.round((new Date(today).getTime() - new Date(r.start).getTime()) / 86400000) : -1
  const tin = [...f.before, ...f.days.flatMap((d) => d.items)].filter((e) => e.kind === 'in').reduce((a, e) => a + e.v, 0)
  const tout = [...f.before, ...f.days.flatMap((d) => d.items)].filter((e) => e.kind === 'out').reduce((a, e) => a + e.v, 0)
  const Ev = ({ e }: { e: FlowEv }) => <div className="li tap" style={{ minHeight: 40, padding: '7px 0' }} onClick={() => e.to && nav(e.to)}>
    <Ic n={e.icon} style={e.kind === 'in' ? { background: 'var(--accS)', color: 'var(--acc)' } : undefined} />
    <div style={{ minWidth: 0, flex: 1 }}><div className="t">{e.t}</div><div className="d">{e.d}{e.forecast ? ' · previsto' : ''}</div></div>
    <div className="v n" style={{ color: e.kind === 'in' ? 'var(--acc)' : undefined }}>{e.kind === 'in' ? '+ ' : '− '}{brl(e.v)}</div></div>
  const nr = cycleRange(ns.key, startDay)
  return <>
    <Header /><div className="ttl">Dinheiro</div><Seg items={DIN} /><CycleBanner />
    <div className="wrap">
      <div className="card">
        <div className="row"><div><div className="lbl">Fluxo de caixa de {cycleName(key, naming).toLowerCase()}</div><div className="n" style={{ fontSize: 22, fontWeight: 650, letterSpacing: -0.4, color: f.end < 0 ? 'var(--neg)' : undefined }}>{brl(f.end)}</div><div className="lbl">sobra prevista em {ddmm(r.end)}</div></div>
          {f.negDays > 0 ? <span className="sp tag neg"><Icon n="alert" /> {f.negDays} dia{f.negDays > 1 ? 's' : ''} no vermelho</span> : <span className="sp tag acc"><Icon n="check" /> sempre no azul</span>}</div>
        <div style={{ marginTop: 10 }}><Chart series={f.series} startLbl={ddmm(r.start)} endLbl={ddmm(r.end)} todayIdx={todayIdx} /></div>
        <div className="g2" style={{ marginTop: 10 }}><div><div className="lbl">Entra</div><b className="n" style={{ color: 'var(--acc)' }}>+ {brl(tin)}</b></div><div><div className="lbl">Sai</div><b className="n">− {brl(tout)}</b></div></div>
        <div className="lbl n" style={{ marginTop: 6 }}>Menor saldo: <b style={{ color: f.minBal < 0 ? 'var(--neg)' : 'var(--ink)' }}>{brl(f.minBal)}</b> em {ddmm(f.minDay)}</div>
      </div>

      <div className="card" style={{ background: 'var(--ink)', borderColor: 'var(--ink)', color: '#fff' }}>
        <div className="row"><span className="cap" style={{ color: 'rgba(255,255,255,.55)' }}>Próximo ciclo · {cycleName(ns.key, naming)}</span><span className="sp lbl n" style={{ color: 'rgba(255,255,255,.55)' }}>{ddmm(nr.start)} – {ddmm(nr.end)}</span></div>
        <div className="n" style={{ fontSize: 26, fontWeight: 650, letterSpacing: -0.5, marginTop: 4, color: ns.sobra < 0 ? '#F2A79E' : undefined }}>{ns.sobra >= 0 ? 'Sobra ' : 'Falta '}{brl(Math.abs(ns.sobra))}</div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.6)' }}>entradas previstas − o que já está comprometido</div>
        <div style={{ marginTop: 10, background: 'rgba(255,255,255,.06)', borderRadius: 12, padding: '4px 12px' }}>
          {[['Salários previstos', ns.entradas, true, ns.salarios.map((s: any) => `${s.name.replace('Salário ', '')} ${brl(s.expected, false)}`).join(' · ') || 'coloque os valores em Extrato'],
            ...ns.cards.map((c: any) => [`Fatura ${c.card.name}`, -c.amount, false, `vence ${ddmm(c.due)}`]),
            ...(ns.cards.length ? [] : [['Faturas dos cartões', 0, false, 'nada lançado ainda']]),
            ['Fixos', -ns.fixos, false, `${db!.fixed.length} contas`],
            ...(ns.cheque ? [['Cheque especial', -ns.cheque, false, 'usado, a pagar']] : []),
            ...(ns.outrasJa ? [['Outros gastos já marcados', -ns.outrasJa, false, '']] : []),
          ].map(([t, v, pos, d]: any) => <div key={t} className="row" style={{ padding: '7px 0', borderTop: '1px solid rgba(255,255,255,.07)', fontSize: 12.5 }}><div><div>{t}</div>{d && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.5)' }}>{d}</div>}</div><b className="sp n" style={{ fontWeight: 600, color: pos ? '#3FD1A9' : undefined }}>{pos ? '+ ' : '− '}{brl(Math.abs(v))}</b></div>)}
          <div className="row" style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,.18)', fontSize: 13 }}><b>Já comprometido</b><b className="sp n">− {brl(ns.comprometido)}</b></div>
        </div>
      </div>

      <div className="sec">Dia a dia</div>
      {f.before.length > 0 && <><div className="row" style={{ padding: '4px 4px 6px' }}><span className="cap">Antes do dia {startDay} · pago com adiantamento</span><span className="sp lbl n">saldo {brl(f.startBal)}</span></div>
        <div className="card" style={{ padding: '2px 14px' }}>{f.before.map((e) => <Ev key={e.id} e={e} />)}</div></>}
      {f.days.length === 0 && f.before.length === 0 && <div className="card"><div className="empty">Nada entra nem sai neste ciclo ainda. Coloque os salários (Extrato) e os fixos com dia de vencimento.</div></div>}
      {f.days.map((d) => <div key={d.date}>
        <div className="row" style={{ padding: '4px 4px 6px' }}><span className="cap" style={d.date === today ? { color: 'var(--ink)' } : undefined}>{d.date === today ? 'Hoje · ' : ''}{DOW[dow(d.date)]} {ddmm(d.date)}</span><span className={'sp n ' + (d.saldo < 0 ? 'tag neg' : 'lbl')} style={{ fontWeight: d.saldo < 0 ? 600 : 400 }}>saldo {brl(d.saldo)}</span></div>
        <div className="card" style={{ padding: '2px 14px', borderColor: d.saldo < 0 ? '#F0D2CC' : undefined, background: d.saldo < 0 ? '#FFFBFA' : undefined }}>{d.items.map((e) => <Ev key={e.id} e={e} />)}</div>
      </div>)}
      {f.after.length > 0 && <Note icon="info" t="Fora deste ciclo" d={`${f.after.length} item(ns) caem depois de ${ddmm(r.end)}.`} />}
      <Note icon="info" t="O que é o fluxo de caixa?" d={`É a agenda do dinheiro: mostra, dia por dia, o que entra e o que sai, e quanto sobra em cada dia. Se algum dia ficar vermelho, é porque naquele dia sai mais do que entrou até ali. Começa em R$ 0 no dia ${startDay} (só o dinheiro deste ciclo).`} />
    </div>
  </>
}
