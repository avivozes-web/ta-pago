import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Icon } from './icons'
import { useData } from './data'
import { cycleName, cycleRange, keyParts, shiftKey, cycleKeyOf } from './lib/cycle'
import { ddmm, moneyIn, moneyOut } from './lib/fmt'
import { norm } from './lib/parse'

export function Mark() { return <div className="mark"><div className="mk"><Icon n="check" /></div><div className="wm">Tá Pago<b>!</b></div></div> }
export function Check({ on, onClick }: { on: boolean; onClick?: () => void }) {
  return <button type="button" aria-label={on ? 'desmarcar' : 'marcar'} className={'ck' + (on ? ' on' : '')} onClick={(e) => { e.stopPropagation(); onClick?.() }}>{on && <Icon n="check" />}</button>
}
export function Ic({ n, style }: { n: string; style?: any }) { return <div className="ic" style={style}><Icon n={n} /></div> }
export function Add({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" className="add" style={{ width: '100%' }} onClick={onClick}><Icon n="plus" /> {label}</button> }
export function Note({ kind = '', icon, t, d }: { kind?: string; icon: string; t: ReactNode; d?: ReactNode }) {
  return <div className={'note ' + kind}><Icon n={icon} /><div><div className="t">{t}</div>{d && <div className="d">{d}</div>}</div></div>
}
export function Bar({ pct, color, thin }: { pct: number; color?: string; thin?: boolean }) {
  return <div className={'bar' + (thin ? ' t' : '')}><i style={{ width: Math.max(0, Math.min(100, pct)) + '%', background: color }} /></div>
}
export function Tog({ on, onClick }: { on: boolean; onClick: () => void }) { return <button type="button" className={'sp tog' + (on ? '' : ' off')} onClick={onClick} aria-pressed={on}><i /></button> }

export interface MenuItem { label: string; icon: string; onClick: () => void; neg?: boolean }
export function More({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const f = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', f); return () => document.removeEventListener('pointerdown', f)
  }, [open])
  return <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
    <button type="button" className="more" aria-label="mais opções" style={{ padding: '6px 0 6px 6px', display: 'grid' }} onClick={(e) => { e.stopPropagation(); setOpen(!open) }}><Icon n="dots" /></button>
    {open && <div className="menu" onClick={(e) => e.stopPropagation()}>{items.map((it) => <div key={it.label} className={it.neg ? 'neg tap' : 'tap'} onClick={() => { setOpen(false); it.onClick() }}><Icon n={it.icon} /> {it.label}</div>)}</div>}
  </div>
}
export function editDel(onEdit: () => void, onDel: () => void, extra: MenuItem[] = []): MenuItem[] {
  return [{ label: 'Editar', icon: 'edit', onClick: onEdit }, ...extra, { label: 'Apagar', icon: 'trash', onClick: onDel, neg: true }]
}
export function ask(msg: string) { return window.confirm(msg) }

export function Sheet({ title, onClose, children, right }: { title: ReactNode; onClose: () => void; children: ReactNode; right?: ReactNode }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', f); document.body.style.overflow = '' } }, [onClose])
  return <div className="ovl" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="sheet" role="dialog"><div className="grab" /><div className="sh-t">{title}<span className="sp" />{right}<button type="button" className="ib" style={{ width: 30, height: 30 }} aria-label="fechar" onClick={onClose}><Icon n="x" /></button></div>{children}</div>
  </div>
}

export type Field =
  | { k: string; label: string; type: 'text' | 'textarea' | 'date' | 'month' | 'url'; required?: boolean; placeholder?: string; hint?: string }
  | { k: string; label: string; type: 'money' | 'number'; required?: boolean; placeholder?: string; hint?: string; min?: number; max?: number; positive?: boolean }
  | { k: string; label: string; type: 'select'; options: { v: any; l: string }[]; required?: boolean; hint?: string }
  | { k: string; label: string; type: 'toggle'; hint?: string }
  | { k: string; label: string; type: 'days'; hint?: string }
  | { k: string; label: string; type: 'ops'; options: { v: any; l: string }[]; hint?: string }

export interface FormProps { title: string; fields: (Field | false | null | undefined)[]; initial: Record<string, any>; onSave: (v: Record<string, any>) => Promise<boolean | void> | boolean | void; onDelete?: () => Promise<any> | void; onClose: () => void; saveLabel?: string; show?: (v: Record<string, any>) => Record<string, boolean>; children?: ReactNode }
export function FormSheet({ title, fields, initial, onSave, onDelete, onClose, saveLabel, show, children }: FormProps) {
  const fs = fields.filter(Boolean) as Field[]
  const [v, setV] = useState<Record<string, any>>(() => { const o: any = { ...initial }; fs.forEach((f) => { if ((f.type === 'money') && typeof o[f.k] === 'number') o[f.k] = moneyOut(o[f.k]); if (f.type === 'money' && o[f.k] == null) o[f.k] = '' }); return o })
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const vis = show ? show(v) : {}
  const set = (k: string, x: any) => setV((o) => ({ ...o, [k]: x }))
  async function save() {
    const out: any = { ...v }
    for (const f of fs) {
      if (vis[f.k] === false) continue
      if (f.type === 'money' || f.type === 'number') {
        const raw = String(v[f.k] ?? '').trim()
        const n = f.type === 'money' ? moneyIn(raw) : (raw === '' ? null : Number(raw))
        if (raw !== '' && (n == null || Number.isNaN(n))) return setErr(`${f.label}: número inválido`)
        if (f.required && (n == null || ('positive' in f && f.positive && n <= 0))) return setErr(`${f.label}: preencha um valor${'positive' in f && f.positive ? ' maior que zero' : ''}`)
        if (n != null && 'min' in f && f.min != null && n < f.min) return setErr(`${f.label}: mínimo ${f.min}`)
        if (n != null && 'max' in f && f.max != null && n > f.max) return setErr(`${f.label}: máximo ${f.max}`)
        out[f.k] = n
      } else if (f.type === 'text' || f.type === 'textarea' || f.type === 'url') {
        out[f.k] = String(v[f.k] ?? '').trim()
        if (f.required && !out[f.k]) return setErr(`${f.label}: obrigatório`)
      } else if (f.type === 'select' || f.type === 'date' || f.type === 'month') {
        if ((f as any).required && (v[f.k] == null || v[f.k] === '')) return setErr(`${f.label}: obrigatório`)
        if (v[f.k] === '') out[f.k] = null
      }
    }
    setBusy(true); setErr(null)
    const r = await onSave(out); setBusy(false)
    if (r !== false) onClose()
  }
  return <Sheet title={title} onClose={onClose}>
    {children}
    {fs.map((f) => vis[f.k] === false ? null : <label key={f.k} className="fl" onClick={f.type === 'days' || f.type === 'ops' || f.type === 'toggle' ? (e) => e.preventDefault() : undefined}>
      <span>{f.label}</span>
      {f.type === 'textarea' ? <textarea className="fi" rows={2} value={v[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} />
        : f.type === 'select' ? <select className="fi" value={v[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)}>{!f.required && <option value="">—</option>}{f.options.map((o) => <option key={String(o.v)} value={o.v}>{o.l}</option>)}</select>
          : f.type === 'toggle' ? <div className="row" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 11, padding: '9px 11px' }}><span style={{ fontSize: 13 }}>{f.hint}</span><Tog on={!!v[f.k]} onClick={() => set(f.k, !v[f.k])} /></div>
            : f.type === 'days' ? <div className="row" style={{ gap: 4 }}>{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => { const on = (v[f.k] || []).includes(i); return <button type="button" key={i} className={'daybtn' + (on ? ' on' : '')} onClick={() => set(f.k, on ? v[f.k].filter((x: number) => x !== i) : [...(v[f.k] || []), i].sort())}>{d}</button> })}</div>
              : f.type === 'ops' ? <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{f.options.map((o) => <button type="button" key={String(o.v)} className={'op' + (v[f.k] === o.v ? ' on' : '')} onClick={() => set(f.k, o.v)}>{o.l}</button>)}</div>
                : <input className="fi" type={f.type === 'money' ? 'text' : f.type === 'number' ? 'number' : f.type} inputMode={f.type === 'money' ? 'decimal' : undefined} placeholder={'placeholder' in f ? f.placeholder : f.type === 'money' ? '0,00' : ''} value={v[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} />}
      {'hint' in f && f.hint && f.type !== 'toggle' && <div className="lbl" style={{ marginTop: 3 }}>{f.hint}</div>}
    </label>)}
    {err && <div className="note neg"><Icon n="alert" /><div className="d">{err}</div></div>}
    <div className="row2" style={{ marginTop: 6 }}>
      {onDelete && <button type="button" className="btn neg" style={{ flex: '0 0 auto', padding: '12px 16px' }} onClick={async () => { if (ask('Apagar? Não dá para desfazer.')) { await onDelete(); onClose() } }}><Icon n="trash" /></button>}
      <button type="button" className="btn" disabled={busy} onClick={save}>{busy ? 'Salvando…' : saveLabel || 'Salvar'}</button>
    </div>
  </Sheet>
}

