import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data'
import { Icon } from '../icons'
import { Note, cycleRng } from '../ui'
import { cycleData } from '../lib/calc'
import { brl } from '../lib/fmt'
import { cycleName, shiftKey, cycleRange, addDays, dow } from '../lib/cycle'
import { CatBars } from './Inicio'

export default function Fechamento() {
  const { db, key, currentKey, today, naming, startDay, setKey } = useData(); const nav = useNavigate()
  const k = key === currentKey ? shiftKey(currentKey, -1) : key
  const cd = useMemo(() => cycleData(db, k, today), [db, k, today])
  const name = cycleName(k, naming)
  const investCat = db!.categories.find((c: any) => c.is_invest)
  const guardado = cd.byCat[investCat?.id] || 0
  const over = db!.categories.filter((c: any) => c.goal != null && (cd.byCat[c.id] || 0) > Number(c.goal))
  const goals = db!.categories.filter((c: any) => c.goal != null)
  const r = cycleRange(k, startDay)
  const wish = db!.wish.filter((w: any) => w.bought && w.bought_on && w.bought_on >= r.start && w.bought_on <= r.end)
  const hs = db!.habits.filter((h: any) => h.in_grid && h.kind === 'check'); let s = 0, n = 0
  const best: Record<string, number> = {}
  for (let d = r.start; d <= r.end && d <= today; d = addDays(d, 1)) hs.forEach((h: any) => { const born = h.created_at ? new Date(h.created_at).toLocaleDateString('sv-SE') : ''; if (d < born || !(h.days || []).includes(dow(d))) return; s++; if (db!.habitLogs.some((l: any) => l.habit_id === h.id && l.day === d && l.done)) { n++; best[h.name] = (best[h.name] || 0) + 1 } })
  const bestH = Object.entries(best).sort((a, b) => b[1] - a[1])[0]?.[0]
  const nk = shiftKey(k, 1); const nr = cycleRange(nk, startDay)
  const empty = cd.txs.length === 0 && cd.paid.length === 0 && cd.manual.length === 0
  return <>
    <div className="hdr" style={{ position: 'relative' }}><button type="button" className="ib" aria-label="voltar" onClick={() => { if (key !== currentKey) setKey(currentKey); nav('/') }}><Icon n="left" /></button><div style={{ fontWeight: 650, fontSize: 15 }}>Fechamento</div>
      <div className="cyc"><div><div className="a">{name}</div><div className="b n">{cycleRng(k, startDay)}</div></div></div></div>
    <div className="wrap">
      <div className="card" style={{ background: 'var(--ink)', borderColor: 'var(--ink)', color: '#fff', padding: 16 }}>
        <div className="cap" style={{ color: 'rgba(255,255,255,.55)' }}>{empty ? `${name} sem lançamentos` : cd.saldo >= 0 ? `${name} fechou no azul` : `${name} fechou no vermelho`}</div>
        <div className="n" style={{ fontSize: 28, fontWeight: 650, letterSpacing: -0.6, margin: '2px 0 10px' }}>{cd.saldo >= 0 ? 'Sobraram' : 'Faltaram'} {brl(Math.abs(cd.saldo))}</div>
        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.55)', marginBottom: 6 }}>Totais do ciclo</div>
        <div className="g3">{[['Entradas', cd.entradas], ['Saídas', cd.saidas], ['Guardado', guardado]].map(([a, v]) => <div key={a as string} style={{ background: 'rgba(255,255,255,.07)', borderRadius: 10, padding: '8px 10px' }}><div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.55)' }}>{a}</div><div className="n" style={{ fontWeight: 600, fontSize: 13 }}>{brl(v as number, false)}</div></div>)}</div>
      </div>
      {cd.cap > 0 && (cd.saidas <= cd.cap ? <Note kind="acc" icon="target" t="Teto batido" d={`${brl(cd.saidas, false)} de ${brl(cd.cap, false)}. Ficaram ${brl(cd.cap - cd.saidas, false)} de folga.`} /> : <Note kind="neg" icon="target" t="Passou do teto" d={`${brl(cd.saidas, false)} de ${brl(cd.cap, false)} · ${brl(cd.saidas - cd.cap, false)} acima.`} />)}
      <div className="card"><div className="ch"><h3>Onde mais gastaram</h3></div><CatBars db={db} cd={cd} n={3} /></div>
      {goals.length > 0 && <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>Metas por categoria</h3><span className="sp tag acc">{goals.length - over.length} de {goals.length}</span></div>
        {over.length === 0 && <div className="lbl" style={{ padding: '4px 0 10px' }}>Todas as metas cumpridas.</div>}
        {over.map((c: any) => <div key={c.id} className="li" style={{ minHeight: 36 }}><span className="t" style={{ fontWeight: 400, color: 'var(--ink2)' }}>{c.name}</span><b className="sp n" style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--neg)' }}>{brl((cd.byCat[c.id] || 0) - Number(c.goal), false)} acima</b></div>)}
        {cd.leisureCount > db!.hh.leisure_max && <div className="li" style={{ minHeight: 36 }}><span className="t" style={{ fontWeight: 400, color: 'var(--ink2)' }}>Lazer e saídas</span><b className="sp n" style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--neg)' }}>{cd.leisureCount} saídas (combinado: {db!.hh.leisure_max})</b></div>}
      </div>}
      <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>Cartões</h3></div>
        {db!.cards.map((c: any) => { const v = cd.bills.filter((b) => b.card.id === c.id).reduce((s2, b) => s2 + b.amount, 0); const g = c.goal != null ? Number(c.goal) : null
          return <div key={c.id} className="li" style={{ minHeight: 36 }}><span className="t" style={{ fontWeight: 400, color: 'var(--ink2)' }}>{c.name === 'BB' ? 'Banco do Brasil' : c.name}</span><b className="sp n" style={{ fontWeight: 600, fontSize: 12.5, color: g != null && v > g ? 'var(--neg)' : 'var(--acc)' }}>{brl(v, false)}{g != null && g > 0 ? ` de ${brl(g, false)}` : ''}</b></div> })}
      </div>
      <div className="g2" style={{ marginBottom: 10 }}>
        <div className="stat"><div className="lbl">Wishlist</div><div className="v" style={{ fontSize: 14 }}>{wish.length} comprado{wish.length === 1 ? '' : 's'}</div><div className="lbl n">{brl(wish.reduce((a: number, w: any) => a + Number(w.amount), 0), false)}</div></div>
        <div className="stat"><div className="lbl">Hábitos</div><div className="v" style={{ fontSize: 14 }}>{s ? Math.round((n / s) * 100) : 0}% de constância</div><div className="lbl">{bestH ? `melhor: ${bestH.toLowerCase()}` : '—'}</div></div>
      </div>
      <Note icon="cal" t={`${cycleName(nk, naming)} (${cycleRng(nk, startDay)}) ${nk <= currentKey ? 'abriu sozinho' : 'abre sozinho'} em ${nr.start.slice(8)}/${nr.start.slice(5, 7)}`} d={`Fixos e lista de compras começam desmarcados. ${name} fica guardado no seletor de ciclos.`} />
    </div>
  </>
}
