import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, CycleBanner, Seg, DIN, Ic, More, editDel, catIcon, Empty, ask, useForm } from '../ui'
import { cycleData } from '../lib/calc'
import { brl, ddmm, DOW, PAY_LABEL } from '../lib/fmt'
import { cycleName, dow, addDays } from '../lib/cycle'
import { norm } from '../lib/parse'
import { Lancar, TxEdit, type LancarInit, salaryValueForm, salaryReceivedForm } from '../lancar'
import { sb } from '../lib/sb'

export default function Extrato() {
  const ctx = useData(); const { db, key, today, naming, startDay, del, reload, toast, currentKey } = ctx; const nav = useNavigate()
  const [sp] = useSearchParams(); const [form, setForm] = useForm()
  const cd = useMemo(() => cycleData(db, key, today), [db, key, today])
  const [q, setQ] = useState(''); const [chip, setChip] = useState('tudo'); const [cat, setCat] = useState(sp.get('cat') || '')
  const [edit, setEdit] = useState<any>(null); const [lanc, setLanc] = useState<LancarInit | null>(null)
  const catBy = Object.fromEntries(db!.categories.map((c: any) => [c.id, c])); const cardBy = Object.fromEntries(db!.cards.map((c: any) => [c.id, c]))
  const fixedBy = Object.fromEntries(db!.fixed.map((f: any) => [f.id, f]))
  type Row = { id: string; date: string; kind: 'entrada' | 'saida'; t: string; d: string; v: number; pay: string; icon: string; tag?: string; src: any; type: 'tx' | 'fixo' | 'manual'; catId?: string; payment?: string }
  const rows: Row[] = [
    ...cd.txs.map((t: any) => { const c = catBy[t.category_id]; return { id: t.id, date: t.date, kind: t.kind, t: t.description, d: t.kind === 'entrada' ? (t.auto ? `salário · entrou sozinho no dia ${startDay}` : t.is_advance ? `recebido ${ddmm(t.date)} · desconta do salário` : t.for_cycle ? `salário · recebido ${ddmm(t.date)}` : 'Entrada') : c?.name || 'Sem categoria', v: Number(t.amount), pay: t.auto ? 'automático' : t.payment === 'credito' ? `${cardBy[t.card_id]?.name || 'Cartão'} · fatura ${ddmm(t.bill_due)}${t.installments > 1 ? ` · ${t.installment_no}/${t.installments}` : ''}` : PAY_LABEL[t.payment] || '', icon: t.kind === 'entrada' ? 'trend' : catIcon(c?.name), src: t, type: 'tx' as const, catId: t.category_id, payment: t.payment, tag: c?.is_leisure ? 'lazer' : undefined } }),
    ...cd.paid.map((p: any) => { const f = fixedBy[p.fixed_id]; return { id: p.id, date: p.paid_on, kind: 'saida' as const, t: f?.name || 'Fixo', d: 'Gasto fixo', v: Number(p.amount), pay: 'Fixo pago', icon: f?.icon || 'repeat', src: p, type: 'fixo' as const, catId: f?.category_id } }),
    ...cd.manual.map((m: any) => ({ id: m.id, date: m.due_date, kind: 'saida' as const, t: `Fatura ${cardBy[m.card_id]?.name || ''}`, d: m.note || 'Fatura digitada à mão', v: Number(m.amount), pay: `vence ${ddmm(m.due_date)}`, icon: 'card', src: m, type: 'manual' as const, payment: 'credito' })),
  ]
  const nq = norm(q)
  const shown = rows.filter((r) => (chip === 'tudo' || (chip === 'entradas' && r.kind === 'entrada') || (chip === 'saidas' && r.kind === 'saida') || (chip === 'pix' && r.payment === 'pix') || (chip === 'cartao' && r.payment === 'credito')) && (!cat || r.catId === cat) && (!nq || norm(r.t + ' ' + r.d).includes(nq)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.src.created_at || '').localeCompare(a.src.created_at || ''))
  const days: Record<string, Row[]> = {}; shown.forEach((r) => (days[r.date] = days[r.date] || []).push(r))
  const dayLbl = (d: string) => d === today ? `Hoje · ${DOW[dow(d)]} ${ddmm(d)}` : d === addDays(today, -1) ? `Ontem · ${DOW[dow(d)]} ${ddmm(d)}` : `${DOW[dow(d)][0].toUpperCase() + DOW[dow(d)].slice(1)} ${ddmm(d)}`
  const salRow = (sid: string) => cd.incomeRows.find((x: any) => x.source.id === sid)
  const open = (r: Row) => { if (r.type === 'tx' && r.src.auto) salaryReceivedForm(ctx, salRow(r.src.income_source_id), key, setForm); else if (r.type === 'tx') setEdit(r.src); else if (r.type === 'fixo') nav('/dinheiro/fixos'); else nav('/dinheiro/cartoes') }
  const remove = async (r: Row) => {
    if (r.type === 'fixo') { if (ask('Desmarcar este fixo como pago?')) await del('fixedPaid', r.id); return }
    if (r.type === 'manual') { if (ask('Apagar esta fatura digitada?')) await del('manualBills', r.id); return }
    const t = r.src
    if (t.auto) { toast(`O salário entra sozinho todo dia ${startDay}. Para mudar, toque nele ou mude o valor em Entradas previstas.`); return }
    if (t.group_id && t.installments > 1) { if (!ask(`Apagar as ${t.installments} parcelas de "${t.description}"?`)) return; const { error } = await sb.from('tp_transactions').delete().eq('group_id', t.group_id); if (error) toast(error.message); await reload('tx'); toast('Apagado'); return }
    if (ask(`Apagar "${t.description}"?`)) { await del('tx', t.id); toast('Apagado') }
  }
  const nOut = cd.txs.filter((t: any) => t.kind === 'saida').length + cd.paid.length + cd.manual.length
  const sal = cd.incomeRows.filter((r: any) => r.source.is_salary)
  const others = cd.incomeRows.filter((r: any) => !r.source.is_salary)
  return <>
    <Header /><div className="ttl">Dinheiro</div><Seg items={DIN} /><CycleBanner />
    <div className="wrap">
      <div className="g2" style={{ marginBottom: 8 }}>
        <div className="stat"><div className="lbl">Total de entradas</div><div className="v" style={{ color: 'var(--acc)' }}>{brl(cd.entradas)}</div><div className="lbl">{cd.ins.length} lançamento{cd.ins.length === 1 ? '' : 's'}</div></div>
        <div className="stat"><div className="lbl">Total de saídas</div><div className="v">{brl(cd.saidas)}</div><div className="lbl">{nOut} lançamento{nOut === 1 ? '' : 's'}</div></div>
      </div>
      <div className="card row" style={{ padding: '10px 14px' }}><span className="lbl">Saldo do ciclo</span><b className="sp n" style={{ fontSize: 14, color: cd.saldo < 0 ? 'var(--neg)' : undefined }}>{brl(cd.saldo)}</b></div>
      <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>Salários · todo dia {startDay}</h3><span className="sp lbl">entram sozinhos</span></div>
        {sal.map((r: any) => { const fromKey = key < currentKey ? currentKey : key
          const st = r.real.length ? `recebido ${ddmm(r.real[0].date)} · ${brl(r.received)}` : r.auto ? `recebido dia ${startDay} (automático)` : r.pending ? `previsto até dia ${startDay}` : r.expected ? 'já recebido no adiantamento' : 'coloque o valor'
          return <div key={r.source.id} className="li">
          <Ic n="trend" style={{ background: 'var(--accS)', color: 'var(--acc)' }} />
          <div style={{ minWidth: 0, flex: 1 }}><div className="t">{r.source.name}{r.adv > 0 ? ` – adiantamento ${brl(r.adv)}` : ''}</div>
            <div className="d n">{st}{r.adv > 0 && r.expected ? ` · falta ${brl(r.net)}` : ''}</div></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <button type="button" className="row n" style={{ gap: 4, fontWeight: 600 }} onClick={() => salaryValueForm(ctx, r.source, fromKey, setForm)}>{r.expected ? brl(r.expected) : 'R$ —'}<Icon n="edit" s={12} /></button>
            <div className="row" style={{ gap: 4 }}>{r.expected > 0 && <button type="button" className="tag acc" onClick={() => salaryReceivedForm(ctx, r, key, setForm)}>{r.real.length ? 'Editar' : 'Recebi antes'}</button>}
            <button type="button" className="tag" onClick={() => setLanc({ mode: 'entrada', sourceId: r.source.id, advance: true })}>Adiantar</button></div>
          </div>
        </div> })}
        {others.length > 0 && <div className="li"><div style={{ minWidth: 0, flex: 1 }}><div className="t">Outras entradas</div><div className="d">{others.map((r: any) => r.source.name).join(', ')} · você lança quando entrar</div></div><button type="button" className="sp tag acc" onClick={() => setLanc({ mode: 'entrada' })}><Icon n="plus" /> Lançar</button></div>}
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}><label className="inp" style={{ flex: 1 }}><Icon n="search" /><input style={{ border: 0, outline: 0, flex: 1, background: 'transparent', fontSize: 13 }} placeholder="Buscar" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label className="ib" style={{ position: 'relative' }}><Icon n="filter" /><select aria-label="categoria" value={cat} onChange={(e) => setCat(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0 }}><option value="">Todas as categorias</option>{db!.categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
      <div className="chips" style={{ overflowX: 'auto' }}>{[['tudo', 'Tudo'], ['entradas', 'Entradas'], ['saidas', 'Saídas'], ['pix', 'Pix'], ['cartao', 'Cartão']].map(([k, l]) => <span key={k} className={'tap ' + (chip === k ? 'on' : '')} onClick={() => setChip(k)}>{l}</span>)}{cat && <span className="on tap" onClick={() => setCat('')}>{catBy[cat]?.name} ✕</span>}</div>
      {Object.keys(days).length === 0 && <div className="card"><Empty>{rows.length ? 'Nada com esse filtro.' : `Nenhum lançamento em ${cycleName(key, naming)}. Toque no + para lançar.`}</Empty></div>}
      {Object.entries(days).map(([d, rs]) => { const tot = rs.reduce((s, r) => s + (r.kind === 'entrada' ? r.v : -r.v), 0); return <div key={d}>
        <div className="row" style={{ padding: '4px 4px 6px' }}><span className="cap">{dayLbl(d)}</span><span className="sp lbl n">{tot >= 0 ? '+ ' : '− '}{brl(Math.abs(tot))}</span></div>
        <div className="card" style={{ padding: '2px 14px' }}>{rs.map((r) => <div key={r.id} className="li tap" onClick={() => open(r)}>
          <Ic n={r.icon} /><div style={{ minWidth: 0 }}><div className="t">{r.t}{r.tag === 'lazer' && <> <span className="tag gold">lazer</span></>}</div><div className="d">{r.d}</div></div>
          <div className="v n">{r.kind === 'entrada' ? <span style={{ color: 'var(--acc)' }}>+ {brl(r.v)}</span> : brl(r.v)}<small>{r.pay}</small></div>
          <More items={editDel(() => open(r), () => remove(r))} />
        </div>)}</div></div> })}
      <div className="lbl" style={{ textAlign: 'center', margin: '4px 0 8px' }}>Toque para editar · ⋯ para apagar</div>
    </div>
    {edit && <TxEdit t={edit} onClose={() => setEdit(null)} />}
    {lanc && <Lancar init={lanc} onClose={() => setLanc(null)} />}
    {form}
  </>
}
