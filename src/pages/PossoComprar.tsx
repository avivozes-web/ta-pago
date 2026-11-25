import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../data'
import { Icon } from '../icons'
import { Note, Sheet } from '../ui'
import { brl, moneyIn, moneyOut } from '../lib/fmt'
import { analyzeBuy, verdictText, pathsToFit, targetKeyFromMonths, type BuyInput } from '../lib/plan'

const KINDS = ['Celular', 'Viagem', 'Vestuário', 'Eletrônico', 'Beleza', 'Casa', 'Educação', 'Outra coisa']
const PRICES = [100, 200, 500, 1000, 2000, 3000, 5000]
const NS = [2, 3, 4, 5, 6, 10, 12]
const MOTIVE: { v: string; l: string }[] = [{ v: 'preciso', l: 'Preciso mesmo' }, { v: 'quero', l: 'Quero muito' }, { v: 'impulso', l: 'Impulso' }]
const PAY: { v: BuyInput['pay']; l: string; d: string }[] = [
  { v: 'vista', l: 'À vista', d: 'sai tudo neste mês' },
  { v: 'parcelado', l: 'Parcelado', d: 'divide em vezes' },
  { v: 'melhor', l: 'O app decide', d: 'escolhe o que pesa menos' },
]

function Ops({ value, on, items }: { value: string; on: (v: string) => void; items: { v: string; l: string; d?: string }[] }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{items.map((x) => <button type="button" key={x.v} className={'op' + (value === x.v ? ' on' : '')} style={{ padding: '8px 12px' }} onClick={() => on(x.v)}>{x.l}{x.d && value === x.v ? <span className="lbl" style={{ display: 'block', fontWeight: 400 }}>{x.d}</span> : null}</button>)}</div>
}

