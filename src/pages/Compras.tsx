import { useState } from 'react'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, CycleBanner, Seg, CASA, More, editDel, Add, Check, useForm, Bar } from '../ui'
import { brl, ddmm } from '../lib/fmt'
import { cycleName, cycleRange, shiftKey } from '../lib/cycle'

export default function Compras() {
  const { db, key, naming, startDay, ins, upd, del, toast } = useData()
  const [form, setForm] = useForm()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const secs = db!.shopSections; const items = db!.shopItems
  const checks = db!.shopChecks.filter((c: any) => c.cycle_key === key)
  const chk = Object.fromEntries(checks.map((c: any) => [c.item_id, c]))
  const done = items.filter((i: any) => chk[i.id])
  const spent = done.reduce((s: number, i: any) => s + (Number(i.price) || 0), 0)
  const toggle = (i: any) => (chk[i.id] ? del('shopChecks', chk[i.id].id) : ins('shopChecks', { item_id: i.id, cycle_key: key }))
  const itemForm = (it?: any, secId?: string) => setForm({ title: it ? 'Editar item' : 'Novo item', initial: it ? { ...it, price: it.price == null ? '' : Number(it.price) } : { section_id: secId || secs[0]?.id, promo: false }, fields: [
    { k: 'name', label: 'Item', type: 'text', required: true },
    { k: 'qty', label: 'Quantidade', type: 'text', placeholder: 'ex.: 2 kg, 1 cx' },
    { k: 'price', label: 'Preço (opcional)', type: 'money' },
    { k: 'promo', label: 'Promoção', type: 'toggle', hint: 'Estava em promoção' },
    { k: 'section_id', label: 'Seção', type: 'select', required: true, options: secs.map((s: any) => ({ v: s.id, l: s.name })) },
    { k: 'note', label: 'Observação', type: 'text', placeholder: 'ex.: feira, BH Atacado' }],
    onSave: async (v) => { const row = { name: v.name, qty: v.qty || '', price: v.price, promo: !!v.promo, section_id: v.section_id, note: v.note || '' }; return it ? upd('shopItems', it.id, row) : !!(await ins('shopItems', { ...row, sort: items.length + 1 })) },
    onDelete: it ? () => del('shopItems', it.id) : undefined })
  const secForm = (s?: any) => setForm({ title: s ? 'Renomear seção' : 'Nova seção', initial: s || {}, fields: [{ k: 'name', label: 'Nome', type: 'text', required: true }], onSave: async (v) => (s ? upd('shopSections', s.id, { name: v.name }) : !!(await ins('shopSections', { name: v.name, sort: secs.length + 1 }))) })
  const quickAdd = async (s: any) => { const name = (draft[s.id] || '').trim(); if (!name) return; const r = await ins('shopItems', { name, section_id: s.id, sort: items.length + 1 }); if (r) { setDraft({ ...draft, [s.id]: '' }); toast('Adicionado') } }
  const next = cycleRange(shiftKey(key, 1), startDay).start
  return <>
    <Header /><div className="ttl">Casa</div><Seg items={CASA} /><CycleBanner />
    <div className="wrap">
      <div className="card"><div className="row"><div><div className="lbl">Lista de {cycleName(key, naming).toLowerCase()}</div><div className="n" style={{ fontSize: 20, fontWeight: 650 }}>{done.length} de {items.length} itens</div></div><div className="sp" style={{ textAlign: 'right' }}><div className="lbl">gasto marcado</div><b className="n">{brl(spent)}</b></div></div>
        <div style={{ margin: '9px 0 6px' }}><Bar pct={items.length ? (done.length / items.length) * 100 : 0} /></div><div className="row lbl" style={{ gap: 5 }}><Icon n="repeat" s={13} /> Em {ddmm(next)}, no ciclo novo, a lista volta toda desmarcada</div></div>
      {secs.map((s: any, idx: number) => { const list = items.filter((i: any) => i.section_id === s.id); const n = list.filter((i: any) => chk[i.id]).length; const op = open[s.id] ?? idx < 3
        return <div key={s.id} className="card" style={{ padding: '12px 14px 10px' }}>
          <div className="ch tap" style={{ marginBottom: op ? 2 : 0 }} onClick={() => setOpen({ ...open, [s.id]: !op })}><h3>{s.name}</h3><span className="sp tag n">{n}/{list.length}</span><span style={{ color: 'var(--mut2)', marginLeft: 4, transform: op ? 'rotate(180deg)' : undefined, display: 'grid' }}><Icon n="down" s={16} /></span><More items={editDel(() => secForm(s), async () => { if (confirm(`Apagar a seção "${s.name}" e os ${list.length} itens dela?`)) await del('shopSections', s.id) })} /></div>
          {op && <>{list.map((i: any) => <div key={i.id} className={'li tap' + (chk[i.id] ? ' done' : '')} style={{ minHeight: 40, padding: '7px 0' }} onClick={() => itemForm(i)}>
            <Check on={!!chk[i.id]} onClick={() => toggle(i)} />
            <div style={{ minWidth: 0, flex: 1 }}><div className="t">{i.name}</div>{(i.qty || i.note || i.promo) && <div className="row" style={{ gap: 5, marginTop: 3, flexWrap: 'wrap' }}>{i.qty && <span className="tag n">{i.qty}</span>}{i.note && <span className="lbl">{i.note}</span>}{i.promo && <span className="tag acc"><Icon n="tag" /> promoção</span>}</div>}</div>
            <div className="v" style={{ fontSize: 12.5 }}>{i.price != null ? brl(Number(i.price)) : <span className="lbl" style={{ fontWeight: 400 }}>+ preço</span>}</div>
            <More items={editDel(() => itemForm(i), async () => { if (confirm(`Apagar "${i.name}"?`)) await del('shopItems', i.id) })} />
          </div>)}
            <form className="row" style={{ gap: 6, marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); quickAdd(s) }}><input className="inp" style={{ flex: 1, padding: '7px 10px', fontSize: 12.5, background: 'var(--bg)', color: 'var(--ink)', outline: 0 }} placeholder="Adicionar item…" value={draft[s.id] || ''} onChange={(e) => setDraft({ ...draft, [s.id]: e.target.value })} /><button className="ib" aria-label="adicionar" style={{ width: 32, height: 32, background: 'var(--ink)', color: '#fff', border: 0 }}><Icon n="plus" /></button></form></>}
        </div> })}
      <div className="card" style={{ padding: '2px 14px' }}><Add label="Nova seção" onClick={() => secForm()} /><div style={{ height: 8 }} /></div>
    </div>
    {form}
  </>
}
