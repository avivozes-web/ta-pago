import { useMemo, useState } from 'react'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, Seg, EU, More, editDel, Add, Note, Check, useForm, Empty } from '../ui'
import { cycleData } from '../lib/calc'
import { brl } from '../lib/fmt'
import { cycleName, shiftKey } from '../lib/cycle'

const host = (u: string) => { try { return new URL(u.startsWith('http') ? u : 'https://' + u).hostname.replace(/^www\./, '') } catch { return 'link' } }
export default function Wishlist() {
  const { db, key, today, naming, currentKey, ins, upd, del, toast } = useData()
  const cd = useMemo(() => cycleData(db, key, today), [db, key, today])
  const [form, setForm] = useForm()
  const [filter, setFilter] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const cats = db!.wishCats; const items = db!.wish
  const planned = items.filter((w: any) => !w.bought && w.planned_month === key)
  const plannedSum = planned.reduce((s: number, w: any) => s + Number(w.amount), 0)
  const fits = cd.free == null ? null : cd.free >= plannedSum
  const months = Array.from({ length: 13 }, (_, i) => shiftKey(currentKey, i - 1))
  const itemForm = (w?: any, catId?: string) => setForm({ title: w ? 'Editar desejo' : 'Novo desejo', initial: w ? { ...w, amount: Number(w.amount) || '' } : { wish_category_id: catId || cats[0]?.id, planned_month: '' }, fields: [
    { k: 'name', label: 'O que é', type: 'text', required: true },
    { k: 'amount', label: 'Valor', type: 'money', required: true, positive: true },
    { k: 'wish_category_id', label: 'Categoria', type: 'select', required: true, options: cats.map((c: any) => ({ v: c.id, l: c.name })) },
    { k: 'planned_month', label: 'Para qual mês', type: 'select', options: months.map((m) => ({ v: m, l: `${cycleName(m, naming)} ${m.slice(0, 4)}` })) },
    { k: 'link', label: 'Link do produto (opcional)', type: 'url', placeholder: 'https://…' },
    { k: 'note', label: 'Observação', type: 'text' }],
    onSave: async (v) => { const row = { name: v.name, amount: v.amount, wish_category_id: v.wish_category_id, planned_month: v.planned_month || null, link: v.link || '', note: v.note || '' }; return w ? upd('wish', w.id, row) : !!(await ins('wish', { ...row, sort: items.length + 1 })) },
    onDelete: w ? () => del('wish', w.id) : undefined })
  const catForm = (c?: any) => setForm({ title: c ? 'Renomear categoria' : 'Nova categoria', initial: c || {}, fields: [{ k: 'name', label: 'Nome', type: 'text', required: true }],
    onSave: async (v) => (c ? upd('wishCats', c.id, { name: v.name }) : !!(await ins('wishCats', { name: v.name, sort: cats.length + 1 }))),
    onDelete: c ? async () => { await del('wishCats', c.id); toast('Os itens ficaram sem categoria') } : undefined })
  const toggle = (w: any) => { if (!w.bought && !(Number(w.amount) > 0)) { toast('Coloque o valor antes de marcar como comprado'); return itemForm(w) } return upd('wish', w.id, { bought: !w.bought, bought_on: w.bought ? null : today }) }
  const groups = [...cats.map((c: any) => ({ c, list: items.filter((w: any) => w.wish_category_id === c.id) })), { c: { id: 'none', name: 'Sem categoria' }, list: items.filter((w: any) => !w.wish_category_id) }].filter((g) => g.c.id !== 'none' || g.list.length)
  const shown = groups.filter((g) => !filter || g.c.id === filter)
  const isOpen = (id: string, i: number) => open[id] ?? (filter ? true : i < 1)
  const noValue = items.filter((w: any) => !w.bought && !(Number(w.amount) > 0)).length
  return <>
    <Header /><div className="ttl">Eu</div><Seg items={EU} />
    <div className="wrap">
      <div className="card row"><div><div className="lbl">Planejado para {cycleName(key, naming).toLowerCase()}</div><div className="n" style={{ fontSize: 22, fontWeight: 650, letterSpacing: -0.4 }}>{brl(plannedSum)}</div><div className="lbl">{planned.length} ite{planned.length === 1 ? 'm' : 'ns'}{fits == null ? '' : fits ? ' · cabe no que sobra do ciclo' : ' · passa do que sobra do ciclo'}</div></div>{fits != null && planned.length > 0 && <span className={'sp tag ' + (fits ? 'acc' : 'warn')}><Icon n={fits ? 'check' : 'alert'} /> {fits ? 'cabe' : 'não cabe'}</span>}</div>
      {noValue > 0 && <Note kind="warn" icon="alert" t={`${noValue} desejo${noValue > 1 ? 's' : ''} sem valor`} d="Vieram da sua lista sem preço. Toque no item e coloque o valor (é obrigatório)." />}
      <div className="chips" style={{ overflowX: 'auto' }}><span className={'tap ' + (!filter ? 'on' : '')} onClick={() => setFilter('')}>Todas</span>{cats.map((c: any) => <span key={c.id} className={'tap ' + (filter === c.id ? 'on' : '')} onClick={() => setFilter(c.id)}>{c.name}</span>)}</div>
      {shown.map((g, i) => { const bought = g.list.filter((w: any) => w.bought).length; const op = isOpen(g.c.id, i)
        return <div key={g.c.id} className="card" style={{ padding: '12px 14px 4px' }}>
          <div className="ch tap" onClick={() => setOpen({ ...open, [g.c.id]: !op })}><h3>{g.c.name}</h3><span className="sp lbl">{bought} de {g.list.length} comprados</span><span style={{ color: 'var(--mut2)', marginLeft: 4, transform: op ? 'rotate(180deg)' : undefined, display: 'grid' }}><Icon n="down" s={16} /></span>{g.c.id !== 'none' && <More items={editDel(() => catForm(g.c), async () => { if (confirm(`Apagar a categoria "${g.c.name}"? Os itens ficam sem categoria.`)) await del('wishCats', g.c.id) })} />}</div>
          {op && <>{g.list.length === 0 && <Empty>Vazio.</Empty>}
            {[...g.list].sort((a: any, b: any) => Number(a.bought) - Number(b.bought)).map((w: any) => <div key={w.id} className={'li tap' + (w.bought ? ' done' : '')} onClick={() => itemForm(w)}>
              <Check on={w.bought} onClick={() => toggle(w)} />
              <div style={{ minWidth: 0, flex: 1 }}><div className="t">{w.name}</div><div className="row" style={{ gap: 5, marginTop: 3, flexWrap: 'wrap' }}>{w.link && <a className="tag" style={{ color: 'var(--acc)', background: 'var(--accS)', textDecoration: 'none' }} href={w.link.startsWith('http') ? w.link : 'https://' + w.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Icon n="link" /> {host(w.link)}</a>}{w.note && <span className="lbl">{w.note}</span>}{w.bought && w.bought_on && <span className="lbl">comprado {w.bought_on.slice(8)}/{w.bought_on.slice(5, 7)}</span>}</div></div>
              <div className="v" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>{Number(w.amount) > 0 ? brl(Number(w.amount)) : <span className="tag warn">sem valor</span>}{w.planned_month && !w.bought && <span className={'tag' + (w.planned_month === key ? ' dark' : '')} style={{ marginTop: 3 }}>{cycleName(w.planned_month, naming).slice(0, 3)}</span>}</div>
              <More items={editDel(() => itemForm(w), async () => { if (confirm(`Apagar "${w.name}"?`)) await del('wish', w.id) })} />
            </div>)}
            {g.c.id !== 'none' && <Add label={`Adicionar em ${g.c.name}`} onClick={() => itemForm(undefined, g.c.id)} />}<div style={{ height: 8 }} /></>}
        </div> })}
      <div className="card" style={{ padding: '2px 14px' }}><Add label="Nova categoria" onClick={() => catForm()} /><div style={{ height: 8 }} /></div>
      <Note icon="link" t="Link do produto (opcional)" d="Cole o link ao adicionar ou editar. Tocar no link abre a loja. O valor é obrigatório." />
    </div>
    {form}
  </>
}