export default function PossoComprar() {
  const nav = useNavigate()
  const { db, today, ins, updHH, toast } = useData()
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState('Celular')
  const [other, setOther] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [pay, setPay] = useState<BuyInput['pay']>('vista')
  const [n, setN] = useState(6)
  const [interest, setInterest] = useState<BuyInput['interest']>('nao')
  const [pmtStr, setPmtStr] = useState('')
  const [motive, setMotive] = useState('quero')
  const [how, setHow] = useState(false)
  const [done, setDone] = useState<null | 'meta' | 'amanha' | 'desisti'>(null)
  const [showPaths, setShowPaths] = useState(false)

  const name = kind === 'Outra coisa' ? (other.trim() || 'Compra') : kind
  const amount = moneyIn(amountStr) || 0
  const knownPmt = moneyIn(pmtStr) || undefined
  const input: BuyInput = { name, amount, pay, n: pay === 'vista' ? 1 : n, interest, knownPmt, motive }

  const a = useMemo(() => (amount > 0 ? analyzeBuy(db, today, input) : null), [db, today, name, amount, pay, n, interest, knownPmt, motive])
  const paths = a ? pathsToFit(db, today, a) : null
  const steps = pay === 'vista' ? ['o', 'preco', 'pago', 'motivo', 'ver'] : ['o', 'preco', 'pago', 'parcela', 'motivo', 'ver']

  function next() {
    if (step === 0 && kind === 'Outra coisa' && !other.trim()) return toast('Diga o que é')
    if (steps[step] === 'preco' && !(amount > 0)) return toast('Coloque o preço')
    if (steps[step] === 'parcela' && interest === 'sim' && !(knownPmt! > 0)) return toast('Qual é o valor da parcela?')
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }
  function back() { if (step === 0 || done) nav('/dinheiro/investir'); else setStep((s) => s - 1) }

  async function patchInbox(item: any) {
    const cur = Array.isArray(db!.hh.buy_inbox) ? db!.hh.buy_inbox : []
    return updHH({ buy_inbox: [...cur, item] })
  }
  async function criarMeta(per: number, months: number, targetKey: string) {
    if (!a) return
    const target = a.hit.total || amount
    const ok = await ins('investGoals', { name, target, place: 'criado pelo Posso comprar?', start_amount: 0, deadline: targetKey, monthly_amount: per, sort: db!.investGoals.length + 1 })
    if (ok) { toast('Meta criada em Planejamento'); setDone('meta') }
  }
  async function amanha() {
    if (await patchInbox({ kind: 'amanha', name, amount, pay: a?.hit.pay, n: a?.hit.n, created: today })) { toast('Lembro você amanhã'); setDone('amanha') }
  }
  async function desisti() {
    if (await patchInbox({ kind: 'desisti', name, amount, created: today })) { toast('Anotado: dinheiro que você não gastou'); setDone('desisti') }
  }

  const s = steps[step]
  const title = 'Posso comprar?'
  return <>
    <div className="hdr">
      <button type="button" className="ib" aria-label="voltar" onClick={back}><Icon n="left" /></button>
      <div style={{ fontWeight: 650, fontSize: 14 }}>{title}</div>
      <button type="button" className="ib" aria-label="fechar" style={{ marginLeft: 'auto' }} onClick={() => nav('/dinheiro/investir')}><Icon n="x" /></button>
    </div>
    <div className="wrap">
      <div className="row" style={{ gap: 4, margin: '4px 0 14px' }}>{steps.map((_, i) => <i key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= step ? 'var(--acc)' : '#E4E2DC' }} />)}</div>

      {s === 'o' && <>
        <div className="big" style={{ fontWeight: 650, fontSize: 22, letterSpacing: -0.4, marginBottom: 4 }}>O que você quer comprar?</div>
        <Ops value={kind} on={setKind} items={KINDS.map((k) => ({ v: k, l: k }))} />
        {kind === 'Outra coisa' && <input className="fi" style={{ marginTop: 10 }} placeholder="O que é?" value={other} onChange={(e) => setOther(e.target.value)} />}
      </>}

      {s === 'preco' && <>
        <div className="big" style={{ fontWeight: 650, fontSize: 22, letterSpacing: -0.4, marginBottom: 4 }}>Quanto custa?</div>
        <div className="lbl" style={{ marginBottom: 8 }}>{name}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>{PRICES.map((v) => <button type="button" key={v} className={'op' + (amount === v ? ' on' : '')} onClick={() => setAmountStr(moneyOut(v))}>{brl(v, false)}</button>)}</div>
        <div className="lbl">Ou o valor exato</div>
        <input className="fi" inputMode="decimal" placeholder="0,00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} />
      </>}

      {s === 'pago' && <>
        <div className="big" style={{ fontWeight: 650, fontSize: 22, letterSpacing: -0.4, marginBottom: 4 }}>Como pensa pagar?</div>
        <div className="lbl" style={{ marginBottom: 8 }}>{name} · {brl(amount)}</div>
        <Ops value={pay} on={(v) => setPay(v as BuyInput['pay'])} items={PAY} />
      </>}

      {s === 'parcela' && <>
        <div className="big" style={{ fontWeight: 650, fontSize: 22, letterSpacing: -0.4, marginBottom: 4 }}>Em quantas vezes?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>{NS.map((v) => <button type="button" key={v} className={'op' + (n === v ? ' on' : '')} onClick={() => setN(v)}>{v}x</button>)}</div>
        <div className="lbl" style={{ marginBottom: 6 }}>Tem juros?</div>
        <Ops value={interest} on={(v) => setInterest(v as BuyInput['interest'])} items={[{ v: 'nao', l: 'Não' }, { v: 'sim', l: 'Sim' }, { v: 'nao_sei', l: 'Não sei' }]} />
        {interest === 'sim' && <div style={{ marginTop: 10 }}><div className="lbl">Valor da parcela</div><input className="fi" inputMode="decimal" placeholder="0,00" value={pmtStr} onChange={(e) => setPmtStr(e.target.value)} /></div>}
        {interest === 'nao_sei' && <div className="lbl" style={{ marginTop: 10 }}>O app conta {Number(db!.hh.buy_interest_pct ?? 3)}% ao mês (você pode mudar em Ajustes) e mostra o total e o que é só de juros.</div>}
      </>}

      {s === 'motivo' && <>
        <div className="big" style={{ fontWeight: 650, fontSize: 22, letterSpacing: -0.4, marginBottom: 4 }}>Por que você quer?</div>
        <Ops value={motive} on={setMotive} items={MOTIVE} />
      </>}

      {s === 'ver' && a && !done && !showPaths && <>
        <div className={'card'} style={{ background: a.ok ? 'var(--accS, #E6F1ED)' : 'var(--negS)', borderColor: a.ok ? 'transparent' : '#F0D2CC', marginBottom: 10 }}>
          <div style={{ color: a.ok ? 'var(--acc)' : 'var(--neg)' }}><Icon n={a.ok ? 'check' : 'alert'} s={28} /></div>
          <div className="big" style={{ fontWeight: 650, fontSize: 22, letterSpacing: -0.4, marginTop: 6 }}>{verdictText(a, motive)}</div>
          <div className="lbl" style={{ marginTop: 4 }}>{name} · {brl(amount)}{a.hit.pay === 'parcelado' ? ` · ${a.hit.n}x de ${brl(a.hit.inst)}` : ' · à vista'}{a.hit.juros > 0 ? ` · juros ${brl(a.hit.juros)}` : ''}</div>
        </div>
        <div className="card">
          <div className="lbl">Comprometido da renda</div>
          <div className="row" style={{ margin: '6px 0 4px', fontSize: 12 }}><span>hoje {Math.round(a.pctNow)}%</span><span className="sp">com a compra {Math.round(a.pctAfter)}%</span><span>regra {a.rule}%</span></div>
          <div className="meter" style={{ position: 'relative', height: 12, background: '#ECEAE5', borderRadius: 99, overflow: 'hidden' }}>
            <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.min(100, a.pctAfter) + '%', background: a.pctAfter > a.rule ? '#E9B4AC' : 'var(--acc)' }} />
            <i style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.min(100, a.pctNow) + '%', background: 'var(--ink2)', opacity: 0.35 }} />
            <b style={{ position: 'absolute', left: a.rule + '%', top: -2, width: 2, height: 16, background: 'var(--acc)' }} />
          </div>
          <div className="lbl n" style={{ marginTop: 6 }}>regra: até {a.rule}% · fixos, faturas e parcelas, empréstimos, média do dia a dia e o que vai para as metas</div>
        </div>
        {a.hit.juros > 0 && <Note icon="card" t={`Juros: ${brl(a.hit.juros)}`} d={`No total você pagaria ${brl(a.hit.total)} (${a.hit.n}x de ${brl(a.hit.inst)}).`} />}
        {a.delays.length > 0 && <div className="card" style={{ padding: '12px 14px' }}>
          <div className="t" style={{ marginBottom: 6 }}>Suas metas</div>
          {a.delays.map((d) => <div key={d.id} className="li"><div><div className="t">{d.name}</div><div className="d">{d.delay == null ? 'ficaria sem prazo com a folga que sobra' : d.delay === 0 ? 'não atrasa' : `atrasa ${d.delay} mês${d.delay > 1 ? 'es' : ''}`}</div></div></div>)}
        </div>}
        <button type="button" className="btn" style={{ width: '100%', marginTop: 4 }} onClick={() => setShowPaths(true)}>Ver como fazer caber</button>
        <button type="button" className="btn l" style={{ width: '100%', marginTop: 8 }} onClick={() => setHow(true)}>Como cheguei nisso</button>
      </>}

      {s === 'ver' && a && showPaths && paths && !done && <>
        <div className="big" style={{ fontWeight: 650, fontSize: 20, letterSpacing: -0.4, marginBottom: 8 }}>Como fazer caber</div>
        {[paths.cut, paths.faster, paths.later].map((p, i) => <div key={i} className="card" style={{ marginBottom: 8 }}><div className="t">{p.title}</div><div className="d">{p.d}</div></div>)}
        <div className="lbl" style={{ margin: '8px 0 6px' }}>O que você quer fazer?</div>
        <button type="button" className="btn" style={{ width: '100%' }} onClick={() => criarMeta(paths.later.per || paths.faster.per, paths.later.months || 6, paths.later.key || targetKeyFromMonths(a.key, paths.later.months || 6))}>Guardar primeiro · criar a meta</button>
        <button type="button" className="btn l" style={{ width: '100%', marginTop: 8 }} onClick={amanha}>Decidir amanhã</button>
        <button type="button" className="btn l" style={{ width: '100%', marginTop: 8 }} onClick={desisti}>Desisti</button>
        <button type="button" className="btn l" style={{ width: '100%', marginTop: 8 }} onClick={() => setHow(true)}>Como cheguei nisso</button>
      </>}

      {done === 'meta' && <Note kind="acc" icon="piggy" t="Meta criada" d={`${name} foi para Planejamento, com o valor por mês e o mês alvo.`} />}
      {done === 'amanha' && <Note icon="cal" t="Te lembro amanhã" d="Quando você abrir o Planejamento, essa compra volta a aparecer." />}
      {done === 'desisti' && <Note icon="check" t="Anotado" d={`${brl(amount)} de ${name}: dinheiro que você não gastou.`} />}
      {done && <button type="button" className="btn" style={{ width: '100%', marginTop: 10 }} onClick={() => nav('/dinheiro/investir')}>Voltar ao Planejamento</button>}

      {s !== 'ver' && !done && <button type="button" className="btn" style={{ width: '100%', marginTop: 16 }} onClick={next}>{steps[step] === 'motivo' ? 'Analisar meu mês' : 'Continuar'}</button>}
    </div>
    {how && a && <Sheet title="Como cheguei nisso" onClose={() => setHow(false)}>
      <div className="lbl" style={{ marginBottom: 8 }}>É só soma e comparação, com os seus números de verdade. Sem inteligência artificial.</div>
      <div className="card" style={{ padding: '10px 14px' }}>
        {[
          ['Renda do ciclo', brl(a.c.income)],
          ['Fixos (incluindo os de um mês)', brl(a.c.fixos)],
          ['Faturas e parcelas', brl(a.c.faturas)],
          ['Empréstimos', brl(a.c.loans)],
          ['Média do dia a dia', brl(a.c.daily)],
          ['O que vai para as metas', brl(a.c.goals)],
          ['Já comprometido', brl(a.c.total)],
          ['Com esta compra', brl(a.withHit)],
          [`Regra (até ${a.rule}% da renda)`, brl(a.c.income * a.rule / 100)],
        ].map(([t, v]) => <div key={t} className="row" style={{ padding: '5px 0' }}><span>{t}</span><span className="sp n" style={{ fontWeight: 600 }}>{v}</span></div>)}
      </div>
      {a.hit.juros > 0 && <div className="lbl" style={{ marginTop: 8 }}>Nos juros, {interest === 'nao_sei' ? `usei ${Number(db!.hh.buy_interest_pct ?? 3)}% ao mês, porque você marcou “Não sei”.` : 'usei o valor da parcela que você informou.'}</div>}
      <div className="lbl" style={{ marginTop: 8 }}>Esses dois números (a regra e os juros do “Não sei”) você muda em Ajustes.</div>
    </Sheet>}
  </>
}
