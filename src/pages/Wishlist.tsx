import { useMemo, useState } from 'react'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, Seg, EU, More, editDel, Add, Note, Check, useForm, Empty, Sheet } from '../ui'
import { cycleData } from '../lib/calc'
import { brl } from '../lib/fmt'
import { cycleName, shiftKey } from '../lib/cycle'

const host = (u: string) => { try { return new URL(u.startsWith('http') ? u : 'https://' + u).hostname.replace(/^www\./, '') } catch { return 'link' } }
export default function Wishlist() {
  const { db, today, naming, currentKey, ins, upd, del, updHH, toast } = useData()
  const [form, setForm] = useForm()
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [cats, setCats] = useState(false)
  const wcats = db!.wishCats; const items = db!.wish
  const catBy = Object.fromEntries(wcats.map((c: any) => [c.id, c]))
  const yr = (m: string) => (m.slice(0, 4) !== currentKey.slice(0, 4) ? ` ${m.slice(0, 4)}` : '')
  const mName = (m: string) => `${cycleName(m, naming)}${yr(m)}`
  // meses na tela: este, o próximo, os que ela adicionou e os que já têm itens
  const months = useMemo(() => {
    const hide = new Set<string>(db!.hh.wish_hidden_months || [])
    const have = new Set(items.map((w: any) => w.planned_month).filter(Boolean))
    const raw = [currentKey, shiftKey(currentKey, 1), ...(db!.hh.wish_months || []), ...have]
    return Array.from(new Set(raw.filter((m) => m && (!hide.has(m) || have.has(m))))).sort() as string[]
  }, [db, currentKey, items])
  const free = (m: string) => cycleData(db, m, today).free
  const shown = (w: any) => !filter || w.wish_category_id === filter
  const itemForm = (w?: any, month?: string) => setForm({ title: w ? 'Editar desejo' : 'Novo desejo', initial: w ? { ...w, amount: Number(w.amount) || '', planned_month: w.planned_month || '' } : { wish_category_id: filter || wcats[0]?.id, planned_month: month ?? currentKey }, fields: [
    { k: 'name', label: 'O que é', type: 'text', required: true },
    { k: 'amount', label: 'Valor', type: 'money', required: true, positive: true },
    { k: 'planned_month', label: 'Mês', type: 'select', options: months.map((m) => ({ v: m, l: mName(m) })), hint: 'Vazio = Sem mês' },
    { k: 'wish_category_id', label: 'Categoria', type: 'select', options: wcats.map((c: any) => ({ v: c.id, l: c.name })) },
    { k: 'link', label: 'Link do produto (opcional)', type: 'url', placeholder: 'https://…' },
    { k: 'note', label: 'Observação', type: 'text' }],
    onSave: async (v) => { const row = { name: v.name, amount: v.amount, wish_category_id: v.wish_category_id || null, planned_month: v.planned_month || null, link: v.link || '', note: v.note || '' }; return w ? upd('wish', w.id, row) : !!(await ins('wish', { ...row, sort: items.length + 1 })) },
    onDelete: w ? () => del('wish', w.id) : undefined })
  const moveForm = (w: any) => setForm({ title: `Mover "${w.name}"`, initial: { planned_month: w.planned_month || '' }, fields: [{ k: 'planned_month', label: 'Para qual mês', type: 'select', options: months.map((m) => ({ v: m, l: mName(m) })), hint: 'Vazio = Sem mês' }], saveLabel: 'Mover', onSave: (v) => upd('wish', w.id, { planned_month: v.planned_month || null }) })
  const addMonth = () => { const opts = Array.from({ length: 24 }, (_, i) => shiftKey(currentKey, i)).filter((m) => !months.includes(m))
    setForm({ title: 'Adicionar mês', initial: { m: opts[0] }, fields: [{ k: 'm', label: 'Mês', type: 'select', required: true, options: opts.map((m) => ({ v: m, l: mName(m) })) }], saveLabel: 'Adicionar', onSave: (v) => updHH({ wish_months: Array.from(new Set([...(db!.hh.wish_months || []), v.m])).sort(), wish_hidden_months: (db!.hh.wish_hidden_months || []).filter((x: string) => x !== v.m) }) }) }
  const removeMonth = (m: string) => {
    const list = items.filter((w: any) => w.planned_month === m)
    const others = months.filter((x) => x !== m)
    setForm({ title: `Tirar ${mName(m)}`, initial: { dest: 'none', to: others[0] || '' },
      fields: list.length ? [
        { k: 'dest', label: 'O que fazer com os desejos', type: 'ops', options: [{ v: 'none', l: 'Mover para Sem mês' }, { v: 'move', l: 'Mover para outro mês' }, { v: 'del', l: 'Apagar junto' }] },
        { k: 'to', label: 'Para qual mês', type: 'select', options: others.map((x) => ({ v: x, l: mName(x) })) },
      ] : [],
      show: (v) => ({ to: v.dest === 'move' }),
      saveLabel: 'Tirar este mês',
      children: list.length ? undefined : undefined,
      onSave: async (v) => {
        if (v.dest === 'del') { for (const w of list) await del('wish', w.id) }
        else if (v.dest === 'move') { if (!v.to) { toast('Escolha o mês'); return false } for (const w of list) await upd('wish', w.id, { planned_month: v.to }) }
        else { for (const w of list) await upd('wish', w.id, { planned_month: null }) }
        return updHH({ wish_months: (db!.hh.wish_months || []).filter((x: string) => x !== m), wish_hidden_months: Array.from(new Set([...(db!.hh.wish_hidden_months || []), m])) })
      } })
  }
  const catForm = (c?: any) => setForm({ title: c ? 'Renomear categoria' : 'Nova categoria', initial: c || {}, fields: [{ k: 'name', label: 'Nome', type: 'text', required: true }],
    onSave: async (v) => (c ? upd('wishCats', c.id, { name: v.name }) : !!(await ins('wishCats', { name: v.name, sort: wcats.length + 1 }))),
    onDelete: c ? async () => { await del('wishCats', c.id); toast('Os itens ficaram sem categoria') } : undefined })
  const toggle = (w: any) => { if (!w.bought && !(Number(w.amount) > 0)) { toast('Coloque o valor antes de marcar como comprado'); return itemForm(w) } return upd('wish', w.id, { bought: !w.bought, bought_on: w.bought ? null : today }) }
  const noValue = items.filter((w: any) => !w.bought && !(Number(w.amount) > 0)).length
  const Item = ({ w }: { w: any }) => <div className={'li tap' + (w.bought ? ' done' : '')} onClick={() => itemForm(w)}>
    <Check on={w.bought} onClick={() => toggle(w)} />
    <div style={{ minWidth: 0, flex: 1 }}><div className="t">{w.name}</div><div className="row" style={{ gap: 5, marginTop: 3, flexWrap: 'wrap' }}>{catBy[w.wish_category_id] && <span className="tag">{catBy[w.wish_category_id].name}</span>}{w.link && <a className="tag" style={{ color: 'var(--acc)', background: 'var(--accS)', textDecoration: 'none' }} href={w.link.startsWith('http') ? w.link : 'https://' + w.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Icon n="link" /> {host(w.link)}</a>}{w.note && <span className="lbl">{w.note}</span>}</div></div>
    <div className="v">{Number(w.amount) > 0 ? brl(Number(w.amount)) : <span className="tag warn">sem valor</span>}</div>
    <More items={editDel(() => itemForm(w), async () => { if (confirm(`Apagar "${w.name}"?`)) await del('wish', w.id) }, [{ label: 'Mover de mês', icon: 'cal', onClick: () => moveForm(w) }])} />
  </div>
  const group = (m: string | null) => { const list = items.filter((w: any) => (w.planned_month || null) === m && shown(w)).sort((a: any, b: any) => Number(a.bought) - Number(b.bought))
    const id = m || 'none'; const op = open[id] ?? m !== null
    const total = list.filter((w: any) => !w.bought).reduce((a: number, w: any) => a + Number(w.amount), 0)
    const bought = list.filter((w: any) => w.bought).reduce((a: number, w: any) => a + Number(w.amount), 0)
    const fr = m ? free(m) : null
    return <div key={id} className="card" style={{ padding: '12px 14px 4px' }}>
      <div className="ch tap" onClick={() => setOpen({ ...open, [id]: !op })}><Icon n={m ? 'cal' : 'list'} s={15} /><h3 style={{ marginLeft: 6 }}>{m ? mName(m) : 'Sem mês'}</h3>
        <span className="sp n" style={{ fontWeight: 650 }}>{brl(total)}</span>
        <span style={{ color: 'var(--mut2)', marginLeft: 4, transform: op ? 'rotate(180deg)' : undefined, display: 'grid' }}><Icon n="down" s={16} /></span>
        {m && <More items={[{ label: 'Tirar este mês', icon: 'trash', neg: true, onClick: () => removeMonth(m) }]} />}</div>
      {m && (bought > 0 || fr != null) && <div className="lbl n" style={{ margin: '-4px 0 4px' }}>{bought > 0 ? `já comprado ${brl(bought)}` : ''}{bought > 0 && fr != null ? ' · ' : ''}{fr != null && total > 0 ? (fr >= total ? 'cabe no que sobra do ciclo' : 'passa do que sobra do ciclo') : ''}</div>}
      {op && <>{list.length === 0 && <Empty>{m ? 'Nada planejado para este mês.' : 'Vazio.'}</Empty>}{list.map((w: any) => <Item key={w.id} w={w} />)}
        <Add label={m ? `Adicionar em ${cycleName(m, naming)}` : 'Adicionar sem mês'} onClick={() => itemForm(undefined, m || '')} /><div style={{ height: 8 }} /></>}
    </div> }
  return <>
    <Header /><div className="ttl">Eu</div><Seg items={EU} />
    <div className="wrap">
      {noValue > 0 && <Note kind="warn" icon="alert" t={`${noValue} desejo${noValue > 1 ? 's' : ''} sem valor`} d="Vieram da sua lista sem preço. Toque no item e coloque o valor (é obrigatório)." />}
      <div className="chips" style={{ overflowX: 'auto' }}><span className={'tap ' + (!filter ? 'on' : '')} onClick={() => setFilter('')}>Todas</span>{wcats.map((c: any) => <span key={c.id} className={'tap ' + (filter === c.id ? 'on' : '')} onClick={() => setFilter(c.id)}>{c.name}</span>)}<span className="tap" onClick={() => setCats(true)}>Categorias…</span></div>
      {months.map((m) => group(m))}
      <button type="button" className="card row" style={{ width: '100%', padding: '12px 14px', color: 'var(--acc)', fontWeight: 600, gap: 8 }} onClick={addMonth}><Icon n="plus" s={16} /> Adicionar mês</button>
      {group(null)}
      <Note icon="link" t="Link do produto (opcional)" d="Cole o link ao adicionar ou editar. Tocar no link abre a loja. O valor é obrigatório." />
    </div>
    {cats && <Sheet title="Categorias da wishlist" onClose={() => setCats(false)}><div className="card" style={{ padding: '2px 14px' }}>
      {wcats.map((c: any) => <div key={c.id} className="li tap" onClick={() => catForm(c)}><div className="t">{c.name}</div><span className="sp lbl">{items.filter((w: any) => w.wish_category_id === c.id).length}</span><More items={editDel(() => catForm(c), async () => { if (confirm(`Apagar a categoria "${c.name}"?`)) await del('wishCats', c.id) })} /></div>)}
      <Add label="Nova categoria" onClick={() => catForm()} /><div style={{ height: 8 }} /></div></Sheet>}
    {form}
  </>
}
