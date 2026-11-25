import { useMemo, useState } from 'react'
import { useData } from '../data'
import { Icon } from '../icons'
import { Header, CycleBanner, Seg, DIN, More, Add, useForm, Empty, Tog, MACRO_COLOR, MACRO_LABEL, Sheet, Ic, catIcon } from '../ui'
import { cycleData, isFuelCat, fuelSplit } from '../lib/calc'
import { brl } from '../lib/fmt'
import { learn } from '../lancar'
import { cycleName } from '../lib/cycle'

export default function Metas() {
  const ctx = useData(); const { db, key, today, naming, upd, updHH, toast } = ctx
  const cd = useMemo(() => cycleData(db, key, today), [db, key, today])
  const [form, setForm] = useForm()
  const [macroOpen, setMacroOpen] = useState<string | null>(null)
  const hh = db!.hh; const al = hh.alerts || {}
  const goals = db!.categories.filter((c: any) => c.goal != null)
  const macroGoal = (m: string) => db!.categories.filter((c: any) => c.macro === m && c.goal != null).reduce((s: number, c: any) => s + Number(c.goal), 0)
  const capForm = () => setForm({ title: 'Teto do ciclo', initial: { cap: Number(hh.month_cap) || '', leisure_max: hh.leisure_max }, fields: [{ k: 'cap', label: 'Quanto podemos gastar por ciclo (tudo somado)', type: 'money', hint: 'Usado no "Livre para gastar" do Início. Deixe vazio para não usar.' }, { k: 'leisure_max', label: 'Saídas de lazer por ciclo', type: 'number', min: 0, max: 30 }], onSave: (v) => updHH({ month_cap: v.cap ?? 0, leisure_max: v.leisure_max ?? 3 }) })
  const goalForm = (c?: any) => setForm({ title: c ? `Meta · ${c.name}` : 'Nova meta', initial: c ? { category_id: c.id, goal: Number(c.goal) } : {}, fields: [
    { k: 'category_id', label: 'Categoria', type: 'select', required: true, options: db!.categories.filter((x: any) => c ? x.id === c.id : x.goal == null).map((x: any) => ({ v: x.id, l: x.name })) },
    { k: 'goal', label: 'Meta por ciclo', type: 'money', required: true }],
    onSave: (v) => upd('categories', v.category_id, { goal: v.goal }), onDelete: c ? () => upd('categories', c.id, { goal: null }) : undefined })
  const setAlert = (k: string) => updHH({ alerts: { ...al, [k]: al[k] === false } })
  const pctDay = cd.isCurrent ? (cd.dayN / cd.daysTotal) * 100 : 100
  const used = cd.cap ? (cd.saidas / cd.cap) * 100 : 0
  return <>
    <Header /><div className="ttl">Dinheiro</div><Seg items={DIN} /><CycleBanner />
    <div className="wrap">
      <div className="card tap" onClick={capForm}><div className="row"><div><div className="lbl">Teto de {cycleName(key, naming).toLowerCase()}</div><div className="n" style={{ fontSize: 24, fontWeight: 650, letterSpacing: -0.5 }}>{cd.cap ? brl(cd.cap) : 'Sem teto'}</div></div><span className="sp" style={{ color: 'var(--mut2)' }}><Icon n="edit" s={16} /></span></div>
        {cd.cap > 0 ? <><div className="bar" style={{ margin: '10px 0 6px', overflow: 'visible' }}><i style={{ width: `${Math.min(100, used)}%`, background: used > 100 ? 'var(--neg)' : 'var(--ink2)' }} /><b style={{ position: 'absolute', left: `${pctDay}%`, top: -4, width: 2, height: 14, background: 'var(--acc)', borderRadius: 2 }} /></div>
          <div className="row lbl n"><span>Gasto {brl(cd.saidas, false)} · {Math.round(used)}%</span><span className="sp row" style={{ gap: 5 }}><i style={{ width: 2, height: 10, background: 'var(--acc)', display: 'inline-block' }} />hoje = {Math.round(pctDay)}% do ciclo</span></div></>
          : <div className="lbl" style={{ marginTop: 6 }}>Toque para definir quanto podem gastar no ciclo.</div>}
      </div>
      <div className="g3" style={{ marginBottom: 10 }}>{(['viver', 'crescer', 'curtir'] as const).map((m) => <button type="button" key={m} className="stat tap" onClick={() => setMacroOpen(m)} style={{ textAlign: 'left', width: '100%' }}><div className="lbl">{MACRO_LABEL[m]}</div><div className="v" style={{ fontSize: 14, color: m === 'crescer' ? 'var(--acc)' : undefined }}>{brl(cd.macro[m], false)}</div><div className="lbl n">{macroGoal(m) ? `de ${brl(macroGoal(m), false)}` : 'sem meta'} · ver</div></button>)}</div>
      <div className="card tap" onClick={capForm}><div className="ch"><h3>Saídas de lazer</h3><span className={'sp tag ' + (cd.leisureCount > hh.leisure_max ? 'neg' : '')}>{cd.leisureCount} de {hh.leisure_max}</span></div>
        <div className="row" style={{ gap: 5 }}>{Array.from({ length: Math.max(hh.leisure_max, cd.leisureCount) + 1 }).map((_, i) => <div key={i} style={{ flex: 1, height: 8, borderRadius: 9, background: i < Math.min(cd.leisureCount, hh.leisure_max) ? 'var(--gold)' : i < cd.leisureCount ? 'var(--neg)' : 'var(--track)' }} />)}</div>
        <div className="lbl" style={{ marginTop: 7 }}>Combinado: até {hh.leisure_max} por ciclo (gastos em categorias de lazer). Toque para mudar.</div></div>
      <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>Metas por categoria</h3></div>
        {goals.length === 0 && <Empty>Nenhuma meta ainda. Adicione a primeira.</Empty>}
        {goals.map((c: any) => { const v = cd.byCat[c.id] || 0; const g = Number(c.goal); const p = g ? (v / g) * 100 : v > 0 ? 101 : 0
          const col = p > 100 ? 'var(--neg)' : p >= 90 ? 'var(--warn)' : MACRO_COLOR[c.macro]
          return <div key={c.id} className="li tap" style={{ display: 'block' }} onClick={() => goalForm(c)}>
            <div className="row" style={{ marginBottom: 6 }}><span className="t">{c.name}</span><span className="sp" />{p > 100 ? <span className="tag neg n">+{brl(v - g, false)}</span> : p >= 90 ? <span className="tag warn n">{Math.round(p)}%</span> : <span className="lbl n">{Math.round(p)}%</span>}<More items={[{ label: 'Editar', icon: 'edit', onClick: () => goalForm(c) }, { label: 'Tirar meta', icon: 'trash', neg: true, onClick: () => upd('categories', c.id, { goal: null }) }]} /></div>
            <div className="bar t"><i style={{ width: `${Math.min(100, p)}%`, background: col }} /></div>
            <div className="lbl n" style={{ marginTop: 5 }}><b style={{ color: 'var(--ink)', fontWeight: 600 }}>{brl(v, false)}</b> de {brl(g, false)} · {MACRO_LABEL[c.macro]}</div>
            {isFuelCat(c) && (() => { const f = fuelSplit(cd.outs, c.id); return (f.moto > 0 || f.carro > 0) ? <div className="lbl n" style={{ marginTop: 2 }}>Moto {brl(f.moto, false)} · Carro {brl(f.carro, false)}</div> : null })()}
          </div> })}
        <Add label="Nova meta" onClick={() => goalForm()} /><div style={{ height: 8 }} />
      </div>
      <div className="card" style={{ padding: '12px 14px 2px' }}><div className="ch"><h3>Quando avisar</h3></div>
        {[['cat90', 'Categoria chegou a 90%', 'âmbar; acima de 100%, vermelho'], ['pace', 'Ritmo acima do ideal', 'gasto mais rápido que os dias do ciclo'], ['leisure', 'Saídas de lazer', `acima de ${hh.leisure_max} por ciclo`], ['card', 'Cartão perto da meta', 'a partir de 85%; R$ 0 para os que estão parando'], ['bills', 'Fatura vencendo', '3 dias antes e no dia']].map(([k, t, d]) =>
          <div key={k} className="li"><div><div className="t">{t}</div><div className="d">{d}</div></div><Tog on={al[k] !== false} onClick={() => setAlert(k)} /></div>)}
      </div>
    </div>
    {macroOpen && <Sheet title={MACRO_LABEL[macroOpen]} onClose={() => setMacroOpen(null)}>
      {(() => {
        const m = macroOpen
        const cats = db!.categories.filter((c: any) => c.macro === m)
        const catIds = new Set(cats.map((c: any) => c.id))
        const txs = (cd.outs as any[]).filter((t) => t.category_id ? catIds.has(t.category_id) : m === 'viver')
        const recat = (t: any) => setForm({ title: `Trocar · ${t.description}`, initial: { category_id: t.category_id || '' }, fields: [{ k: 'category_id', label: 'Nova categoria', type: 'select', required: true, options: db!.categories.map((c: any) => ({ v: c.id, l: `${c.name} · ${MACRO_LABEL[c.macro]}` })) }], saveLabel: 'Trocar', onSave: async (v) => { const ok = await upd('tx', t.id, { category_id: v.category_id || null }); if (ok && v.category_id) { const w = await learn(ctx, t.description, v.category_id); toast(w ? `Trocado · aprendi "${w}"` : 'Trocado') } return ok } })
        return <>
          <div className="n" style={{ fontSize: 22, fontWeight: 650, margin: '0 0 10px' }}>{brl(cd.macro[m], false)}</div>
          <div className="card" style={{ padding: '12px 14px 4px', marginBottom: 10 }}><div className="ch"><h3>Categorias</h3></div>
            {cats.length === 0 && <Empty>Nenhuma categoria neste grupo.</Empty>}
            {cats.map((c: any) => { const v = cd.byCat[c.id] || 0; const f = isFuelCat(c) ? fuelSplit(cd.outs, c.id) : null; return <div key={c.id} className="li"><div style={{ minWidth: 0 }}><div className="t">{c.name}</div>{f && (f.moto > 0 || f.carro > 0) && <div className="d">Moto {brl(f.moto, false)} · Carro {brl(f.carro, false)}</div>}</div><div className="v">{brl(v, false)}</div></div> })}
          </div>
          <div className="card" style={{ padding: '12px 14px 4px' }}><div className="ch"><h3>Gastos</h3></div>
            {txs.length === 0 && <Empty>Nenhum gasto neste grupo neste ciclo.</Empty>}
            {txs.map((t: any) => { const c = db!.categories.find((x: any) => x.id === t.category_id); return <div key={t.id} className="li"><Ic n={catIcon(c?.name)} /><div style={{ minWidth: 0, flex: 1 }}><div className="t">{t.description}</div><div className="d">{c?.name || 'Sem categoria'}{t.vehicle ? ` · ${t.vehicle}` : ''}</div></div><div className="v">{brl(Number(t.amount))}</div><button type="button" className="tag" onClick={() => recat(t)}>trocar</button></div> })}
            <div style={{ height: 8 }} />
          </div>
        </>
      })()}
    </Sheet>}
    {form}
  </>
}