/** Formulário aberto por estado: const [form, setForm] = useForm(); setForm({...props}) */
export function useForm() {
  const [f, setF] = useState<Omit<FormProps, 'onClose'> | null>(null)
  const el = f ? <FormSheet {...f} onClose={() => setF(null)} /> : null
  return [el, setF] as const
}

export function cycleRng(key: string, startDay: number) { const r = cycleRange(key, startDay); return `${ddmm(r.start)} – ${ddmm(r.end)}` }
export function Header() {
  const { key, setKey, currentKey, naming, startDay, db } = useData(); const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const keys: string[] = []
  let first = shiftKey(currentKey, -1)
  db?.tx.forEach((t: any) => { const k = cycleKeyOf(t.date, startDay); if (k < first) first = k })
  let last = shiftKey(currentKey, 2)
  db?.tx.forEach((t: any) => { if (t.bill_due) { const k = t.bill_due.slice(0, 7); if (k > last) last = k } })
  for (let k = last; k >= first; k = shiftKey(k, -1)) keys.push(k)
  const yr = (k: string) => keyParts(k).y !== keyParts(currentKey).y ? ' ' + keyParts(k).y : ''
  return <div className="hdr" style={{ position: 'relative' }}>
    <Mark />
    <button type="button" className="cyc" onClick={() => setOpen(!open)} aria-label="trocar ciclo">
      <div><div className="a">{cycleName(key, naming)}{yr(key)}</div><div className="b n">{cycleRng(key, startDay)}</div></div><Icon n="down" />
    </button>
    <button type="button" className="ib" aria-label="ajustes" onClick={() => nav('/ajustes')}><Icon n="gear" /></button>
    {open && <><div style={{ position: 'fixed', inset: 0, zIndex: 25 }} onClick={() => setOpen(false)} /><div className="cycsel" style={{ right: 58 }}>
      {keys.map((k) => <button type="button" key={k} className={k === key ? 'on' : ''} onClick={() => { setKey(k); setOpen(false) }}>
        <div className="row"><span>{cycleName(k, naming)}{yr(k)}</span><span className="sp lbl">{k === currentKey ? 'atual' : k < currentKey ? 'arquivado' : 'futuro'}</span></div>
        <div className="lbl n">{cycleRng(k, startDay)}</div></button>)}
    </div></>}
  </div>
}
export function CycleBanner() {
  const { key, currentKey, setKey, naming } = useData()
  if (key === currentKey) return null
  return <div className="banner"><Icon n={key < currentKey ? 'clock' : 'cal'} s={15} /><span>{key < currentKey ? 'Ciclo arquivado' : 'Ciclo futuro'}: {cycleName(key, naming)}. </span><button type="button" className="sp linkbtn" style={{ color: 'var(--warn)', textDecoration: 'underline' }} onClick={() => setKey(currentKey)}>voltar ao atual</button></div>
}
export function Seg({ items }: { items: [string, string][] }) {
  return <div className="segc">{items.map(([to, l]) => <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'on' : '')}>{l}</NavLink>)}</div>
}
export const DIN: [string, string][] = [['/dinheiro/extrato', 'Extrato'], ['/dinheiro/fixos', 'Fixos'], ['/dinheiro/cartoes', 'Cartões'], ['/dinheiro/metas', 'Metas'], ['/dinheiro/investir', 'Investir']]
export const CASA: [string, string][] = [['/casa/compras', 'Compras'], ['/casa/tarefas', 'Tarefas']]
export const EU: [string, string][] = [['/eu/habitos', 'Hábitos'], ['/eu/wishlist', 'Wishlist']]

const CAT_ICONS: [string, string][] = [['mercado', 'cart'], ['lanche', 'cake'], ['docinho', 'cake'], ['conta', 'bolt'], ['casa', 'house'], ['transporte', 'car'], ['saude', 'pill'], ['farmacia', 'pill'], ['beleza', 'sparkle'], ['roupa', 'shirt'], ['presente', 'gift'], ['igreja', 'church'], ['dizimo', 'church'], ['lazer', 'party'], ['assinatura', 'repeat'], ['invest', 'piggy']]
export function catIcon(name?: string) { const n = norm(name || ''); return CAT_ICONS.find(([k]) => n.includes(k))?.[1] || 'tag' }
export const MACRO_COLOR: Record<string, string> = { viver: 'var(--ink2)', crescer: 'var(--acc)', curtir: 'var(--gold)' }
export const MACRO_LABEL: Record<string, string> = { viver: 'Viver', crescer: 'Crescer', curtir: 'Curtir' }
export function Empty({ children }: { children: ReactNode }) { return <div className="empty">{children}</div> }
